/**
 * Subconjunto tipado de la API REST de MercadoPago que usa la app.
 * https://www.mercadopago.com.ar/developers/es/reference
 */

export interface PreferenceItem {
  id: string;
  title: string;
  description: string;
  quantity: number;
  unit_price: number;
  currency_id: 'ARS';
}

/** Body de POST /checkout/preferences. */
export interface PreferenceRequest {
  items: PreferenceItem[];
  payer: { email: string; name: string };
  back_urls: { success: string; failure: string; pending: string };
  /** Solo con back_urls HTTPS: MercadoPago rechaza auto_return hacia localhost. */
  auto_return?: 'approved';
  /** ID del turno: así se vincula cada pago de MercadoPago con el turno. */
  external_reference: string;
  statement_descriptor: string;
  notification_url?: string;
  metadata: Record<string, number>;
}

/** Respuesta de POST /checkout/preferences. */
export interface PreferenceResponse {
  id: string;
  init_point: string;
  sandbox_init_point?: string | null;
}

/** Estados de un pago en MercadoPago. */
export type MercadoPagoPaymentStatus =
  | 'pending'
  | 'approved'
  | 'authorized'
  | 'in_process'
  | 'in_mediation'
  | 'rejected'
  | 'cancelled'
  | 'refunded'
  | 'charged_back';

/** Respuesta de GET /v1/payments/:id (campos usados). */
export interface MercadoPagoPayment {
  id: number;
  status: MercadoPagoPaymentStatus;
  status_detail?: string | null;
  external_reference?: string | null;
  transaction_amount?: number | null;
  currency_id?: string | null;
  payment_method_id?: string | null;
  payment_type_id?: string | null;
  date_approved?: string | null;
}
