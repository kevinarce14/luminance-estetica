import {
  AppointmentStatus,
  PaymentStatus,
  type PaymentMethod,
} from '../../generated/prisma/client';
import {
  addDays,
  toZonedParts,
  weekdayOf,
  zonedDayRange,
  zonedTimeToUtc,
} from '../../common/time/zoned-time';
import type { AppointmentStatusValue } from '../appointments/interfaces/appointment-response.interface';
import type {
  MonthSummary,
  PaymentMethodSummary,
  ServiceRanking,
  YearlyReport,
} from './interfaces/admin.interfaces';

/**
 * Cálculos de reportes como funciones puras (sin base): reciben las filas y las agrupan
 * por mes en la zona del studio. Ingresos = pagos aprobados según su fecha de aprobación;
 * turnos = según la fecha del turno (mismo criterio que el legado).
 */

export interface ApprovedPaymentRow {
  amount: number;
  approvedAt: Date | null;
  paymentMethod: PaymentMethod;
}

export interface ReportAppointmentRow {
  status: AppointmentStatus;
  date: Date;
  serviceName: string;
  payment: { status: PaymentStatus; amount: number } | null;
}

export interface Range {
  start: Date;
  end: Date;
}

/** Redondeo a centavos (evita 0.1 + 0.2 = 0.30000000000000004 en los totales). */
export function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/** [inicio, fin) de un mes calendario del studio, en UTC. */
export function monthRange(
  year: number,
  month: number,
  timeZone: string,
): Range {
  const pad = (value: number) => String(value).padStart(2, '0');
  const next =
    month === 12 ? { year: year + 1, month: 1 } : { year, month: month + 1 };
  return {
    start: zonedTimeToUtc(`${year}-${pad(month)}-01`, '00:00', timeZone),
    end: zonedTimeToUtc(
      `${next.year}-${pad(next.month)}-01`,
      '00:00',
      timeZone,
    ),
  };
}

export function yearRange(year: number, timeZone: string): Range {
  return {
    start: monthRange(year, 1, timeZone).start,
    end: monthRange(year, 12, timeZone).end,
  };
}

/** Rangos del dashboard: hoy, semana (lunes a domingo) y mes, en la zona del studio. */
export function dashboardRanges(
  today: string,
  timeZone: string,
): { today: Range; week: Range; month: Range } {
  const mondayOffset = (weekdayOf(today) + 6) % 7;
  const monday = addDays(today, -mondayOffset);
  const [year, month] = today.split('-').map(Number);
  return {
    today: zonedDayRange(today, timeZone),
    week: {
      start: zonedDayRange(monday, timeZone).start,
      end: zonedDayRange(addDays(monday, 7), timeZone).start,
    },
    month: monthRange(year, month, timeZone),
  };
}

/** Mes (1–12) de un instante en la zona del studio. */
function studioMonth(instant: Date, timeZone: string): number {
  return Number(toZonedParts(instant, timeZone).date.slice(5, 7));
}

export function summarizePaymentMethods(
  payments: ApprovedPaymentRow[],
): PaymentMethodSummary[] {
  const byMethod = new Map<string, PaymentMethodSummary>();
  for (const payment of payments) {
    const method = payment.paymentMethod.toLowerCase();
    const summary = byMethod.get(method) ?? { method, count: 0, amount: 0 };
    summary.count += 1;
    summary.amount = round2(summary.amount + payment.amount);
    byMethod.set(method, summary);
  }
  return [...byMethod.values()].sort((a, b) => b.amount - a.amount);
}

export function countByStatus(
  appointments: Pick<ReportAppointmentRow, 'status'>[],
): Partial<Record<AppointmentStatusValue, number>> {
  const counts: Partial<Record<AppointmentStatusValue, number>> = {};
  for (const { status } of appointments) {
    const key = status.toLowerCase() as AppointmentStatusValue;
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}

/** Servicios más demandados (sin cancelados), con lo cobrado por cada uno. */
export function rankServices(
  appointments: ReportAppointmentRow[],
  limit?: number,
): ServiceRanking[] {
  const byName = new Map<string, ServiceRanking>();
  for (const appointment of appointments) {
    if (appointment.status === AppointmentStatus.CANCELLED) continue;
    const ranking = byName.get(appointment.serviceName) ?? {
      name: appointment.serviceName,
      appointments_count: 0,
      revenue: 0,
    };
    ranking.appointments_count += 1;
    if (appointment.payment?.status === PaymentStatus.APPROVED) {
      ranking.revenue = round2(ranking.revenue + appointment.payment.amount);
    }
    byName.set(appointment.serviceName, ranking);
  }
  const ranked = [...byName.values()].sort(
    (a, b) =>
      b.appointments_count - a.appointments_count ||
      a.name.localeCompare(b.name),
  );
  return limit === undefined ? ranked : ranked.slice(0, limit);
}

export function buildYearlyReport(input: {
  year: number;
  timeZone: string;
  payments: ApprovedPaymentRow[];
  appointments: ReportAppointmentRow[];
  newClients: number;
}): YearlyReport {
  const months: MonthSummary[] = Array.from({ length: 12 }, (_, index) => ({
    month: index + 1,
    revenue: 0,
    payments_count: 0,
    appointments_count: 0,
    completed_count: 0,
    cancelled_count: 0,
  }));

  for (const payment of input.payments) {
    if (!payment.approvedAt) continue;
    const summary = months[studioMonth(payment.approvedAt, input.timeZone) - 1];
    summary.revenue = round2(summary.revenue + payment.amount);
    summary.payments_count += 1;
  }
  for (const appointment of input.appointments) {
    const summary = months[studioMonth(appointment.date, input.timeZone) - 1];
    summary.appointments_count += 1;
    if (appointment.status === AppointmentStatus.COMPLETED)
      summary.completed_count += 1;
    if (appointment.status === AppointmentStatus.CANCELLED)
      summary.cancelled_count += 1;
  }

  const totalRevenue = round2(
    months.reduce((total, month) => total + month.revenue, 0),
  );
  const totalPayments = months.reduce(
    (total, month) => total + month.payments_count,
    0,
  );
  return {
    year: input.year,
    currency: 'ARS',
    total_revenue: totalRevenue,
    total_payments: totalPayments,
    average_ticket: totalPayments ? round2(totalRevenue / totalPayments) : 0,
    total_appointments: input.appointments.length,
    appointments_by_status: countByStatus(input.appointments),
    new_clients: input.newClients,
    months,
    top_services: rankServices(input.appointments, 10),
    payment_methods: summarizePaymentMethods(input.payments),
  };
}
