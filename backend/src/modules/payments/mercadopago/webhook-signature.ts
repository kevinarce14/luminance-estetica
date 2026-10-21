import { createHmac, timingSafeEqual } from 'node:crypto';

export interface WebhookSignatureInput {
  secret: string;
  /** Header x-signature: "ts=1704908010,v1=<hmac hex>". */
  signature: string | undefined;
  /** Header x-request-id. */
  requestId: string | undefined;
  /** `data.id` de la query de la notificación. */
  dataId: string | undefined;
}

/**
 * Valida la firma de una notificación de Webhooks de MercadoPago: HMAC-SHA256 con la
 * clave secreta sobre el manifiesto "id:<data.id>;request-id:<x-request-id>;ts:<ts>;"
 * (los valores ausentes se omiten, como indica la documentación).
 */
export function isValidWebhookSignature(input: WebhookSignatureInput): boolean {
  if (!input.signature) {
    return false;
  }
  const parts = new Map(
    input.signature.split(',').map((part) => {
      const [key, ...value] = part.trim().split('=');
      return [key, value.join('=')] as const;
    }),
  );
  const ts = parts.get('ts');
  const expected = parts.get('v1');
  if (!ts || !expected) {
    return false;
  }

  // Los IDs alfanuméricos se firman en minúsculas.
  const dataId = input.dataId?.toLowerCase();
  const manifest = [
    dataId ? `id:${dataId};` : '',
    input.requestId ? `request-id:${input.requestId};` : '',
    `ts:${ts};`,
  ].join('');
  const computed = createHmac('sha256', input.secret)
    .update(manifest)
    .digest('hex');

  const received = Buffer.from(expected, 'utf8');
  const actual = Buffer.from(computed, 'utf8');
  return received.length === actual.length && timingSafeEqual(received, actual);
}
