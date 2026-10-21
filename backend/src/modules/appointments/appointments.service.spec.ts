import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AppointmentStatus, type User } from '../../generated/prisma/client';
import { MailService } from '../../mail/mail.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AvailabilityService } from '../availability/availability.service';
import { StudioClock } from '../availability/studio-clock';
import { AppointmentsService, canTransition } from './appointments.service';

const NOW = new Date('2026-10-20T15:00:00Z'); // 12:00 en Buenos Aires
const HOUR = 60 * 60 * 1000;

const client = { id: 7, isAdmin: false } as User;
const admin = { id: 1, isAdmin: true } as User;
const service = { id: 3, isActive: true, durationMinutes: 60, name: 'Lifting' };

describe('canTransition', () => {
  it('permite solo las transiciones del legado', () => {
    const { PENDING, CONFIRMED, COMPLETED, CANCELLED } = AppointmentStatus;
    expect(canTransition(PENDING, CONFIRMED)).toBe(true);
    expect(canTransition(PENDING, CANCELLED)).toBe(true);
    expect(canTransition(CONFIRMED, COMPLETED)).toBe(true);
    expect(canTransition(CONFIRMED, CANCELLED)).toBe(true);
    expect(canTransition(PENDING, COMPLETED)).toBe(false);
    expect(canTransition(COMPLETED, CANCELLED)).toBe(false);
    expect(canTransition(CANCELLED, CONFIRMED)).toBe(false);
  });
});

describe('AppointmentsService', () => {
  const prisma = {
    service: { findUnique: jest.fn() },
    appointment: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  };
  const availability = {
    assertBookable: jest.fn(),
    getBusyIntervals: jest.fn(),
  };
  const mail = { sendAppointmentCancelled: jest.fn() };
  const clock = {
    timeZone: 'America/Argentina/Buenos_Aires',
    minAdvanceHours: 2,
    maxAdvanceDays: 30,
    now: () => NOW,
    earliestBookableStart: () => new Date(NOW.getTime() + 2 * HOUR),
    latestBookableStart: () => new Date(NOW.getTime() + 30 * 24 * HOUR),
  };
  let appointments: AppointmentsService;

  beforeEach(async () => {
    jest.resetAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [
        AppointmentsService,
        { provide: PrismaService, useValue: prisma },
        { provide: AvailabilityService, useValue: availability },
        { provide: StudioClock, useValue: clock },
        { provide: MailService, useValue: mail },
      ],
    }).compile();
    appointments = moduleRef.get(AppointmentsService);
  });

  const book = (appointment_date: string) =>
    appointments.create(client, { service_id: 3, appointment_date, notes: '' });

  describe('create', () => {
    it('crea el turno PENDING a nombre del usuario, guardando la fecha en UTC', async () => {
      prisma.service.findUnique.mockResolvedValue(service);
      prisma.appointment.create.mockResolvedValue({ id: 10 });

      await book('2026-10-21T10:00:00-03:00');

      expect(availability.assertBookable).toHaveBeenCalledWith(
        service,
        new Date('2026-10-21T13:00:00Z'),
        { conflictMessage: 'Este horario no está disponible' },
      );
      expect(prisma.appointment.create).toHaveBeenCalledWith({
        data: {
          userId: 7,
          serviceId: 3,
          appointmentDate: new Date('2026-10-21T13:00:00Z'),
          notes: '',
          status: AppointmentStatus.PENDING,
        },
      });
    });

    it('una fecha pasada es un error de validación (422)', async () => {
      await expect(book('2026-10-19T10:00:00-03:00')).rejects.toThrow(
        UnprocessableEntityException,
      );
    });

    it('exige 2 horas de anticipación y como máximo 30 días', async () => {
      prisma.service.findUnique.mockResolvedValue(service);
      await expect(book('2026-10-20T13:30:00-03:00')).rejects.toThrow(
        new BadRequestException(
          'Debes reservar con al menos 2 horas de anticipación',
        ),
      );
      await expect(book('2026-11-20T10:00:00-03:00')).rejects.toThrow(
        new BadRequestException(
          'No puedes reservar con más de 30 días de anticipación',
        ),
      );
      expect(prisma.appointment.create).not.toHaveBeenCalled();
    });

    it('servicio inexistente (404) o inactivo (400)', async () => {
      prisma.service.findUnique.mockResolvedValueOnce(null);
      await expect(book('2026-10-21T10:00:00-03:00')).rejects.toThrow(
        NotFoundException,
      );
      prisma.service.findUnique.mockResolvedValueOnce({
        ...service,
        isActive: false,
      });
      await expect(book('2026-10-21T10:00:00-03:00')).rejects.toThrow(
        new BadRequestException('Este servicio no está disponible actualmente'),
      );
    });
  });

  describe('cancel', () => {
    const stored = (overrides: object = {}) => ({
      id: 10,
      userId: client.id,
      status: AppointmentStatus.PENDING,
      appointmentDate: new Date('2026-10-21T13:00:00Z'),
      service,
      user: { email: 'lucia@example.com', fullName: 'Lucía' },
      ...overrides,
    });

    it('el dueño cancela con motivo y se envía el email', async () => {
      prisma.appointment.findUnique.mockResolvedValue(stored());
      prisma.appointment.update.mockResolvedValue({ id: 10 });

      await appointments.cancel(10, client, {
        cancellation_reason: 'Surgió un imprevisto',
      });

      expect(prisma.appointment.update).toHaveBeenCalledWith({
        where: { id: 10 },
        data: {
          status: AppointmentStatus.CANCELLED,
          cancelledAt: NOW,
          cancellationReason: 'Surgió un imprevisto',
        },
      });
      expect(mail.sendAppointmentCancelled).toHaveBeenCalledWith(
        'lucia@example.com',
        'Lucía',
        'Lifting',
        new Date('2026-10-21T13:00:00Z'),
      );
    });

    it('otro cliente no puede cancelarlo (403); un admin sí', async () => {
      prisma.appointment.findUnique.mockResolvedValue(stored({ userId: 99 }));
      await expect(
        appointments.cancel(10, client, { cancellation_reason: 'No voy a ir' }),
      ).rejects.toThrow(
        new ForbiddenException('No tienes permiso para cancelar este turno'),
      );

      prisma.appointment.update.mockResolvedValue({ id: 10 });
      await appointments.cancel(10, admin, {
        cancellation_reason: 'Cancelado por el studio',
      });
      expect(prisma.appointment.update).toHaveBeenCalled();
    });

    it('un turno completado o cancelado no se cancela', async () => {
      prisma.appointment.findUnique.mockResolvedValue(
        stored({ status: AppointmentStatus.COMPLETED }),
      );
      await expect(
        appointments.cancel(10, client, { cancellation_reason: 'No voy a ir' }),
      ).rejects.toThrow(
        new BadRequestException('Este turno no se puede cancelar'),
      );
    });
  });
});
