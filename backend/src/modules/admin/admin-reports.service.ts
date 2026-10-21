import { Injectable } from '@nestjs/common';
import {
  AppointmentStatus,
  PaymentStatus,
  type Prisma,
} from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { StudioClock } from '../availability/studio-clock';
import {
  buildYearlyReport,
  countByStatus,
  dashboardRanges,
  monthRange,
  rankServices,
  round2,
  summarizePaymentMethods,
  yearRange,
  type Range,
  type ReportAppointmentRow,
} from './admin-reports';
import type {
  DashboardMetrics,
  MonthlyReport,
  YearlyReport,
} from './interfaces/admin.interfaces';

const ACTIVE_STATUSES: AppointmentStatus[] = [
  AppointmentStatus.PENDING,
  AppointmentStatus.CONFIRMED,
];

/** Dashboard y reportes del panel admin. */
@Injectable()
export class AdminReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: StudioClock,
  ) {}

  /**
   * Métricas del día, la semana (lunes a domingo) y el mes en curso, ingresos cobrados
   * vs. estimados (turnos activos todavía sin pago) y servicios más reservados del mes.
   */
  async getDashboard(): Promise<DashboardMetrics> {
    const ranges = dashboardRanges(this.clock.today(), this.clock.timeZone);
    const activeIn = (range: Range): Prisma.AppointmentWhereInput => ({
      appointmentDate: { gte: range.start, lt: range.end },
      status: { in: ACTIVE_STATUSES },
    });

    const [
      totalClients,
      newClients,
      today,
      thisWeek,
      thisMonth,
      pendingConfirmation,
      monthRevenue,
      unpaid,
      popular,
    ] = await Promise.all([
      this.prisma.user.count({ where: { isAdmin: false } }),
      this.prisma.user.count({
        where: { isAdmin: false, createdAt: { gte: ranges.month.start } },
      }),
      this.prisma.appointment.count({ where: activeIn(ranges.today) }),
      this.prisma.appointment.count({ where: activeIn(ranges.week) }),
      this.prisma.appointment.count({ where: activeIn(ranges.month) }),
      this.prisma.appointment.count({
        where: { status: AppointmentStatus.PENDING },
      }),
      this.prisma.payment.aggregate({
        where: {
          status: PaymentStatus.APPROVED,
          approvedAt: { gte: ranges.month.start, lt: ranges.month.end },
        },
        _sum: { amount: true },
      }),
      this.prisma.appointment.findMany({
        where: { status: { in: ACTIVE_STATUSES }, payment: null },
        select: { service: { select: { price: true } } },
      }),
      this.prisma.appointment.groupBy({
        by: ['serviceId'],
        where: { createdAt: { gte: ranges.month.start, lt: ranges.month.end } },
        _count: { serviceId: true },
        orderBy: { _count: { serviceId: 'desc' } },
        take: 5,
      }),
    ]);

    const services = await this.prisma.service.findMany({
      where: { id: { in: popular.map((row) => row.serviceId) } },
      select: { id: true, name: true },
    });
    const nameOf = new Map(
      services.map((service) => [service.id, service.name]),
    );

    return {
      clients: { total: totalClients, new_this_month: newClients },
      appointments: {
        today,
        this_week: thisWeek,
        this_month: thisMonth,
        pending_confirmation: pendingConfirmation,
      },
      revenue: {
        this_month: round2(monthRevenue._sum.amount ?? 0),
        pending: round2(
          unpaid.reduce((total, row) => total + row.service.price, 0),
        ),
        currency: 'ARS',
      },
      popular_services: popular.map((row) => ({
        name: nameOf.get(row.serviceId) ?? `Servicio #${row.serviceId}`,
        count: row._count.serviceId,
      })),
    };
  }

  async getYearlyReport(year: number): Promise<YearlyReport> {
    const range = yearRange(year, this.clock.timeZone);
    const [payments, appointments, newClients] = await Promise.all([
      this.approvedPaymentsIn(range),
      this.appointmentsWhere({
        appointmentDate: { gte: range.start, lt: range.end },
      }),
      this.newClientsIn(range),
    ]);
    return buildYearlyReport({
      year,
      timeZone: this.clock.timeZone,
      payments,
      appointments,
      newClients,
    });
  }

  /** Reporte mensual del legado: los turnos se cuentan por su fecha de creación (reservas del mes). */
  async getMonthlyReport(year: number, month: number): Promise<MonthlyReport> {
    const range = monthRange(year, month, this.clock.timeZone);
    const [payments, appointments, newClients] = await Promise.all([
      this.approvedPaymentsIn(range),
      this.appointmentsWhere({
        createdAt: { gte: range.start, lt: range.end },
      }),
      this.newClientsIn(range),
    ]);
    return {
      period: {
        year,
        month,
        start_date: range.start.toISOString(),
        end_date: range.end.toISOString(),
      },
      appointments: {
        total: appointments.length,
        by_status: countByStatus(appointments),
      },
      revenue: {
        total: round2(
          payments.reduce((total, payment) => total + payment.amount, 0),
        ),
        currency: 'ARS',
        by_payment_method: summarizePaymentMethods(payments),
      },
      services: rankServices(appointments),
      new_clients: newClients,
    };
  }

  private approvedPaymentsIn(range: Range) {
    return this.prisma.payment.findMany({
      where: {
        status: PaymentStatus.APPROVED,
        approvedAt: { gte: range.start, lt: range.end },
      },
      select: { amount: true, approvedAt: true, paymentMethod: true },
    });
  }

  private async appointmentsWhere(
    where: Prisma.AppointmentWhereInput,
  ): Promise<ReportAppointmentRow[]> {
    const rows = await this.prisma.appointment.findMany({
      where,
      select: {
        status: true,
        appointmentDate: true,
        service: { select: { name: true } },
        payment: { select: { status: true, amount: true } },
      },
    });
    return rows.map((row) => ({
      status: row.status,
      date: row.appointmentDate,
      serviceName: row.service.name,
      payment: row.payment,
    }));
  }

  private newClientsIn(range: Range): Promise<number> {
    return this.prisma.user.count({
      where: { isAdmin: false, createdAt: { gte: range.start, lt: range.end } },
    });
  }
}
