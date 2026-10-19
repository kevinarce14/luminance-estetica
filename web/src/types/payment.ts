export const PaymentStatus = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  CANCELLED: 'cancelled',
  REFUNDED: 'refunded',
} as const

export type PaymentStatus = (typeof PaymentStatus)[keyof typeof PaymentStatus]

export const PaymentMethod = {
  MERCADOPAGO: 'mercadopago',
  CASH: 'cash',
  TRANSFER: 'transfer',
} as const

export type PaymentMethod = (typeof PaymentMethod)[keyof typeof PaymentMethod]

/** Métodos que el cliente puede elegir en /pago. */
export type CheckoutMethod = typeof PaymentMethod.MERCADOPAGO | typeof PaymentMethod.CASH

/** Pago registrado (schema PaymentResponse). */
export interface Payment {
  id: number
  appointment_id: number
  user_id: number
  amount: number
  currency: string
  payment_method: PaymentMethod
  status: PaymentStatus
  mercadopago_id: string | null
  mercadopago_preference_id: string | null
  transaction_id: string | null
  payment_details: string | null
  error_message: string | null
  created_at: string
  updated_at: string | null
  approved_at: string | null
}

/** Body de POST /payments/create-preference (schema PaymentCreate). */
export interface PaymentPreferencePayload {
  appointment_id: number
  amount: number
  currency: 'ARS'
  payment_method: typeof PaymentMethod.MERCADOPAGO
}

/** Respuesta de POST /payments/create-preference. */
export interface MercadoPagoPreference {
  preference_id: string
  init_point: string
  sandbox_init_point: string | null
}

/** Query params con los que MercadoPago vuelve a las back_urls. */
export interface MercadoPagoReturnParams {
  appointmentId: number | null
  status: string | null
  paymentId: string | null
}
