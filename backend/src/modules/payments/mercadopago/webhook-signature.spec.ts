import { createHmac } from 'node:crypto';
import { isValidWebhookSignature } from './webhook-signature';

const SECRET = 'clave-secreta-de-webhooks';

/** Firma como lo hace MercadoPago (ejemplo de su documentación). */
function sign(dataId: string, requestId: string, ts: string): string {
  const manifest = `id:${dataId};request-id:${requestId};ts:${ts};`;
  const v1 = createHmac('sha256', SECRET).update(manifest).digest('hex');
  return `ts=${ts},v1=${v1}`;
}

describe('isValidWebhookSignature', () => {
  const base = { secret: SECRET, requestId: 'req-123', dataId: '123456' };

  it('acepta una firma correcta', () => {
    expect(
      isValidWebhookSignature({
        ...base,
        signature: sign('123456', 'req-123', '1704908010'),
      }),
    ).toBe(true);
  });

  it('rechaza firmas ausentes, mal formadas o de otro pago', () => {
    expect(isValidWebhookSignature({ ...base, signature: undefined })).toBe(
      false,
    );
    expect(isValidWebhookSignature({ ...base, signature: 'basura' })).toBe(
      false,
    );
    expect(
      isValidWebhookSignature({
        ...base,
        signature: sign('999999', 'req-123', '1704908010'),
      }),
    ).toBe(false);
    expect(
      isValidWebhookSignature({
        ...base,
        secret: 'otra-clave',
        signature: sign('123456', 'req-123', '1704908010'),
      }),
    ).toBe(false);
  });

  it('los IDs alfanuméricos se firman en minúsculas', () => {
    expect(
      isValidWebhookSignature({
        ...base,
        dataId: 'ABC123',
        signature: sign('abc123', 'req-123', '1704908010'),
      }),
    ).toBe(true);
  });
});
