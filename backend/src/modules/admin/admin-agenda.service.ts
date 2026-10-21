import { Injectable } from '@nestjs/common';
import {
  AppointmentStatus,
  PaymentMethod,
  PaymentStatus,
  Prisma,
} from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { addDays, zonedDayRange } from '../../common/time/zoned-time';
import { StudioClock } from '../availability/studio-clock';
import {
  containsInsensitive,
  parseAdminSearch,
  userMatches,
} from './admin-search';
import {
  AdminAppointmentsQueryDto,
  AdminPaymentsQueryDto,
} from './dto/admin-query.dto';
import {
  CONTACT_SELECT,
  type AdminAppointmentRow,
  type AdminPaymentRow,
} from './interfaces/admin.interfaces';

const ACTIVE_STATUSES: AppointmentStatus[] = [
  AppointmentStatus.PENDING,
  AppointmentStatus.CONFIRMED,
];

const AGENDA_INCLUDE = {
  user: { select: CONTACT_SELECT },
  service: true,
  payment: true,
} as const;

/** Agenda y pagos del panel admin. */
@Injectable()
export class AdminAgendaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: StudioClock,
  ) {}

  /**
   * GET /admin/appointments: todos los turnos (pasados y futuros, cualquier estado) con
   * filtros combinables por día o rango (hora del studio), estado, cliente y búsqueda.
   */
  async listAppointments(
    query: AdminAppointmentsQueryDto,
  ): Promise<AdminAppointmentRow[]> {
    const tz = this.clock.timeZone;
    const dateFilter: Prisma.DateTimeFilter = {};
    if (query.date) {
      const { start, end } = zonedDayRange(query.date, tz);
      dateFilter.gte = start;
      dateFilter.lt = end;
    }
    if (query.date_from) {
      const { start } = zonedDayRange(query.date_from, tz);
      if (!dateFilter.gte || start > (dateFilter.gte as Date)) {
        dateFilter.gte = start;
      }
    }
    if (query.date_to) {
      const { start } = zonedDayRange(addDays(query.date_to, 1), tz);
      if (!dateFilter.lt || start < (dateFilter.lt as Date)) {
        dateFilter.lt = start;
      }
    }

    const where: Prisma.AppointmentWhereInput = {
      ...(Object.keys(dateFilter).length > 0
        ? { appointmentDate: dateFilter }
        : {}),
      ...(query.status
        ? { status: query.status.toUpperCase() as AppointmentStatus }
        : {}),
      ...(query.user_id ? { userId: query.user_id } : {}),
    };

    const search = await parseAdminSearch(this.prisma, query.search);
    if (search) {
      const like = containsInsensitive(search.text);
      where.OR = [
        ...userMatches(search).map((user) => ({ user })),
        { service: { name: like } },
        { notes: like },
        ...(search.id !== undefined ? [{ id: search.id }] : []),
      ];
    }

    return this.prisma.appointment.findMany({
      where,
      include: AGENDA_INCLUDE,
      orderBy: [{ appointmentDate: query.order }, { id: 'asc' }],
      skip: query.skip,
      take: query.limit,
    });
  }

  /** Turnos activos de los próximos `days` días. */
  listUpcoming(days: number): Promise<AdminAppointmentRow[]> {
    const now = this.clock.now();
    return this.prisma.appointment.findMany({
      where: {
        appointmentDate: {
          gte: now,
          lte: new Date(now.getTime() + days * 24 * 60 * 60 * 1000),
        },
        status: { in: ACTIVE_STATUSES },
      },
      include: AGENDA_INCLUDE,
      orderBy: { appointmentDate: 'asc' },
    });
  }

  /** Turnos activos de hoy (día del studio). */
  listToday(): Promise<AdminAppointmentRow[]> {
    const { start, end } = zonedDayRange(
      this.clock.today(),
      this.clock.timeZone,
    );
    return this.prisma.appointment.findMany({
      where: {
        appointmentDate: { gte: start, lt: end },
        status: { in: ACTIVE_STATUSES },
      },
      include: AGENDA_INCLUDE,
      orderBy: { appointmentDate: 'asc' },
    });
  }

  /** GET /admin/payments: pagos con cliente y turno, del más reciente al más antiguo. */
  async listPayments(query: AdminPaymentsQueryDto): Promise<AdminPaymentRow[]> {
    const where: Prisma.PaymentWhereInput = {
      ...(query.status
        ? { status: query.status.toUpperCase() as PaymentStatus }
        : {}),
      ...(query.method
        ? { paymentMethod: query.method.toUpperCase() as PaymentMethod }
        : {}),
    };

    const search = await parseAdminSearch(this.prisma, query.search);
    if (search) {
      where.OR = [
        ...userMatches(search).map((user) => ({ user })),
        {
          appointment: {
            service: { name: containsInsensitive(search.text) },
          },
        },
        ...(search.id !== undefined ? [{ appointmentId: search.id }] : []),
      ];
    }

    return this.prisma.payment.findMany({
      where,
      include: {
        user: { select: CONTACT_SELECT },
        appointment: { include: { service: true } },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip: query.skip,
      take: query.limit,
    });
  }
}
