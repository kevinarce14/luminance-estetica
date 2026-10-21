import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import {
  addDays,
  weekdayOf,
  zonedTimeToUtc,
  zonedToday,
} from '../src/common/time/zoned-time';
import {
  AppointmentStatus,
  PaymentMethod,
  PaymentStatus,
} from '../src/generated/prisma/client';
import { MailService } from '../src/mail/mail.service';
import { PasswordService } from '../src/modules/users/password.service';
import { PrismaService } from '../src/prisma/prisma.service';

/**
 * Panel admin contra la base real. Los datos se crean directo con Prisma (estados y
 * fechas arbitrarias, incluso pasadas) para probar agenda, pagos, clientes y reportes.
 */

const TZ = 'America/Argentina/Buenos_Aires';
const EMAIL_DOMAIN = '@e2e-admin.example.com';
const SUFFIX = String(Date.now() % 100000);

function openDay(fromOffset: number): string {
  let day = addDays(zonedToday(TZ), fromOffset);
  while (weekdayOf(day) === 0) day = addDays(day, 1);
  return day;
}
const DAY = openDay(22);
const at = (date: string, time: string) => zonedTimeToUtc(date, time, TZ);

interface AdminAppointment {
  id: number;
  status: string;
  appointment_date: string;
  user: { id: number; full_name: string; email: string; phone: string | null };
  service: { id: number; name: string };
  payment: { id: number; status: string } | null;
}
interface ClientRow {
  id: number;
  email: string;
  is_active: boolean;
  appointments_count: number;
  completed_count: number;
  cancelled_count: number;
  last_appointment_date: string | null;
  total_paid: number;
}
type Who = 'ana' | 'bruno' | 'admin';

const mail = {
  sendWelcome: jest.fn(() => Promise.resolve(true)),
  sendAppointmentCancelled: jest.fn(() => Promise.resolve(true)),
  sendAppointmentRescheduled: jest.fn(() => Promise.resolve(true)),
  sendPaymentConfirmed: jest.fn(() => Promise.resolve(true)),
};

describe('Panel admin (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const tokens: Record<Who, string> = { ana: '', bruno: '', admin: '' };
  const ids: Record<Who, number> = { ana: 0, bruno: 0, admin: 0 };
  let lifting: { id: number; name: string; price: number };
  let henna: { id: number; name: string; price: number };
  /** Turnos de prueba: a1 pendiente, a2 confirmado (pagado en efectivo), past completado. */
  const apt = { a1: 0, a2: 0, past: 0 };
  const pay = { p1: 0, p2: 0 };

  const http = () => request(app.getHttpServer());
  const as = (who: Who) => ({ Authorization: `Bearer ${tokens[who]}` });
  const agenda = async (query: Record<string, string | number>) =>
    (
      await http()
        .get('/api/admin/appointments')
        .query(query)
        .set(as('admin'))
        .expect(200)
    ).body as AdminAppointment[];

  async function cleanUp(): Promise<void> {
    const user = { email: { endsWith: EMAIL_DOMAIN } };
    await prisma.payment.deleteMany({ where: { user } });
    await prisma.appointment.deleteMany({ where: { user } });
    await prisma.user.deleteMany({ where: user });
    await prisma.service.deleteMany({
      where: { name: { endsWith: `E2E ${SUFFIX}` } },
    });
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(MailService)
      .useValue(mail)
      .compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);
    await cleanUp();

    const hashed = await app.get(PasswordService).hash('Clave1234');
    const people: Array<[Who, string, string, boolean]> = [
      ['ana', 'Ana Agenda', '11 5151-0001', false],
      ['bruno', 'Bruno Balance', '11 6262-0002', false],
      ['admin', 'Admin Panel', '', true],
    ];
    for (const [who, fullName, phone, isAdmin] of people) {
      const email = `${who}.${SUFFIX}${EMAIL_DOMAIN}`;
      const user = await prisma.user.create({
        data: { email, fullName, phone, hashedPassword: hashed, isAdmin },
      });
      ids[who] = user.id;
      const login = await http()
        .post('/api/auth/login')
        .type('form')
        .send({ username: email, password: 'Clave1234' })
        .expect(200);
      tokens[who] = (login.body as { access_token: string }).access_token;
    }

    lifting = await prisma.service.findFirstOrThrow({
      where: { name: 'Lifting de Pestañas' },
    });
    henna = await prisma.service.findFirstOrThrow({
      where: { name: 'Henna de Cejas' },
    });

    apt.a1 = (
      await prisma.appointment.create({
        data: {
          userId: ids.ana,
          serviceId: lifting.id,
          appointmentDate: at(DAY, '10:00'),
          notes: 'Primera vez, piel sensible',
        },
      })
    ).id;
    apt.a2 = (
      await prisma.appointment.create({
        data: {
          userId: ids.bruno,
          serviceId: henna.id,
          appointmentDate: at(DAY, '12:00'),
          status: AppointmentStatus.CONFIRMED,
        },
      })
    ).id;
    apt.past = (
      await prisma.appointment.create({
        data: {
          userId: ids.ana,
          serviceId: lifting.id,
          appointmentDate: at(addDays(zonedToday(TZ), -3), '11:00'),
          status: AppointmentStatus.COMPLETED,
        },
      })
    ).id;
    pay.p1 = (
      await prisma.payment.create({
        data: {
          appointmentId: apt.a1,
          userId: ids.ana,
          amount: lifting.price,
          mercadopagoPreferenceId: 'pref-admin-e2e',
        },
      })
    ).id;
    pay.p2 = (
      await prisma.payment.create({
        data: {
          appointmentId: apt.a2,
          userId: ids.bruno,
          amount: henna.price,
          paymentMethod: PaymentMethod.CASH,
          status: PaymentStatus.APPROVED,
          approvedAt: new Date(),
        },
      })
    ).id;
    await prisma.payment.create({
      data: {
        appointmentId: apt.past,
        userId: ids.ana,
        amount: lifting.price,
        paymentMethod: PaymentMethod.TRANSFER,
        status: PaymentStatus.APPROVED,
        approvedAt: new Date(),
      },
    });
  });

  afterAll(async () => {
    await cleanUp();
    await app.close();
  });

  it('todas las rutas del panel exigen ser admin', async () => {
    for (const path of [
      '/api/admin/dashboard',
      '/api/admin/appointments',
      '/api/admin/payments',
      '/api/admin/clients',
      '/api/admin/reports/yearly?year=2026',
      '/api/admin/services',
    ]) {
      await http().get(path).expect(401);
      await http().get(path).set(as('ana')).expect(403);
    }
  });

  describe('Agenda (GET /admin/appointments)', () => {
    it('filtra por día y devuelve el contacto del cliente, servicio y pago', async () => {
      const rows = await agenda({ date: DAY });
      const ids = rows.map((row) => row.id);
      expect(ids).toEqual(expect.arrayContaining([apt.a1, apt.a2]));
      expect(ids).not.toContain(apt.past);
      expect(rows.find((row) => row.id === apt.a1)).toMatchObject({
        status: 'pending',
        user: {
          full_name: 'Ana Agenda',
          email: `ana.${SUFFIX}${EMAIL_DOMAIN}`,
          phone: '11 5151-0001',
        },
        service: { id: lifting.id, name: 'Lifting de Pestañas' },
        payment: { id: pay.p1, status: 'pending' },
      });
      // Orden ascendente por defecto: 10:00 antes que 12:00.
      expect(ids.indexOf(apt.a1)).toBeLessThan(ids.indexOf(apt.a2));
    });

    it('filtra por estado y por rango de fechas', async () => {
      const confirmed = await agenda({ date: DAY, status: 'confirmed' });
      expect(confirmed.map((row) => row.id)).toContain(apt.a2);
      expect(confirmed.every((row) => row.status === 'confirmed')).toBe(true);

      const range = await agenda({
        date_from: addDays(zonedToday(TZ), -5),
        date_to: addDays(zonedToday(TZ), -1),
        user_id: ids.ana,
      });
      expect(range.map((row) => row.id)).toEqual([apt.past]);
    });

    it('busca por teléfono (solo dígitos), #ID, servicio, notas o email', async () => {
      const idsFor = async (search: string) =>
        (await agenda({ search, date_from: addDays(zonedToday(TZ), -5) })).map(
          (row) => row.id,
        );
      expect(await idsFor('51510001')).toEqual(
        expect.arrayContaining([apt.a1, apt.past]),
      );
      expect(await idsFor(`#${apt.a2}`)).toContain(apt.a2);
      expect(await idsFor('piel sensible')).toEqual([apt.a1]);
      expect(await idsFor(`bruno.${SUFFIX}`)).toEqual([apt.a2]);
      const henna = await agenda({ search: 'HENNA', date: DAY });
      expect(henna.every((row) => row.service.name === 'Henna de Cejas')).toBe(
        true,
      );
    });

    it('historial de un cliente en orden descendente, con paginación', async () => {
      const history = await agenda({ user_id: ids.ana, order: 'desc' });
      expect(history.map((row) => row.id)).toEqual([apt.a1, apt.past]);
      const firstPage = await agenda({
        user_id: ids.ana,
        order: 'desc',
        limit: 1,
      });
      expect(firstPage.map((row) => row.id)).toEqual([apt.a1]);
      const secondPage = await agenda({
        user_id: ids.ana,
        order: 'desc',
        limit: 1,
        skip: 1,
      });
      expect(secondPage.map((row) => row.id)).toEqual([apt.past]);
    });

    it('valida los parámetros (422)', async () => {
      for (const query of [
        { date: '22/10/2026' },
        { status: 'pagado' },
        { order: 'random' },
        { limit: 5000 },
      ]) {
        await http()
          .get('/api/admin/appointments')
          .query(query)
          .set(as('admin'))
          .expect(422);
      }
    });

    it('próximos días y turnos de hoy (solo activos)', async () => {
      const upcoming = (
        await http()
          .get('/api/admin/appointments/upcoming')
          .query({ days: 30 })
          .set(as('admin'))
          .expect(200)
      ).body as AdminAppointment[];
      const upcomingIds = upcoming.map((row) => row.id);
      expect(upcomingIds).toEqual(expect.arrayContaining([apt.a1, apt.a2]));
      expect(upcomingIds).not.toContain(apt.past);
      const today = await http()
        .get('/api/admin/appointments/today')
        .set(as('admin'))
        .expect(200);
      expect(Array.isArray(today.body)).toBe(true);
    });

    it('las transiciones de la agenda reutilizan PUT /appointments/:id', async () => {
      const completed = await http()
        .put(`/api/appointments/${apt.past}`)
        .set(as('admin'))
        .send({ status: 'cancelled' })
        .expect(400);
      expect((completed.body as { message: string }).message).toBe(
        'No se puede modificar un turno que está completado o cancelado',
      );
    });
  });

  describe('Pagos (GET /admin/payments)', () => {
    it('lista con cliente y turno; filtra por estado, medio y búsqueda', async () => {
      const response = await http()
        .get('/api/admin/payments')
        .query({ status: 'approved', method: 'cash', search: 'Bruno' })
        .set(as('admin'))
        .expect(200);
      expect(response.body).toEqual([
        expect.objectContaining({
          id: pay.p2,
          status: 'approved',
          payment_method: 'cash',
          amount: henna.price,
          user: expect.objectContaining({
            full_name: 'Bruno Balance',
          }) as object,
          appointment: {
            id: apt.a2,
            appointment_date: at(DAY, '12:00').toISOString(),
            status: 'confirmed',
            service: expect.objectContaining({
              name: 'Henna de Cejas',
            }) as object,
          },
        }),
      ]);

      const byAppointmentId = await http()
        .get('/api/admin/payments')
        .query({ search: `#${apt.a1}` })
        .set(as('admin'))
        .expect(200);
      expect(
        (byAppointmentId.body as Array<{ id: number }>).map((row) => row.id),
      ).toContain(pay.p1);
    });
  });

  describe('Clientes (GET /admin/clients)', () => {
    it('métricas acumuladas por cliente', async () => {
      const response = await http()
        .get('/api/admin/clients')
        .query({ search: '5151-0001' })
        .set(as('admin'))
        .expect(200);
      expect(response.body).toEqual([
        expect.objectContaining({
          id: ids.ana,
          full_name: 'Ana Agenda',
          is_active: true,
          appointments_count: 2,
          completed_count: 1,
          cancelled_count: 0,
          last_appointment_date: at(DAY, '10:00').toISOString(),
          total_paid: lifting.price,
        }),
      ]);
    });

    it('activar/desactivar una cuenta y filtrar por estado; los admins no se listan', async () => {
      await http()
        .put(`/api/users/${ids.bruno}/toggle-active`)
        .set(as('admin'))
        .expect(200);
      const inactive = (
        await http()
          .get('/api/admin/clients')
          .query({ is_active: false, search: `bruno.${SUFFIX}` })
          .set(as('admin'))
          .expect(200)
      ).body as ClientRow[];
      expect(inactive).toEqual([
        expect.objectContaining({ id: ids.bruno, is_active: false }),
      ]);
      await http()
        .put(`/api/users/${ids.bruno}/toggle-active`)
        .set(as('admin'))
        .expect(200);

      const admins = await http()
        .get('/api/admin/clients')
        .query({ search: `admin.${SUFFIX}` })
        .set(as('admin'))
        .expect(200);
      expect(admins.body).toEqual([]);
    });
  });

  describe('ABM de servicios', () => {
    const payload = (name: string) => ({
      name,
      description: 'Masaje relajante con aceites',
      duration_minutes: 50,
      price: 9800,
      category: 'Corporal',
      image_url: null,
    });

    it('rutas del frontend: crear, editar, desactivar y eliminar', async () => {
      const name = `Masaje Descontracturante E2E ${SUFFIX}`;
      const created = await http()
        .post('/api/services/')
        .set(as('admin'))
        .send(payload(name))
        .expect(201);
      const service = created.body as {
        id: number;
        category: string;
        is_active: boolean;
        updated_at: string | null;
      };
      expect(created.body).toMatchObject({
        name,
        category: 'corporal',
        duration_minutes: 50,
        price: 9800,
        is_active: true,
        created_at: expect.any(String) as string,
      });

      const duplicate = await http()
        .post('/api/services/')
        .set(as('admin'))
        .send(payload(name))
        .expect(400);
      expect((duplicate.body as { message: string }).message).toBe(
        'Ya existe un servicio con ese nombre',
      );
      await http()
        .post('/api/services/')
        .set(as('admin'))
        .send({ ...payload(`Otro E2E ${SUFFIX}`), category: 'uñas' })
        .expect(422);

      const updated = await http()
        .put(`/api/services/${service.id}`)
        .set(as('admin'))
        .send({ price: 10500 })
        .expect(200);
      expect((updated.body as { price: number }).price).toBe(10500);

      const toggled = await http()
        .put(`/api/services/${service.id}/toggle-active`)
        .set(as('admin'))
        .expect(200);
      expect((toggled.body as { is_active: boolean }).is_active).toBe(false);
      const catalog = (
        await http().get('/api/services/?is_active=true').expect(200)
      ).body as Array<{ id: number }>;
      expect(catalog.map((item) => item.id)).not.toContain(service.id);
      const all = (
        await http().get('/api/services/admin/all').set(as('admin')).expect(200)
      ).body as Array<{ id: number }>;
      expect(all.map((item) => item.id)).toContain(service.id);

      await http()
        .delete(`/api/services/${service.id}`)
        .set(as('admin'))
        .expect(204);
      await http().get(`/api/services/${service.id}`).expect(404);
    });

    it('no elimina un servicio con turnos asociados', async () => {
      const response = await http()
        .delete(`/api/services/${lifting.id}`)
        .set(as('admin'))
        .expect(400);
      expect((response.body as { message: string }).message).toMatch(
        /^No se puede eliminar un servicio con turnos asociados/,
      );
      await http()
        .post('/api/services/')
        .set(as('ana'))
        .send(payload(`Ana E2E ${SUFFIX}`))
        .expect(403);
    });

    it('alias /admin/services con la misma lógica', async () => {
      const name = `Peeling E2E ${SUFFIX}`;
      const created = await http()
        .post('/api/admin/services')
        .set(as('admin'))
        .send(payload(name))
        .expect(201);
      const id = (created.body as { id: number }).id;
      await http()
        .put(`/api/admin/services/${id}`)
        .set(as('admin'))
        .send({ duration_minutes: 40 })
        .expect(200);
      await http()
        .put(`/api/admin/services/${id}/toggle-active`)
        .set(as('admin'))
        .expect(200);
      const list = (
        await http().get('/api/admin/services').set(as('admin')).expect(200)
      ).body as Array<{
        id: number;
        duration_minutes: number;
        is_active: boolean;
      }>;
      expect(list.find((item) => item.id === id)).toMatchObject({
        duration_minutes: 40,
        is_active: false,
      });
      await http()
        .delete(`/api/admin/services/${id}`)
        .set(as('admin'))
        .expect(204);
    });
  });

  describe('Dashboard y reportes', () => {
    it('el dashboard refleja turnos pendientes e ingresos cobrados del mes', async () => {
      const read = async () =>
        (await http().get('/api/admin/dashboard').set(as('admin')).expect(200))
          .body as {
          appointments: { pending_confirmation: number };
          revenue: { this_month: number; pending: number; currency: string };
          clients: { total: number };
          popular_services: Array<{ name: string; count: number }>;
        };
      const before = await read();
      expect(before.revenue.currency).toBe('ARS');

      const extra = await prisma.appointment.create({
        data: {
          userId: ids.bruno,
          serviceId: henna.id,
          appointmentDate: at(DAY, '15:00'),
        },
      });
      await prisma.appointment.create({
        data: {
          userId: ids.bruno,
          serviceId: henna.id,
          appointmentDate: at(DAY, '16:00'),
        },
      });
      await prisma.payment.create({
        data: {
          appointmentId: extra.id,
          userId: ids.bruno,
          amount: 4321,
          paymentMethod: PaymentMethod.CASH,
          status: PaymentStatus.APPROVED,
          approvedAt: new Date(),
        },
      });

      const after = await read();
      expect(after.appointments.pending_confirmation).toBe(
        before.appointments.pending_confirmation + 2,
      );
      expect(after.revenue.this_month).toBeCloseTo(
        before.revenue.this_month + 4321,
        2,
      );
      // El turno de las 16:00 está activo y sin pago: suma al ingreso estimado.
      expect(after.revenue.pending).toBeCloseTo(
        before.revenue.pending + henna.price,
        2,
      );
      expect(after.popular_services.length).toBeGreaterThan(0);
    });

    it('reporte anual por mes del studio (año sin otros datos)', async () => {
      const march = await prisma.appointment.create({
        data: {
          userId: ids.ana,
          serviceId: lifting.id,
          appointmentDate: at('2099-03-10', '10:00'),
          status: AppointmentStatus.COMPLETED,
        },
      });
      await prisma.payment.create({
        data: {
          appointmentId: march.id,
          userId: ids.ana,
          amount: 15000,
          paymentMethod: PaymentMethod.MERCADOPAGO,
          status: PaymentStatus.APPROVED,
          // 31/03 22:30 en Buenos Aires = 01:30Z del 1/04: cuenta en marzo.
          approvedAt: new Date('2099-04-01T01:30:00Z'),
        },
      });
      await prisma.appointment.create({
        data: {
          userId: ids.bruno,
          serviceId: henna.id,
          appointmentDate: at('2099-03-11', '10:00'),
          status: AppointmentStatus.CANCELLED,
        },
      });

      const response = await http()
        .get('/api/admin/reports/yearly')
        .query({ year: 2099 })
        .set(as('admin'))
        .expect(200);
      const report = response.body as {
        months: Array<{
          month: number;
          revenue: number;
          appointments_count: number;
          cancelled_count: number;
        }>;
      } & Record<string, unknown>;
      expect(report).toMatchObject({
        year: 2099,
        currency: 'ARS',
        total_revenue: 15000,
        total_payments: 1,
        average_ticket: 15000,
        total_appointments: 2,
        appointments_by_status: { completed: 1, cancelled: 1 },
        top_services: [
          {
            name: 'Lifting de Pestañas',
            appointments_count: 1,
            revenue: 15000,
          },
        ],
        payment_methods: [{ method: 'mercadopago', count: 1, amount: 15000 }],
      });
      expect(report.months[2]).toMatchObject({
        month: 3,
        revenue: 15000,
        appointments_count: 2,
        cancelled_count: 1,
      });
      expect(report.months[3].revenue).toBe(0);

      const monthly = await http()
        .get('/api/admin/reports/monthly')
        .query({ year: 2099, month: 3 })
        .set(as('admin'))
        .expect(200);
      expect(monthly.body).toMatchObject({
        period: {
          year: 2099,
          month: 3,
          start_date: '2099-03-01T03:00:00.000Z',
          end_date: '2099-04-01T03:00:00.000Z',
        },
        revenue: { total: 15000, currency: 'ARS' },
      });

      await http()
        .get('/api/admin/reports/yearly')
        .query({ year: 2019 })
        .set(as('admin'))
        .expect(422);
    });
  });
});
