import type Stripe from 'stripe';

export const PAYMENT_SOURCE = 'axen-life-extreme';
export const MIN_AMOUNT_CENTS = 150000;

export class InputError extends Error {}

export function parsePayment(body: unknown, maxAmountCents: number) {
  if (!body || typeof body !== 'object' || Array.isArray(body))
    throw new InputError('Formulario inválido.');
  const input = body as Record<string, unknown>;
  const string = (key: string, max: number) => {
    if (
      typeof input[key] !== 'string' ||
      input[key].length > max ||
      /[\u0000-\u001f\u007f]/.test(input[key])
    )
      throw new InputError(`Campo ${key} inválido.`);
    return input[key].trim();
  };
  const name = string('name', 100);
  const email = string('email', 150).toLowerCase();
  const phone = input.phone === undefined ? '' : string('phone', 25);
  const amount = string('amount', 12);
  if (name.length < 2) throw new InputError('Escribe tu nombre completo.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    throw new InputError('Escribe un correo válido.');
  if (phone && !/^[+\d\s().-]{5,25}$/.test(phone))
    throw new InputError('WhatsApp inválido.');
  if (!/^\d{1,6}(?:\.\d{1,2})?$/.test(amount))
    throw new InputError('Escribe el importe en pesos, con hasta dos decimales.');
  const [pesos, decimals = ''] = amount.split('.');
  const cents = Number(pesos) * 100 + Number(decimals.padEnd(2, '0'));
  if (cents < MIN_AMOUNT_CENTS)
    throw new InputError('El abono mínimo es de $1,500.00 MXN.');
  if (cents > maxAmountCents)
    throw new InputError('El importe supera el máximo permitido.');
  return { name, email, phone, cents };
}

export interface PaymentRecord {
  paymentId: string;
  sessionId: string;
  eventId: string;
  confirmedAt: string;
  name: string;
  email: string;
  phone: string;
  amountCents: number;
  currency: 'mxn';
  status: 'paid';
  livemode: boolean;
}

export function paymentRecord(
  session: Stripe.Checkout.Session,
  eventId: string,
  confirmedAt: number,
): PaymentRecord | null {
  if (session.metadata?.source !== PAYMENT_SOURCE) return null;
  if (session.mode !== 'payment' || session.payment_status !== 'paid') return null;
  const paymentId =
    typeof session.payment_intent === 'string'
      ? session.payment_intent
      : session.payment_intent?.id;
  if (
    !paymentId ||
    !session.metadata.email ||
    !session.metadata.name ||
    session.currency !== 'mxn' ||
    !Number.isSafeInteger(session.amount_total) ||
    session.amount_total! < MIN_AMOUNT_CENTS
  ) {
    throw new Error('Pago confirmado con datos incompletos o moneda/importe incorrectos');
  }
  return {
    paymentId,
    sessionId: session.id,
    eventId,
    confirmedAt: new Date(confirmedAt * 1000).toISOString(),
    name: session.metadata.name,
    email: session.metadata.email,
    phone: session.metadata.phone || '',
    amountCents: session.amount_total!,
    currency: 'mxn',
    status: 'paid',
    livemode: session.livemode,
  };
}
