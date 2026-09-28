import Stripe from 'stripe';
import { loadConfig } from './config.js';
import { paymentRecord } from './payments.js';
import { createSheetsWriter } from './sheets.js';

// Recupera pagos faltantes sin crear nuevos cobros. La escritura es idempotente.
const config = loadConfig();
const from = Date.parse(process.argv[2] || '');
if (!Number.isFinite(from)) throw new Error('Uso: npm run backend:reconcile -- 2026-09-01T00:00:00Z');
const stripe = new Stripe(config.stripeSecretKey, { timeout: 15000, maxNetworkRetries: 2 });
const write = createSheetsWriter(config.sheetsUrl, config.sheetsSecret);
let count = 0;
for await (const session of stripe.checkout.sessions.list({ created: { gte: Math.floor(from / 1000) }, limit: 100 })) {
  // La fecha es la recuperación, no se inventa una fecha de pago histórica.
  const record = paymentRecord(session, 'reconciliation', Math.floor(Date.now() / 1000));
  if (record) { await write(record); count++; }
}
console.log(`Reconciliación terminada: ${count} pagos revisados (incluye existentes).`);
