import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import {
  AppointmentStatus,
  Prisma,
  type Appointment,
  type User,
} from '../../generated/prisma/client';
import { MailService } from '../../mail/mail.service';
import { PrismaService } from '../../prisma/prisma.service';
import { zonedDayRange } from '../../common/time/zoned-time';
import { parseIsoDateTime } from '../../common/validators/date-time.validators';
import { AvailabilityService } from '../availability/availability.service';
import { StudioClock } from '../availability/studio-clock';
import {
  CancelAppointmentDto,
  CreateAppointmentDto,
  ListAppointmentsQueryDto,
  MyAppointmentsQueryDto,
  UpdateAppointmentDto,
} from './dto/appointment.dto';
import {
  APPOINTMENT_DETAILS_INCLUDE,
  type AppointmentStatusValue,
  type AppointmentWithRelations,
  type PublicBookedSlot,
} from './interfaces/appointment-response.interface';

/** Transiciones que un admin puede aplicar con PUT /appointments/:id. */
const ALLOWED_TRANSITIONS: Partial<
  Record<AppointmentStatus, AppointmentStatus[]>
> = {
  PENDING: [AppointmentStatus.CONFIRMED, AppointmentStatus.CANCELLED],
  CONFIRMED: [AppointmentStatus.COMPLETED, AppointmentStatus.CANCELLED],
};

const ACTIVE_STATUSES: AppointmentStatus[] = [
  AppointmentStatus.PENDING,
  AppointmentStatus.CONFIRMED,
];

export function canTransition(
  from: AppointmentStatus,
  to: AppointmentStatus,
): boolean {
  return ALLOWED_TRANSITIONS[from]?.includes(to) ?? false;
}

function toStatus(value: AppointmentStatusValue): AppointmentStatus {
  return value.toUpperCase() as AppointmentStatus;
}

@Injectable()
export class AppointmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly availability: AvailabilityService,
    private readonly clock: StudioClock,
    private readonly mail: MailService,
  ) {}

  // =====================================================================
  // Reserva
  // =====================================================================

  /** Crea el turno en estado PENDING (se confirma al pagar o lo confirma el admin). */
  async create(user: User, dto: CreateAppointmentDto): Promise<Appointment> {
    const start = this.parseFutureDate(dto.appointment_date);

    const service = await this.prisma.service.findUnique({
      where: { id: dto.service_id },
    });
    if (!service) {
      throw new NotFoundException('Servicio no encontrado');
    }
    if (!service.isActive) {
      throw new BadRequestException(
        'Este servicio no está disponible actualmente',
      );
    }

    if (start < this.clock.earliestBookableStart()) {
      throw new BadRequestException(
        `Debes reservar con al menos ${this.clock.minAdvanceHours} horas de anticipación`,
      );
    }
    if (start > this.clock.latestBookableStart()) {
      throw new BadRequestException(
        `No puedes reservar con más de ${this.clock.maxAdvanceDays} días de anticipación`,
      );
    }

    await this.availability.assertBookable(service, start, {
      conflictMessage: 'Este horario no está disponible',
    });

    return this.prisma.appointment.create({
      data: {
        userId: user.id,
        serviceId: service.id,
        appointmentDate: start,
        notes: dto.notes ?? null,
        status: AppointmentStatus.PENDING,
      },
    });
  }

  // =====================================================================
  // Consultas
  // =====================================================================

  /** GET /appointments: todos los turnos del usuario (incluye completados y cancelados). */
  listMine(
    user: User,
    query: ListAppointmentsQueryDto,
  ): Promise<AppointmentWithRelations[]> {
    return this.prisma.appointment.findMany({
      where: {
        userId: user.id,
        ...(query.status_filter
          ? { status: toStatus(query.status_filter) }
          : {}),
      },
      include: APPOINTMENT_DETAILS_INCLUDE,
      orderBy: { appointmentDate: 'desc' },
      skip: query.skip,
      take: query.limit,
    });
  }

  /**
   * GET /users/me/appointments. Con `when`:
   * - upcoming: desde ahora, pendientes o confirmados, del más cercano al más lejano.
   * - past: ya pasados, completados o cancelados, del más reciente al más antiguo.
   */
  listMineByWhen(
    user: User,
    query: MyAppointmentsQueryDto,
  ): Promise<AppointmentWithRelations[]> {
    const now = this.clock.now();
    let where: Prisma.AppointmentWhereInput = { userId: user.id };
    let order: Prisma.SortOrder = 'desc';

    if (query.when === 'upcoming') {
      where = {
        ...where,
        appointmentDate: { gte: now },
        status: { in: ACTIVE_STATUSES },
      };
      order = 'asc';
    } else if (query.when === 'past') {
      where = {
        ...where,
        OR: [
          { appointmentDate: { lt: now } },
          { status: { notIn: ACTIVE_STATUSES } },
        ],
      };
    }

    return this.prisma.appointment.findMany({
      where,
      include: APPOINTMENT_DETAILS_INCLUDE,
      orderBy: { appointmentDate: order },
      skip: query.skip,
      take: query.limit,
    });
  }

  /** Solo el dueño del turno o un admin. */
  async findOneForUser(
    id: number,
    user: User,
  ): Promise<AppointmentWithRelations> {
    const appointment = await this.prisma.appointment.findUnique({
      where: { id },
      include: APPOINTMENT_DETAILS_INCLUDE,
    });
    if (!appointment) {
      throw new NotFoundException('Turno no encontrado');
    }
    this.assertOwnerOrAdmin(
      appointment,
      user,
      'No tienes permiso para ver este turno',
    );
    return appointment;
  }

  /** Horarios ocupados por turnos confirmados desde hoy (sin datos del cliente). */
  async listPublicConfirmed(): Promise<PublicBookedSlot[]> {
    const { start } = zonedDayRange(this.clock.today(), this.clock.timeZone);
    const appointments = await this.prisma.appointment.findMany({
      where: {
        status: AppointmentStatus.CONFIRMED,
        appointmentDate: { gte: start },
      },
      select: {
        appointmentDate: true,
        service: { select: { durationMinutes: true } },
      },
      orderBy: { appointmentDate: 'asc' },
    });
    return appointments.map((appointment) => ({
      appointment_date: appointment.appointmentDate.toISOString(),
      duration_minutes: appointment.service.durationMinutes,
    }));
  }

  // =====================================================================
  // Modificaciones
  // =====================================================================

  /**
   * PUT /appointments/:id: reprogramar, editar notas o (solo admin) cambiar el estado.
   * Transiciones válidas: PENDING → CONFIRMED | CANCELLED, CONFIRMED → COMPLETED | CANCELLED.
   */
  async update(
    id: number,
    user: User,
    dto: UpdateAppointmentDto,
  ): Promise<Appointment> {
    const appointment = await this.getWithService(id);
    this.assertOwnerOrAdmin(
      appointment,
      user,
      'No tienes permiso para modificar este turno',
    );
    if (!ACTIVE_STATUSES.includes(appointment.status)) {
      throw new BadRequestException(
        'No se puede modificar un turno que está completado o cancelado',
      );
    }

    const newStatus = dto.status ? toStatus(dto.status) : undefined;
    const statusChanges =
      newStatus !== undefined && newStatus !== appointment.status;
    if (statusChanges) {
      if (!user.isAdmin) {
        throw new ForbiddenException(
          'Solo un administrador puede cambiar el estado del turno',
        );
      }
      if (!canTransition(appointment.status, newStatus)) {
        throw new BadRequestException(
          `No se puede pasar un turno de '${appointment.status.toLowerCase()}' a '${newStatus.toLowerCase()}'`,
        );
      }
    }

    const newDate = dto.appointment_date
      ? this.parseFutureDate(dto.appointment_date)
      : undefined;
    const dateChanges =
      newDate !== undefined &&
      newDate.getTime() !== appointment.appointmentDate.getTime();
    if (dateChanges) {
      await this.availability.assertBookable(appointment.service, newDate, {
        excludeAppointmentId: id,
        conflictMessage: 'El nuevo horario no está disponible',
      });
    }

    // Confirmar ocupa el horario: no puede pisar otro turno ya confirmado.
    if (statusChanges && newStatus === AppointmentStatus.CONFIRMED) {
      await this.assertNoConfirmedOverlap(
        id,
        newDate ?? appointment.appointmentDate,
        appointment.service.durationMinutes,
      );
    }

    const updated = await this.prisma.appointment.update({
      where: { id },
      data: {
        ...(dateChanges ? { appointmentDate: newDate } : {}),
        ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
        ...(statusChanges ? { status: newStatus } : {}),
        ...(statusChanges && newStatus === AppointmentStatus.CANCELLED
          ? {
              cancelledAt: this.clock.now(),
              cancellationReason:
                dto.cancellation_reason || 'Cancelado por el administrador',
            }
          : {}),
      },
    });

    if (dateChanges) {
      void this.mail.sendAppointmentRescheduled(
        appointment.user.email,
        appointment.user.fullName,
        appointment.service.name,
        appointment.appointmentDate,
        updated.appointmentDate,
      );
    }
    return updated;
  }

  /** Cancela con motivo. Lo puede hacer el dueño del turno o un admin. */
  async cancel(
    id: number,
    user: User,
    dto: CancelAppointmentDto,
  ): Promise<Appointment> {
    const appointment = await this.getWithService(id);
    this.assertOwnerOrAdmin(
      appointment,
      user,
      'No tienes permiso para cancelar este turno',
    );
    if (!ACTIVE_STATUSES.includes(appointment.status)) {
      throw new BadRequestException('Este turno no se puede cancelar');
    }

    const cancelled = await this.prisma.appointment.update({
      where: { id },
      data: {
        status: AppointmentStatus.CANCELLED,
        cancelledAt: this.clock.now(),
        cancellationReason: dto.cancellation_reason,
      },
    });
    void this.mail.sendAppointmentCancelled(
      appointment.user.email,
      appointment.user.fullName,
      appointment.service.name,
      appointment.appointmentDate,
    );
    return cancelled;
  }

  /** Borrado definitivo (solo admin). Un turno con pago no se borra: se cancela. */
  async remove(id: number): Promise<void> {
    const appointment = await this.prisma.appointment.findUnique({
      where: { id },
      include: { payment: { select: { id: true } } },
    });
    if (!appointment) {
      throw new NotFoundException('Turno no encontrado');
    }
    if (appointment.payment) {
      throw new BadRequestException(
        'No se puede eliminar un turno con un pago registrado. Cancelalo en su lugar.',
      );
    }
    await this.prisma.appointment.delete({ where: { id } });
  }

  // =====================================================================
  // Helpers
  // =====================================================================

  /** Igual que el legado: una fecha pasada es un error de validación (422). */
  private parseFutureDate(value: string): Date {
    const date = parseIsoDateTime(value);
    if (date < this.clock.now()) {
      throw new UnprocessableEntityException([
        'La fecha del turno debe ser en el futuro',
      ]);
    }
    return date;
  }

  private async getWithService(id: number) {
    const appointment = await this.prisma.appointment.findUnique({
      where: { id },
      include: {
        service: true,
        user: { select: { email: true, fullName: true } },
      },
    });
    if (!appointment) {
      throw new NotFoundException('Turno no encontrado');
    }
    return appointment;
  }

  private assertOwnerOrAdmin(
    appointment: Pick<Appointment, 'userId'>,
    user: User,
    message: string,
  ): void {
    if (appointment.userId !== user.id && !user.isAdmin) {
      throw new ForbiddenException(message);
    }
  }

  private async assertNoConfirmedOverlap(
    id: number,
    start: Date,
    durationMinutes: number,
  ): Promise<void> {
    const end = new Date(start.getTime() + durationMinutes * 60_000);
    const busy = await this.availability.getBusyIntervals(start, end, id);
    if (busy.length > 0) {
      throw new BadRequestException(
        'Ya hay un turno confirmado que se superpone con este horario',
      );
    }
  }
}
