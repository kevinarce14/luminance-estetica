import { createHmac } from 'node:crypto';
import { createServer, type IncomingMessage, type Server } from 'node:http';
import type {
  MercadoPagoPayment,
  PreferenceRequest,
} from '../../src/modules/payments/mercadopago/mercadopago.interfaces';

/**
 * MercadoPago simulado para los tests e2e: implementa POST /checkout/preferences y
 * GET /v1/payments/:id sobre HTTP real, así la API usa su cliente REST sin cambios.
 */
export class FakeMercadoPago {
  readonly preferences: PreferenceRequest[] = [];
  readonly payments = new Map<string, MercadoPagoPayment>();
  private server?: Server;

  constructor(
    private readonly port: number,
    private readonly accessToken: string,
  ) {}

  start(): Promise<void> {
    this.server = createServer((req, res) => {
      void this.handle(req).then(({ status, body }) => {
        res.writeHead(status, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(body));
      });
    });
    // Falla enseguida si el puerto está ocupado (en lugar de colgar el beforeAll).
    return new Promise((resolve, reject) => {
      this.server!.once('error', reject);
      this.server!.listen(this.port, '127.0.0.1', resolve);
    });
  }

  stop(): Promise<void> {
    return new Promise((resolve) => this.server?.close(() => resolve()));
  }

  lastPreference(): PreferenceRequest {
    return this.preferences[this.preferences.length - 1];
  }

  private async handle(
    req: IncomingMessage,
  ): Promise<{ status: number; body: unknown }> {
    if (req.headers.authorization !== `Bearer ${this.accessToken}`) {
      return { status: 401, body: { message: 'invalid access token' } };
    }
    if (req.method === 'POST' && req.url === '/checkout/preferences') {
      this.preferences.push(
        JSON.parse(await readBody(req)) as PreferenceRequest,
      );
      const id = `pref-${this.preferences.length}`;
      return {
        status: 201,
        body: {
          id,
          init_point: `https://mercadopago.test/checkout?pref_id=${id}`,
          sandbox_init_point: `https://sandbox.mercadopago.test/checkout?pref_id=${id}`,
        },
      };
    }
    const match = /^\/v1\/payments\/([^/?]+)$/.exec(req.url ?? '');
    if (req.method === 'GET' && match) {
      const payment = this.payments.get(decodeURIComponent(match[1]));
      return payment
        ? { status: 200, body: payment }
        : { status: 404, body: { message: 'Payment not found' } };
    }
    return { status: 404, body: { message: 'not found' } };
  }
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk: Buffer) => (data += chunk.toString('utf8')));
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

/** Headers x-signature / x-request-id como los envía MercadoPago. */
export function signWebhook(
  secret: string,
  dataId: string,
  requestId = `req-${dataId}`,
): Record<string, string> {
  const ts = String(Math.floor(Date.now() / 1000));
  const v1 = createHmac('sha256', secret)
    .update(`id:${dataId.toLowerCase()};request-id:${requestId};ts:${ts};`)
    .digest('hex');
  return { 'x-signature': `ts=${ts},v1=${v1}`, 'x-request-id': requestId };
}
