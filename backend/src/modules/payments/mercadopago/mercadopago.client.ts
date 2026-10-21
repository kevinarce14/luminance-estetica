import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { EnvironmentVariables } from '../../../config/env.validation';
import type {
  MercadoPagoPayment,
  PreferenceRequest,
  PreferenceResponse,
} from './mercadopago.interfaces';

const REQUEST_TIMEOUT_MS = 10_000;

/** Error de comunicación con MercadoPago (HTTP no exitoso, timeout o red). */
export class MercadoPagoError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = 'MercadoPagoError';
  }
}

/**
 * Cliente de la API REST oficial de MercadoPago con el Access Token del .env
 * (de prueba "TEST-…" o de producción "APP_USR-…").
 */
@Injectable()
export class MercadoPagoClient {
  private readonly logger = new Logger(MercadoPagoClient.name);
  private readonly baseUrl: string;
  private readonly accessToken: string | undefined;

  constructor(config: ConfigService<EnvironmentVariables, true>) {
    this.baseUrl = config
      .get('MERCADOPAGO_API_URL', { infer: true })
      .replace(/\/+$/, '');
    this.accessToken =
      config.get('MERCADOPAGO_ACCESS_TOKEN', { infer: true })?.trim() ||
      undefined;
  }

  isConfigured(): boolean {
    return this.accessToken !== undefined;
  }

  createPreference(body: PreferenceRequest): Promise<PreferenceResponse> {
    return this.request<PreferenceResponse>(
      'POST',
      '/checkout/preferences',
      body,
    );
  }

  getPayment(paymentId: string): Promise<MercadoPagoPayment> {
    return this.request<MercadoPagoPayment>(
      'GET',
      `/v1/payments/${encodeURIComponent(paymentId)}`,
    );
  }

  private async request<T>(
    method: 'GET' | 'POST',
    path: string,
    body?: unknown,
  ): Promise<T> {
    if (!this.accessToken) {
      throw new MercadoPagoError('MercadoPago no está configurado');
    }

    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}${path}`, {
        method,
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch (error) {
      throw new MercadoPagoError(
        `No se pudo conectar con MercadoPago: ${String(error)}`,
      );
    }

    const text = await response.text();
    if (!response.ok) {
      this.logger.error(`${method} ${path} → HTTP ${response.status}: ${text}`);
      throw new MercadoPagoError(
        `MercadoPago respondió HTTP ${response.status}`,
        response.status,
      );
    }
    return JSON.parse(text) as T;
  }
}
