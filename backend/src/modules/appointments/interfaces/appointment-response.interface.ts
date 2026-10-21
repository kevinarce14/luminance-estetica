import type {
  Appointment,
  Payment,
  Service,
  User,
} from '../../../generated/prisma/client';
import {
  toPaymentResponse,
  type PaymentResponse,
} from '../../payments/interfaces/payment-response.interface';
import {
  toServicePublic,
  type ServicePublic,
} from '../../services/interfaces/service-public.interface';

export type AppointmentStatusValue =
  'pending' | 'confirmed' | 'completed' | 'cancelled';

/** Turno (schema AppointmentResponse). Fechas en UTC con offset ("…Z"). */
export interface AppointmentResponse {
  id: number;
  user_id: number;
  service_id: number;
  appointment_date: string;
  notes: string | null;
  status: AppointmentStatusValue;
  reminder_sent: boolean;
  cancelled_at: string | null;
  cancellation_reason: string | null;
  created_at: string;
  updated_at: string | null;
}

/** Turno con cliente, servicio y pago (schema AppointmentWithDetails). */
export interface AppointmentWithDetails extends AppointmentResponse {
  user: { id: number; full_name: string };
  service: ServicePublic;
  payment: PaymentResponse | null;
}

/** Horario ocupado (GET /api/appointments/public/confirmed): sin datos del cliente. */
export interface PublicBookedSlot {
  appointment_date: string;
  duration_minutes: number;
}

/** Relaciones que se cargan para responder AppointmentWithDetails. */
export const APPOINTMENT_DETAILS_INCLUDE = {
  user: { select: { id: true, fullName: true } },
  service: true,
  payment: true,
} as const;

export type AppointmentWithRelations = Appointment & {
  user: Pick<User, 'id' | 'fullName'>;
  service: Service;
  payment: Payment | null;
};

export function toAppointmentResponse(
  appointment: Appointment,
): AppointmentResponse {
  return {
    id: appointment.id,
    user_id: appointment.userId,
    service_id: appointment.serviceId,
    appointment_date: appointment.appointmentDate.toISOString(),
    notes: appointment.notes,
    status: appointment.status.toLowerCase() as AppointmentStatusValue,
    reminder_sent: appointment.reminderSent,
    cancelled_at: appointment.cancelledAt?.toISOString() ?? null,
    cancellation_reason: appointment.cancellationReason,
    created_at: appointment.createdAt.toISOString(),
    updated_at: appointment.updatedAt?.toISOString() ?? null,
  };
}

export function toAppointmentWithDetails(
  appointment: AppointmentWithRelations,
): AppointmentWithDetails {
  return {
    ...toAppointmentResponse(appointment),
    user: { id: appointment.user.id, full_name: appointment.user.fullName },
    service: toServicePublic(appointment.service),
    payment: appointment.payment
      ? toPaymentResponse(appointment.payment)
      : null,
  };
}
