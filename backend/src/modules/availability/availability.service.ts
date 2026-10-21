import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import {
  AppointmentStatus,
  type Availability,
  type Service,
} from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  dateStringToColumn,
  minutesOfDay,
  normalizeTime,
  timeColumnToString,
  timeStringToColumn,
  toZonedParts,
  weekdayOf,
  zonedDayRange,
} from '../../common/time/zoned-time';
import {
  CreateAvailabilityDto,
  UpdateAvailabilityDto,
} from './dto/availability.dto';
import { AvailableSlotsDto } from './dto/available-slots.dto';
import type {
  AvailableSlotsResponse,
  DateAvailabilityCheck,
  DaySchedule,
} from './interfaces/availability.interfaces';
import { buildSlotGrid, overlaps, type BusyInterval } from './slot-grid';
import { StudioClock } from './studio-clock';

/** Qué tipo de franja admite cada ruta de administración. */
export type AvailabilityKind = 'any' | 'regular' | 'exception';

const NOT_FOUND_MESSAGES: Record<AvailabilityKind, string> = {
  any: 'Disponibilidad no encontrada',
  regular: 'Horario regular no encontrado',
  exception: 'Excepción no encontrada',
};

/** Ningún servicio dura más de un día: margen para turnos que empiezan el día anterior. */
const BUSY_LOOKBACK_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class AvailabilityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: StudioClock,
  ) {}

  // =====================================================================
  // Horarios libres y validación de reservas
  // =====================================================================

  async getAvailableSlots(
    dto: AvailableSlotsDto,
  ): Promise<AvailableSlotsResponse> {
    const service = await this.prisma.service.findUnique({
      where: { id: dto.service_id },
    });
    if (!service) {
      throw new NotFoundException('Servicio no encontrado');
    }

    const schedule = await this.getDaySchedule(dto.date);
    const range = zonedDayRange(dto.date, this.clock.timeZone);
    const slots = schedule
      ? buildSlotGrid({
          date: dto.date,
          opening: schedule.opening,
          closing: schedule.closing,
          durationMinutes: service.durationMinutes,
          stepMinutes: this.clock.slotStepMinutes,
          timeZone: this.clock.timeZone,
          busy: await this.getBusyIntervals(range.start, range.end),
          earliestStart: this.clock.earliestBookableStart(),
          latestStart: this.clock.latestBookableStart(),
          bookable: service.isActive,
        })
      : [];

    return {
      date: dto.date,
      service_id: service.id,
      service_name: service.name,
      duration_minutes: service.durationMinutes,
      available_slots: slots,
    };
  }

  /**
   * Horario de atención efectivo de una fecha: la excepción de esa fecha si existe
   * (cerrada = null), si no la franja semanal abierta de ese día. null = no se atiende.
   */
  async getDaySchedule(date: string): Promise<DaySchedule | null> {
    const exception = await this.prisma.availability.findFirst({
      where: { specificDate: dateStringToColumn(date) },
    });
    if (exception) {
      return exception.isAvailable ? scheduleOf(exception) : null;
    }
    const regular = await this.prisma.availability.findFirst({
      where: { dayOfWeek: weekdayOf(date), isAvailable: true },
    });
    return regular ? scheduleOf(regular) : null;
  }

  /**
   * Turnos CONFIRMED (de cualquier servicio: el studio atiende de a uno) que se cruzan
   * con [start, end). Cada turno ocupa la duración de SU servicio.
   */
  async getBusyIntervals(
    start: Date,
    end: Date,
    excludeAppointmentId?: number,
  ): Promise<BusyInterval[]> {
    const appointments = await this.prisma.appointment.findMany({
      where: {
        status: AppointmentStatus.CONFIRMED,
        appointmentDate: {
          gte: new Date(start.getTime() - BUSY_LOOKBACK_MS),
          lt: end,
        },
        ...(excludeAppointmentId ? { id: { not: excludeAppointmentId } } : {}),
      },
      select: {
        appointmentDate: true,
        service: { select: { durationMinutes: true } },
      },
    });
    const window = { start, end };
    return appointments
      .map((appointment) => ({
        start: appointment.appointmentDate,
        end: new Date(
          appointment.appointmentDate.getTime() +
            appointment.service.durationMinutes * 60_000,
        ),
      }))
      .filter((busy) => overlaps(busy, window));
  }

  /**
   * Verifica que un turno entre en el horario de atención de su día y no se cruce con
   * un turno confirmado. Lanza 400 con el motivo (mensajes del legado).
   */
  async assertBookable(
    service: Pick<Service, 'durationMinutes'>,
    start: Date,
    options: { excludeAppointmentId?: number; conflictMessage: string },
  ): Promise<void> {
    const local = toZonedParts(start, this.clock.timeZone);
    const schedule = await this.getDaySchedule(local.date);
    if (!schedule) {
      throw new BadRequestException('El estudio está cerrado en esta fecha');
    }

    const startMinute = minutesOfDay(local.time);
    if (
      startMinute < minutesOfDay(schedule.opening) ||
      startMinute >= minutesOfDay(schedule.closing)
    ) {
      throw new BadRequestException(
        `Fuera del horario de atención (${schedule.opening.slice(0, 5)} - ${schedule.closing.slice(0, 5)})`,
      );
    }
    if (
      startMinute + service.durationMinutes >
      minutesOfDay(schedule.closing)
    ) {
      throw new BadRequestException(
        'El turno se extendería más allá del horario de cierre',
      );
    }

    const end = new Date(start.getTime() + service.durationMinutes * 60_000);
    const busy = await this.getBusyIntervals(
      start,
      end,
      options.excludeAppointmentId,
    );
    if (busy.length > 0) {
      throw new BadRequestException(options.conflictMessage);
    }
  }

  /** GET /api/availability/check/:date (público). */
  async checkDate(date: string): Promise<DateAvailabilityCheck> {
    const dayOfWeek = weekdayOf(date);
    const exception = await this.prisma.availability.findFirst({
      where: { specificDate: dateStringToColumn(date) },
    });
    const source =
      exception ??
      (await this.prisma.availability.findFirst({ where: { dayOfWeek } }));
    return {
      date,
      day_of_week: dayOfWeek,
      is_available: source?.isAvailable ?? false,
      start_time: source?.startTime
        ? timeColumnToString(source.startTime)
        : null,
      end_time: source?.endTime ? timeColumnToString(source.endTime) : null,
      is_exception: Boolean(exception),
    };
  }

  // =====================================================================
  // Administración de franjas
  // =====================================================================

  listAll(): Promise<Availability[]> {
    return this.prisma.availability.findMany({ orderBy: { id: 'asc' } });
  }

  listRegular(): Promise<Availability[]> {
    return this.prisma.availability.findMany({
      where: { dayOfWeek: { not: null } },
      orderBy: { dayOfWeek: 'asc' },
    });
  }

  listExceptions(futureOnly: boolean): Promise<Availability[]> {
    return this.prisma.availability.findMany({
      where: {
        specificDate: futureOnly
          ? { gte: dateStringToColumn(this.clock.today()) }
          : { not: null },
      },
      orderBy: { specificDate: 'asc' },
    });
  }

  async create(
    dto: CreateAvailabilityDto,
    kind: AvailabilityKind,
  ): Promise<Availability> {
    validateNewAvailability(dto);
    const dayOfWeek = dto.day_of_week ?? null;
    const specificDate = dto.specific_date ?? null;

    if (kind === 'regular') {
      if (dayOfWeek === null) {
        throw new BadRequestException(
          'Para crear un horario regular debe especificar day_of_week',
        );
      }
    }
    if (kind === 'exception') {
      if (specificDate === null) {
        throw new BadRequestException(
          'Para crear una excepción debe especificar specific_date',
        );
      }
    }

    if (dayOfWeek !== null) {
      const existing = await this.prisma.availability.findFirst({
        where: { dayOfWeek },
      });
      if (existing) {
        throw new BadRequestException(
          kind === 'regular'
            ? `Ya existe un horario para el día ${dayOfWeek}`
            : 'Ya existe disponibilidad para este día de la semana',
        );
      }
    }
    if (specificDate !== null) {
      const existing = await this.prisma.availability.findFirst({
        where: { specificDate: dateStringToColumn(specificDate) },
      });
      if (existing) {
        throw new BadRequestException(
          kind === 'exception'
            ? `Ya existe una excepción para la fecha ${specificDate}`
            : 'Ya existe disponibilidad para esta fecha específica',
        );
      }
    }

    return this.prisma.availability.create({
      data: {
        dayOfWeek,
        specificDate: specificDate ? dateStringToColumn(specificDate) : null,
        startTime: dto.start_time ? timeStringToColumn(dto.start_time) : null,
        endTime: dto.end_time ? timeStringToColumn(dto.end_time) : null,
        isAvailable: dto.is_available,
      },
    });
  }

  /** Actualización parcial: se valida el estado resultante (400, como el legado). */
  async update(
    id: number,
    dto: UpdateAvailabilityDto,
    kind: AvailabilityKind,
  ): Promise<Availability> {
    const current = await this.getOfKind(id, kind);
    const startTime =
      dto.start_time === undefined
        ? current.startTime
        : dto.start_time && timeStringToColumn(dto.start_time);
    const endTime =
      dto.end_time === undefined
        ? current.endTime
        : dto.end_time && timeStringToColumn(dto.end_time);
    const isAvailable = dto.is_available ?? current.isAvailable;

    if (isAvailable && (!startTime || !endTime)) {
      throw new BadRequestException(
        'Una franja disponible debe tener horario de inicio y fin',
      );
    }
    if (startTime && endTime && endTime <= startTime) {
      throw new BadRequestException(
        'La hora de fin debe ser posterior a la de inicio',
      );
    }

    return this.prisma.availability.update({
      where: { id },
      data: { startTime, endTime, isAvailable },
    });
  }

  async remove(id: number, kind: AvailabilityKind): Promise<void> {
    await this.getOfKind(id, kind);
    await this.prisma.availability.delete({ where: { id } });
  }

  private async getOfKind(
    id: number,
    kind: AvailabilityKind,
  ): Promise<Availability> {
    const availability = await this.prisma.availability.findFirst({
      where: {
        id,
        ...(kind === 'regular' ? { dayOfWeek: { not: null } } : {}),
        ...(kind === 'exception' ? { specificDate: { not: null } } : {}),
      },
    });
    if (!availability) {
      throw new NotFoundException(NOT_FOUND_MESSAGES[kind]);
    }
    return availability;
  }
}

function scheduleOf(availability: Availability): DaySchedule | null {
  if (!availability.startTime || !availability.endTime) {
    return null;
  }
  return {
    opening: timeColumnToString(availability.startTime),
    closing: timeColumnToString(availability.endTime),
  };
}

/** Reglas cruzadas de una franja nueva (422 con los mensajes del legado). */
function validateNewAvailability(dto: CreateAvailabilityDto): void {
  const hasDay = dto.day_of_week !== undefined && dto.day_of_week !== null;
  const hasDate = dto.specific_date !== undefined && dto.specific_date !== null;
  const errors: string[] = [];

  if (!hasDay && !hasDate) {
    errors.push('Debe especificar day_of_week o specific_date');
  }
  if (hasDay && hasDate) {
    errors.push(
      'No puede especificar day_of_week y specific_date simultáneamente',
    );
  }
  if (dto.is_available && (!dto.start_time || !dto.end_time)) {
    errors.push('Una franja disponible debe tener start_time y end_time');
  }
  if (
    dto.start_time &&
    dto.end_time &&
    normalizeTime(dto.end_time) <= normalizeTime(dto.start_time)
  ) {
    errors.push('end_time debe ser posterior a start_time');
  }

  if (errors.length > 0) {
    throw new UnprocessableEntityException(errors);
  }
}
