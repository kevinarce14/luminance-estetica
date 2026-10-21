import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { addDays, weekdayOf, zonedToday } from '../src/common/time/zoned-time';
import { MailService } from '../src/mail/mail.service';
import { PasswordService } from '../src/modules/users/password.service';
import { PrismaService } from '../src/prisma/prisma.service';

/**
 * Disponibilidad y turnos contra la base real con migraciones + seed
 * (horario Lunes a Sábado 09:00–20:00 y el catálogo de servicios).
 */

const TZ = 'America/Argentina/Buenos_Aires';
const EMAIL_DOMAIN = '@e2e-appt.example.com';

/** Próximo día con atención (no domingo) a partir de `fromOffset` días. */
function openDay(fromOffset: number): string {
  let day = addDays(zonedToday(TZ), fromOffset);
  while (weekdayOf(day) === 0) day = addDays(day, 1);
  return day;
}

/** Próximo domingo dentro de los 30 días. */
function nextSunday(): string {
  let day = addDays(zonedToday(TZ), 1);
  while (weekdayOf(day) !== 0) day = addDays(day, 1);
  return day;
}

const DAY = openDay(10);
const OTHER_DAY = openDay(12);
const local = (date: string, time: string) => `${date}T${time}:00-03:00`;

interface Slot {
  start_time: string;
  end_time: string;
  is_available: boolean;
}
interface SlotsBody {
  date: string;
  service_id: number;
  service_name: string;
  duration_minutes: number;
  available_slots: Slot[];
}
interface AppointmentBody {
  id: number;
  user_id: number;
  service_id: number;
  appointment_date: string;
  status: string;
  notes: string | null;
  cancelled_at: string | null;
  cancellation_reason: string | null;
}
interface MessageBody {
  message: string | string[];
}

const mail = {
  sendWelcome: jest.fn(() => Promise.resolve(true)),
  sendPasswordReset: jest.fn(() => Promise.resolve(true)),
  sendPasswordChanged: jest.fn(() => Promise.resolve(true)),
  sendAppointmentCancelled: jest.fn(() => Promise.resolve(true)),
  sendAppointmentRescheduled: jest.fn(() => Promise.resolve(true)),
};

describe('Disponibilidad y turnos (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const tokens: Record<'ana' | 'bruno' | 'admin', string> = {
    ana: '',
    bruno: '',
    admin: '',
  };
  let lifting: number; // 60 min
  let henna: number; // 30 min

  const http = () => request(app.getHttpServer());
  const as = (who: keyof typeof tokens) => ({
    Authorization: `Bearer ${tokens[who]}`,
  });

  async function slots(serviceId: number, date = DAY): Promise<SlotsBody> {
    const response = await http()
      .post('/api/availability/available-slots')
      .send({ service_id: serviceId, date })
      .expect(200);
    return response.body as SlotsBody;
  }

  const availableAt = (body: SlotsBody) =>
    body.available_slots
      .filter((slot) => slot.is_available)
      .map((slot) => slot.start_time.slice(11, 16));

  async function book(
    who: keyof typeof tokens,
    serviceId: number,
    time: string,
    date = DAY,
  ): Promise<AppointmentBody> {
    const response = await http()
      .post('/api/appointments/')
      .set(as(who))
      .send({
        service_id: serviceId,
        appointment_date: local(date, time),
        notes: '',
      })
      .expect(201);
    return response.body as AppointmentBody;
  }

  async function confirm(id: number): Promise<void> {
    await http()
      .put(`/api/appointments/${id}`)
      .set(as('admin'))
      .send({ status: 'confirmed' })
      .expect(200);
  }

  async function cleanUp(): Promise<void> {
    const users = { email: { endsWith: EMAIL_DOMAIN } };
    await prisma.appointment.deleteMany({ where: { user: users } });
    await prisma.user.deleteMany({ where: users });
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
    for (const [who, isAdmin] of [
      ['ana', false],
      ['bruno', false],
      ['admin', true],
    ] as const) {
      const email = `${who}.${Date.now()}${EMAIL_DOMAIN}`;
      await prisma.user.create({
        data: {
          email,
          fullName: `${who} E2E`,
          hashedPassword: hashed,
          isAdmin,
        },
      });
      const login = await http()
        .post('/api/auth/login')
        .type('form')
        .send({ username: email, password: 'Clave1234' })
        .expect(200);
      tokens[who] = (login.body as { access_token: string }).access_token;
    }

    const byName = async (name: string) =>
      (await prisma.service.findFirstOrThrow({ where: { name } })).id;
    lifting = await byName('Lifting de Pestañas');
    henna = await byName('Henna de Cejas');

    // Los tests asumen el horario del seed: Lunes a Sábado de 09:00 a 20:00.
    const check = await http()
      .get(`/api/availability/check/${DAY}`)
      .expect(200);
    expect(check.body).toMatchObject({
      is_available: true,
      start_time: '09:00:00',
    });
  });

  beforeEach(() => jest.clearAllMocks());

  afterAll(async () => {
    await cleanUp();
    await app.close();
  });

  describe('Horarios libres', () => {
    it('POST /available-slots: grilla cada 30 min en hora local, sin offset', async () => {
      const body = await slots(lifting);
      expect(body).toMatchObject({
        date: DAY,
        service_id: lifting,
        service_name: 'Lifting de Pestañas',
        duration_minutes: 60,
      });
      expect(body.available_slots[0]).toEqual({
        start_time: `${DAY}T09:00:00`,
        end_time: `${DAY}T10:00:00`,
        is_available: true,
      });
      const last = body.available_slots[body.available_slots.length - 1];
      expect(last.start_time).toBe(`${DAY}T19:00:00`); // 19:00 + 60 min = cierre
      expect(body.available_slots).toHaveLength(21);
    });

    it('GET /available-slots (alias) responde lo mismo', async () => {
      const response = await http()
        .get('/api/availability/available-slots')
        .query({ service_id: lifting, date: DAY })
        .expect(200);
      expect(response.body).toEqual(await slots(lifting));
    });

    it('domingo cerrado: lista vacía; servicio inexistente 404; fecha inválida 422', async () => {
      expect((await slots(lifting, nextSunday())).available_slots).toEqual([]);
      await http()
        .post('/api/availability/available-slots')
        .send({ service_id: 999999, date: DAY })
        .expect(404);
      await http()
        .post('/api/availability/available-slots')
        .send({ service_id: lifting, date: '2026-02-30' })
        .expect(422);
    });

    it('más allá de MAX_BOOKING_ADVANCE_DAYS los bloques existen pero no son reservables', async () => {
      const far = openDay(40);
      const body = await slots(lifting, far);
      expect(body.available_slots.length).toBeGreaterThan(0);
      expect(availableAt(body)).toEqual([]);
    });
  });

  describe('Reservas', () => {
    it('crea el turno PENDING (201) y la fecha vuelve en UTC', async () => {
      await http()
        .post('/api/appointments/')
        .send({ service_id: lifting, appointment_date: local(DAY, '09:00') })
        .expect(401);

      const appointment = await book('ana', lifting, '09:00');
      expect(appointment).toMatchObject({
        service_id: lifting,
        status: 'pending',
        notes: '',
        appointment_date: new Date(local(DAY, '09:00')).toISOString(),
        cancelled_at: null,
      });
    });

    it('solo un turno CONFIRMED ocupa el horario, con la duración de su servicio', async () => {
      const pending = await book('ana', lifting, '11:00');
      expect(availableAt(await slots(lifting))).toContain('11:00');

      await confirm(pending.id);
      // Lifting confirmado 11:00–12:00: un Lifting (60') no entra a las 10:30, 11:00 ni 11:30.
      const liftingSlots = availableAt(await slots(lifting));
      expect(liftingSlots).toEqual(expect.arrayContaining(['10:00', '12:00']));
      expect(liftingSlots).not.toEqual(expect.arrayContaining(['10:30']));
      expect(liftingSlots).not.toContain('11:00');
      expect(liftingSlots).not.toContain('11:30');
      // Una Henna (30') sí entra a las 10:30 y a las 12:00, pero no a las 11:00 ni 11:30.
      const hennaSlots = availableAt(await slots(henna));
      expect(hennaSlots).toEqual(expect.arrayContaining(['10:30', '12:00']));
      expect(hennaSlots).not.toContain('11:00');
      expect(hennaSlots).not.toContain('11:30');

      const conflict = await http()
        .post('/api/appointments/')
        .set(as('bruno'))
        .send({ service_id: henna, appointment_date: local(DAY, '11:30') })
        .expect(400);
      expect((conflict.body as MessageBody).message).toBe(
        'Este horario no está disponible',
      );

      const booked = await http()
        .get('/api/appointments/public/confirmed')
        .expect(200);
      expect(booked.body).toContainEqual({
        appointment_date: new Date(local(DAY, '11:00')).toISOString(),
        duration_minutes: 60,
      });
      for (const slot of booked.body as object[]) {
        expect(Object.keys(slot).sort()).toEqual([
          'appointment_date',
          'duration_minutes',
        ]);
      }
    });

    it('valida fecha futura, anticipación, máximo de días y horario de atención', async () => {
      const cases: Array<[string, number, string | RegExp]> = [
        [local(addDays(zonedToday(TZ), -1), '10:00'), 422, /en el futuro/],
        [
          new Date(Date.now() + 60 * 60 * 1000).toISOString(),
          400,
          'Debes reservar con al menos 2 horas de anticipación',
        ],
        [
          local(openDay(40), '10:00'),
          400,
          'No puedes reservar con más de 30 días de anticipación',
        ],
        [
          local(nextSunday(), '10:00'),
          400,
          'El estudio está cerrado en esta fecha',
        ],
        [
          local(DAY, '08:30'),
          400,
          'Fuera del horario de atención (09:00 - 20:00)',
        ],
        [
          local(DAY, '19:30'),
          400,
          'El turno se extendería más allá del horario de cierre',
        ],
      ];
      for (const [appointmentDate, status, message] of cases) {
        const response = await http()
          .post('/api/appointments/')
          .set(as('bruno'))
          .send({ service_id: lifting, appointment_date: appointmentDate })
          .expect(status);
        const actual = (response.body as MessageBody).message;
        expect(Array.isArray(actual) ? actual.join(' ') : actual).toMatch(
          message,
        );
      }

      await http()
        .post('/api/appointments/')
        .set(as('bruno'))
        .send({ service_id: lifting, appointment_date: 'mañana a las 10' })
        .expect(422);
    });
  });

  describe('Consultas y permisos', () => {
    it('GET /appointments: los turnos propios con servicio, usuario y pago', async () => {
      const mine = await book('bruno', henna, '15:00');
      const response = await http()
        .get('/api/appointments/')
        .set(as('bruno'))
        .expect(200);
      const list = response.body as Array<
        AppointmentBody & Record<string, unknown>
      >;
      expect(list.every((item) => item.user_id === mine.user_id)).toBe(true);
      expect(list.find((item) => item.id === mine.id)).toMatchObject({
        user: { id: mine.user_id, full_name: 'bruno E2E' },
        service: { id: henna, name: 'Henna de Cejas', duration_minutes: 30 },
        payment: null,
      });

      await http()
        .get(`/api/appointments/${mine.id}`)
        .set(as('ana'))
        .expect(403);
      await http()
        .get(`/api/appointments/${mine.id}`)
        .set(as('admin'))
        .expect(200);
      await http()
        .get('/api/appointments/999999999')
        .set(as('bruno'))
        .expect(404);
      await http().get('/api/appointments/abc').set(as('bruno')).expect(422);
    });

    it('GET /users/me/appointments separa próximos y pasados', async () => {
      const upcoming = await book('ana', henna, '16:00', OTHER_DAY);
      const toCancel = await book('ana', henna, '16:30', OTHER_DAY);
      await http()
        .post(`/api/appointments/${toCancel.id}/cancel`)
        .set(as('ana'))
        .send({ cancellation_reason: 'Ya no puedo ir' })
        .expect(200);

      const ids = async (query: Record<string, string>) => {
        const response = await http()
          .get('/api/users/me/appointments')
          .query(query)
          .set(as('ana'))
          .expect(200);
        return (response.body as AppointmentBody[]).map((item) => item.id);
      };

      const all = await ids({});
      expect(all).toEqual(expect.arrayContaining([upcoming.id, toCancel.id]));
      const next = await ids({ when: 'upcoming' });
      expect(next).toContain(upcoming.id);
      expect(next).not.toContain(toCancel.id);
      const past = await ids({ when: 'past' });
      expect(past).toContain(toCancel.id);
      expect(past).not.toContain(upcoming.id);

      await http()
        .get('/api/users/me/appointments')
        .query({ when: 'ayer' })
        .set(as('ana'))
        .expect(422);
      await http().get('/api/users/me/appointments').expect(401);
    });
  });

  describe('Cancelación y cambios de estado', () => {
    it('cancelar exige motivo, valida dueño y no se repite', async () => {
      const appointment = await book('ana', henna, '17:00');

      await http()
        .post(`/api/appointments/${appointment.id}/cancel`)
        .set(as('ana'))
        .send({ cancellation_reason: 'no' })
        .expect(422);
      const forbidden = await http()
        .post(`/api/appointments/${appointment.id}/cancel`)
        .set(as('bruno'))
        .send({ cancellation_reason: 'No es mío' })
        .expect(403);
      expect((forbidden.body as MessageBody).message).toBe(
        'No tienes permiso para cancelar este turno',
      );

      const cancelled = await http()
        .post(`/api/appointments/${appointment.id}/cancel`)
        .set(as('ana'))
        .send({ cancellation_reason: 'Surgió un imprevisto' })
        .expect(200);
      expect(cancelled.body).toMatchObject({
        status: 'cancelled',
        cancellation_reason: 'Surgió un imprevisto',
        cancelled_at: expect.any(String) as string,
      });
      expect(mail.sendAppointmentCancelled).toHaveBeenCalledTimes(1);

      await http()
        .post(`/api/appointments/${appointment.id}/cancel`)
        .set(as('ana'))
        .send({ cancellation_reason: 'Otra vez' })
        .expect(400);
    });

    it('PATCH /:id/cancel (alias) y el admin puede cancelar turnos ajenos', async () => {
      const appointment = await book('bruno', henna, '17:30');
      const response = await http()
        .patch(`/api/appointments/${appointment.id}/cancel`)
        .set(as('admin'))
        .send({ cancellation_reason: 'Cierre del studio' })
        .expect(200);
      expect((response.body as AppointmentBody).status).toBe('cancelled');
    });

    it('PUT: solo el admin cambia el estado y con transiciones válidas', async () => {
      const appointment = await book('ana', henna, '18:00');
      const byClient = await http()
        .put(`/api/appointments/${appointment.id}`)
        .set(as('ana'))
        .send({ status: 'confirmed' })
        .expect(403);
      expect((byClient.body as MessageBody).message).toBe(
        'Solo un administrador puede cambiar el estado del turno',
      );

      const invalid = await http()
        .put(`/api/appointments/${appointment.id}`)
        .set(as('admin'))
        .send({ status: 'COMPLETED' })
        .expect(400);
      expect((invalid.body as MessageBody).message).toBe(
        "No se puede pasar un turno de 'pending' a 'completed'",
      );

      const rescheduled = await http()
        .put(`/api/appointments/${appointment.id}`)
        .set(as('ana'))
        .send({ appointment_date: local(DAY, '18:30'), notes: 'Llego justo' })
        .expect(200);
      expect(rescheduled.body).toMatchObject({
        appointment_date: new Date(local(DAY, '18:30')).toISOString(),
        notes: 'Llego justo',
      });
      expect(mail.sendAppointmentRescheduled).toHaveBeenCalledTimes(1);
    });

    it('no se confirma un turno que pisa a otro ya confirmado', async () => {
      const first = await book('ana', lifting, '13:00');
      const second = await book('bruno', henna, '13:30');
      await confirm(first.id);
      const response = await http()
        .put(`/api/appointments/${second.id}`)
        .set(as('admin'))
        .send({ status: 'confirmed' })
        .expect(400);
      expect((response.body as MessageBody).message).toBe(
        'Ya hay un turno confirmado que se superpone con este horario',
      );
    });

    it('DELETE solo admin (204)', async () => {
      const appointment = await book('bruno', henna, '14:00', OTHER_DAY);
      await http()
        .delete(`/api/appointments/${appointment.id}`)
        .set(as('bruno'))
        .expect(403);
      await http()
        .delete(`/api/appointments/${appointment.id}`)
        .set(as('admin'))
        .expect(204);
      await http()
        .get(`/api/appointments/${appointment.id}`)
        .set(as('admin'))
        .expect(404);
    });
  });

  describe('Administración de disponibilidad', () => {
    it('una excepción cierra el día: sin bloques y sin reservas', async () => {
      const closedDay = openDay(14);
      const created = await http()
        .post('/api/availability/exceptions')
        .set(as('admin'))
        .send({
          specific_date: closedDay,
          start_time: null,
          end_time: null,
          is_available: false,
        })
        .expect(201);
      const exception = created.body as { id: number; specific_date: string };
      expect(exception.specific_date).toBe(closedDay);

      try {
        expect((await slots(lifting, closedDay)).available_slots).toEqual([]);
        const response = await http()
          .post('/api/appointments/')
          .set(as('ana'))
          .send({
            service_id: lifting,
            appointment_date: local(closedDay, '10:00'),
          })
          .expect(400);
        expect((response.body as MessageBody).message).toBe(
          'El estudio está cerrado en esta fecha',
        );

        const list = await http()
          .get('/api/availability/exceptions?future_only=true')
          .set(as('admin'))
          .expect(200);
        expect(
          (list.body as Array<{ id: number }>).map((item) => item.id),
        ).toContain(exception.id);

        await http()
          .post('/api/availability/exceptions')
          .set(as('admin'))
          .send({ specific_date: closedDay, is_available: false })
          .expect(400);
      } finally {
        await http()
          .delete(`/api/availability/exceptions/${exception.id}`)
          .set(as('admin'))
          .expect(204);
      }
      expect(
        availableAt(await slots(lifting, closedDay)).length,
      ).toBeGreaterThan(0);
    });

    it('horario especial: solo genera bloques dentro de esa franja', async () => {
      const specialDay = openDay(16);
      const created = await http()
        .post('/api/availability/exceptions')
        .set(as('admin'))
        .send({
          specific_date: specialDay,
          start_time: '10:00',
          end_time: '12:00',
          is_available: true,
        })
        .expect(201);
      try {
        expect(availableAt(await slots(lifting, specialDay))).toEqual([
          '10:00',
          '10:30',
          '11:00',
        ]);
      } finally {
        await http()
          .delete(
            `/api/availability/exceptions/${(created.body as { id: number }).id}`,
          )
          .set(as('admin'))
          .expect(204);
      }
    });

    it('horarios semanales: listado, validaciones y actualización', async () => {
      const list = await http()
        .get('/api/availability/regular')
        .set(as('admin'))
        .expect(200);
      const regular = list.body as Array<{
        id: number;
        day_of_week: number;
        start_time: string;
        end_time: string;
      }>;
      expect(regular.map((item) => item.day_of_week)).toEqual(
        [...regular.map((item) => item.day_of_week)].sort((a, b) => a - b),
      );
      const monday = regular.find((item) => item.day_of_week === 1);
      expect(monday).toMatchObject({
        start_time: '09:00:00',
        end_time: '20:00:00',
      });

      const duplicate = await http()
        .post('/api/availability/regular')
        .set(as('admin'))
        .send({
          day_of_week: 1,
          start_time: '09:00',
          end_time: '18:00',
          is_available: true,
        })
        .expect(400);
      expect((duplicate.body as MessageBody).message).toBe(
        'Ya existe un horario para el día 1',
      );

      const both = await http()
        .post('/api/availability')
        .set(as('admin'))
        .send({
          day_of_week: 2,
          specific_date: DAY,
          start_time: '09:00',
          end_time: '10:00',
        })
        .expect(422);
      expect((both.body as MessageBody).message).toContain(
        'No puede especificar day_of_week y specific_date simultáneamente',
      );

      await http()
        .put(`/api/availability/regular/${monday!.id}`)
        .set(as('admin'))
        .send({ start_time: '21:00' })
        .expect(400);

      const updated = await http()
        .put(`/api/availability/regular/${monday!.id}`)
        .set(as('admin'))
        .send({ start_time: '10:00', end_time: '19:00', is_available: true })
        .expect(200);
      expect(updated.body).toMatchObject({
        start_time: '10:00:00',
        end_time: '19:00:00',
      });
      await http()
        .put(`/api/availability/regular/${monday!.id}`)
        .set(as('admin'))
        .send({ start_time: monday!.start_time, end_time: monday!.end_time })
        .expect(200);

      await http().get('/api/availability/regular').set(as('ana')).expect(403);
      await http().get('/api/availability/regular').expect(401);
    });
  });
});
