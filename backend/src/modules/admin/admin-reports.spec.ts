import {
  AppointmentStatus,
  PaymentMethod,
  PaymentStatus,
} from '../../generated/prisma/client';
import {
  buildYearlyReport,
  dashboardRanges,
  monthRange,
  rankServices,
  round2,
  type ReportAppointmentRow,
} from './admin-reports';

const TZ = 'America/Argentina/Buenos_Aires';

const appointment = (
  overrides: Partial<ReportAppointmentRow>,
): ReportAppointmentRow => ({
  status: AppointmentStatus.CONFIRMED,
  date: new Date('2026-10-15T13:00:00Z'),
  serviceName: 'Lifting de Pestañas',
  payment: null,
  ...overrides,
});

describe('rangos en la zona del studio', () => {
  it('un mes va de la medianoche del día 1 a la del mes siguiente (03:00Z)', () => {
    const { start, end } = monthRange(2026, 10, TZ);
    expect(start.toISOString()).toBe('2026-10-01T03:00:00.000Z');
    expect(end.toISOString()).toBe('2026-11-01T03:00:00.000Z');
    expect(monthRange(2026, 12, TZ).end.toISOString()).toBe(
      '2027-01-01T03:00:00.000Z',
    );
  });

  it('la semana del dashboard va de lunes a domingo', () => {
    // Miércoles 21/10/2026 → semana del lunes 19 al domingo 25.
    const ranges = dashboardRanges('2026-10-21', TZ);
    expect(ranges.week.start.toISOString()).toBe('2026-10-19T03:00:00.000Z');
    expect(ranges.week.end.toISOString()).toBe('2026-10-26T03:00:00.000Z');
    expect(ranges.today.start.toISOString()).toBe('2026-10-21T03:00:00.000Z');
    // Un domingo pertenece a la semana que empezó el lunes anterior.
    expect(dashboardRanges('2026-10-25', TZ).week.start.toISOString()).toBe(
      '2026-10-19T03:00:00.000Z',
    );
  });
});

describe('buildYearlyReport', () => {
  const report = buildYearlyReport({
    year: 2026,
    timeZone: TZ,
    newClients: 4,
    payments: [
      // 31/10 a las 22:00 en Buenos Aires (01:00Z del 1/11): cuenta en octubre.
      {
        amount: 15000,
        approvedAt: new Date('2026-11-01T01:00:00Z'),
        paymentMethod: PaymentMethod.MERCADOPAGO,
      },
      {
        amount: 8000,
        approvedAt: new Date('2026-10-10T15:00:00Z'),
        paymentMethod: PaymentMethod.CASH,
      },
      {
        amount: 8000,
        approvedAt: new Date('2026-03-05T15:00:00Z'),
        paymentMethod: PaymentMethod.CASH,
      },
    ],
    appointments: [
      appointment({
        status: AppointmentStatus.COMPLETED,
        payment: { status: PaymentStatus.APPROVED, amount: 15000 },
      }),
      appointment({ status: AppointmentStatus.PENDING }),
      appointment({
        status: AppointmentStatus.CANCELLED,
        serviceName: 'Henna de Cejas',
      }),
      appointment({
        serviceName: 'Henna de Cejas',
        date: new Date('2026-03-05T15:00:00Z'),
        payment: { status: PaymentStatus.APPROVED, amount: 8000 },
      }),
    ],
  });

  it('agrupa ingresos y turnos por mes del studio', () => {
    expect(report.months).toHaveLength(12);
    expect(report.months[9]).toEqual({
      month: 10,
      revenue: 23000,
      payments_count: 2,
      appointments_count: 3,
      completed_count: 1,
      cancelled_count: 1,
    });
    expect(report.months[10].revenue).toBe(0); // noviembre
    expect(report.months[2]).toMatchObject({
      revenue: 8000,
      appointments_count: 1,
    });
  });

  it('totales, ticket promedio, estados y clientes nuevos', () => {
    expect(report).toMatchObject({
      year: 2026,
      currency: 'ARS',
      total_revenue: 31000,
      total_payments: 3,
      average_ticket: 10333.33,
      total_appointments: 4,
      appointments_by_status: {
        completed: 1,
        pending: 1,
        cancelled: 1,
        confirmed: 1,
      },
      new_clients: 4,
    });
  });

  it('servicios más demandados sin cancelados y medios de pago por monto', () => {
    expect(report.top_services).toEqual([
      { name: 'Lifting de Pestañas', appointments_count: 2, revenue: 15000 },
      { name: 'Henna de Cejas', appointments_count: 1, revenue: 8000 },
    ]);
    expect(report.payment_methods).toEqual([
      { method: 'cash', count: 2, amount: 16000 },
      { method: 'mercadopago', count: 1, amount: 15000 },
    ]);
  });

  it('un año sin movimientos no divide por cero', () => {
    const empty = buildYearlyReport({
      year: 2030,
      timeZone: TZ,
      newClients: 0,
      payments: [],
      appointments: [],
    });
    expect(empty).toMatchObject({
      total_revenue: 0,
      average_ticket: 0,
      top_services: [],
    });
  });
});

describe('helpers', () => {
  it('redondea a centavos', () => {
    expect(round2(0.1 + 0.2)).toBe(0.3);
  });

  it('el ranking desempata por nombre', () => {
    expect(
      rankServices([
        appointment({ serviceName: 'Zeta' }),
        appointment({ serviceName: 'Alfa' }),
      ]).map((ranking) => ranking.name),
    ).toEqual(['Alfa', 'Zeta']);
  });
});
