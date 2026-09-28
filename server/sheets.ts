import { createHmac } from 'node:crypto';
import type { PaymentRecord } from './payments.js';

export function createSheetsWriter(url: string, secret: string, fetcher: typeof fetch = fetch) {
  return async (record: PaymentRecord): Promise<void> => {
    const payload = JSON.stringify(record);
    const timestamp = Date.now().toString();
    const signature = createHmac('sha256', secret).update(`${timestamp}.${payload}`).digest('hex');
    const response = await fetcher(url, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ timestamp, payload, signature }),
      signal: AbortSignal.timeout(12000), redirect: 'follow',
    });
    if (!response.ok) throw new Error('Google Sheets no disponible');
    const result = await response.json() as { ok?: boolean; paymentId?: string };
    // Apps Script devuelve HTTP 200 incluso para errores de aplicación.
    if (result.ok !== true || result.paymentId !== record.paymentId) throw new Error('Google Sheets no confirmó la escritura');
  };
}
