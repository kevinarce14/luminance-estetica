import type {
  Appointment,
  Payment,
  Service,
  User,
} from '../../../generated/prisma/client';
import {
  toAppointmentResponse,
  type AppointmentResponse,
  type AppointmentStatusValue,
} from '../../appointments/interfaces/appointment-response.interface';
import {
  toPaymentResponse,
  type PaymentResponse,
} from '../../payments/interfaces/payment-response.interface';
import {
  toServicePublic,
  type ServicePublic,
} from '../../services/interfaces/service-public.interface';

/** Contratos del panel admin (mismos que web/src/types/admin.ts y FastAPI). */

/** Cliente con datos de contacto (schema UserContact). */
export interface UserContact {
  id: number;
  full_name: string;
  email: string;
  phone: string | null;
}

/** Turno de la agenda: incluye el contacto del cliente (schema AppointmentAdminView). */
export interface AppointmentAdminView extends AppointmentResponse {
  user: UserContact;
  service: ServicePublic;
  payment: PaymentResponse | null;
}

/** Pago con cliente y turno (schema PaymentAdminView). */
export interface PaymentAdminView extends PaymentResponse {
  user: UserContact;
  appointment: {
    id: number;
    appointment_date: string;
    status: AppointmentStatusValue;
    service: ServicePublic;
  };
}

/** Cliente con métricas de su historial (schema ClientSummary). */
export interface ClientSummary extends UserContact {
  is_active: boolean;
  created_at: string;
  appointments_count: number;
  completed_count: number;
  cancelled_count: number;
  last_appointment_date: string | null;
  total_paid: number;
}

/** Respuesta de GET /api/admin/dashboard. */
export interface DashboardMetrics {
  clients: { total: number; new_this_month: number };
  appointments: {
    today: number;
    this_week: number;
    this_month: number;
    pending_confirmation: number;
  };
  revenue: {
    /** Pagos aprobados en el mes (cobrado). */
    this_month: number;
    /** Turnos pendientes/confirmados todavía sin pago (estimado a cobrar). */
    pending: number;
    currency: 'ARS';
  };
  popular_services: Array<{ name: string; count: number }>;
}

export interface MonthSummary {
  month: number;
  revenue: number;
  payments_count: number;
  appointments_count: number;
  completed_count: number;
  cancelled_count: number;
}

export interface ServiceRanking {
  name: string;
  appointments_count: number;
  revenue: number;
}

export interface PaymentMethodSummary {
  method: string;
  count: number;
  amount: number;
}

/** Respuesta de GET /api/admin/reports/yearly. */
export interface YearlyReport {
  year: number;
  currency: 'ARS';
  total_revenue: number;
  total_payments: number;
  average_ticket: number;
  total_appointments: number;
  appointments_by_status: Partial<Record<AppointmentStatusValue, number>>;
  new_clients: number;
  months: MonthSummary[];
  top_services: ServiceRanking[];
  payment_methods: PaymentMethodSummary[];
}

/** Respuesta de GET /api/admin/reports/monthly. */
export interface MonthlyReport {
  period: { year: number; month: number; start_date: string; end_date: string };
  appointments: {
    total: number;
    by_status: Partial<Record<AppointmentStatusValue, number>>;
  };
  revenue: {
    total: number;
    currency: 'ARS';
    by_payment_method: PaymentMethodSummary[];
  };
  services: ServiceRanking[];
  new_clients: number;
}

// ===== Mappers =====

export function toUserContact(
  user: Pick<User, 'id' | 'fullName' | 'email' | 'phone'>,
): UserContact {
  return {
    id: user.id,
    full_name: user.fullName,
    email: user.email,
    phone: user.phone,
  };
}

export const CONTACT_SELECT = {
  id: true,
  fullName: true,
  email: true,
  phone: true,
} as const;

export type AdminAppointmentRow = Appointment & {
  user: Pick<User, 'id' | 'fullName' | 'email' | 'phone'>;
  service: Service;
  payment: Payment | null;
};

export function toAppointmentAdminView(
  appointment: AdminAppointmentRow,
): AppointmentAdminView {
  return {
    ...toAppointmentResponse(appointment),
    user: toUserContact(appointment.user),
    service: toServicePublic(appointment.service),
    payment: appointment.payment
      ? toPaymentResponse(appointment.payment)
      : null,
  };
}

export type AdminPaymentRow = Payment & {
  user: Pick<User, 'id' | 'fullName' | 'email' | 'phone'>;
  appointment: Appointment & { service: Service };
};

export function toPaymentAdminView(payment: AdminPaymentRow): PaymentAdminView {
  return {
    ...toPaymentResponse(payment),
    user: toUserContact(payment.user),
    appointment: {
      id: payment.appointment.id,
      appointment_date: payment.appointment.appointmentDate.toISOString(),
      status:
        payment.appointment.status.toLowerCase() as AppointmentStatusValue,
      service: toServicePublic(payment.appointment.service),
    },
  };
}
