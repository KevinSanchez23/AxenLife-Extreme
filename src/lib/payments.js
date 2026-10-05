const STORAGE_KEY = 'axen-payment-access';

export function parseAmount(value) {
  const raw = String(value).trim();
  if (!/^\d{1,6}(?:\.\d{1,2})?$/.test(raw))
    throw new Error('Escribe un importe válido, con hasta dos decimales.');
  const [pesos, decimals = ''] = raw.split('.');
  const cents = Number(pesos) * 100 + Number(decimals.padEnd(2, '0'));
  if (cents < 1000) throw new Error('El abono mínimo es de $10.00 MXN.');
  return cents;
}

export function newAttempt() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return {
    requestId: crypto.randomUUID(),
    accessToken: Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join(''),
  };
}

export function saveAttempt(attempt) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(attempt));
  } catch {
    throw new Error(
      'Permite el almacenamiento de esta pestaña para poder recuperar tu comprobante al volver de Stripe.',
    );
  }
}

export function readAttempt() {
  try {
    return JSON.parse(sessionStorage.getItem(STORAGE_KEY) || 'null');
  } catch {
    return null;
  }
}

export function readPaymentReturn() {
  const query = new URLSearchParams(window.location.search);
  if (query.get('pago') === 'recibido')
    return { type: 'success', sessionId: query.get('session_id') || '' };
  if (query.get('pago') === 'cancelado') return { type: 'cancelled' };
  return null;
}

export function clearPaymentReturn() {
  const url = new URL(window.location.href);
  url.searchParams.delete('pago');
  url.searchParams.delete('session_id');
  window.history.replaceState({}, '', url);
}

export async function paymentRequest(path, body, { requestId, signal } = {}) {
  const response = await fetch(path, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(requestId ? { 'Idempotency-Key': requestId } : {}),
    },
    body: JSON.stringify(body),
    signal,
  });
  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new Error(
      error?.error ||
        'No pudimos comunicarnos con el servicio de pagos. Intenta nuevamente.',
    );
  }
  return response;
}
