import { createHash, timingSafeEqual } from 'node:crypto';
import type Stripe from 'stripe';
import { InputError, PAYMENT_SOURCE, paymentRecord } from './payments.js';

export const tokenHash = (token: string) =>
  createHash('sha256').update(token).digest('hex');
export function validateAccessToken(value: unknown): string {
  if (typeof value !== 'string' || !/^[a-f0-9]{64}$/.test(value))
    throw new InputError('Acceso al comprobante inválido.');
  return value;
}

export interface Receipt {
  reference: string;
  name: string;
  email: string;
  phone: string;
  cents: number;
  paidAt: string;
  livemode: boolean;
}

export async function lookupPayment(
  stripe: Stripe,
  body: unknown,
): Promise<
  | { status: 'paid'; receipt: Receipt }
  | { status: 'pending' | 'expired' | 'refunded' | 'unavailable' }
> {
  const input = body as { sessionId?: unknown; accessToken?: unknown } | null;
  if (
    !input ||
    typeof input.sessionId !== 'string' ||
    !/^cs_(test_|live_)?[A-Za-z0-9]{8,240}$/.test(input.sessionId)
  )
    throw new InputError('Sesión de pago inválida.');
  const token = validateAccessToken(input.accessToken);
  const session = await stripe.checkout.sessions.retrieve(input.sessionId, {
    expand: ['payment_intent.latest_charge'],
  });
  const expected = session.metadata?.receipt_token_hash;
  if (
    session.metadata?.source !== PAYMENT_SOURCE ||
    !expected ||
    !/^[a-f0-9]{64}$/.test(expected) ||
    !timingSafeEqual(Buffer.from(tokenHash(token), 'hex'), Buffer.from(expected, 'hex'))
  )
    return { status: 'unavailable' };
  if (session.status === 'expired') return { status: 'expired' };
  if (session.payment_status !== 'paid') return { status: 'pending' };
  const intent = session.payment_intent;
  if (!intent || typeof intent === 'string' || intent.status !== 'succeeded')
    return { status: 'pending' };
  const charge = intent.latest_charge;
  if (!charge || typeof charge === 'string' || !charge.paid) return { status: 'pending' };
  if (charge.amount_refunded > 0 || charge.disputed) return { status: 'refunded' };
  const record = paymentRecord(session, 'receipt', charge.created);
  if (!record) return { status: 'unavailable' };
  return {
    status: 'paid',
    receipt: {
      reference: record.paymentId,
      name: record.name,
      email: record.email,
      phone: record.phone,
      cents: record.amountCents,
      paidAt: record.confirmedAt,
      livemode: record.livemode,
    },
  };
}
