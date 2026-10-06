import express from 'express';
import type Stripe from 'stripe';
import type { Config } from './config.js';
import {
  InputError,
  parsePayment,
  paymentRecord,
  PAYMENT_SOURCE,
  type PaymentRecord,
} from './payments.js';
import { lookupPayment, tokenHash, validateAccessToken } from './receipt.js';
import { createReceiptPdf } from './pdf.js';
import { createVatRateResolver } from './tax.js';

interface Dependencies {
  stripe: Stripe;
  writePayment: (record: PaymentRecord) => Promise<void>;
}

export function createApp(config: Config, { stripe, writePayment }: Dependencies) {
  const app = express();
  const vatRate = createVatRateResolver(stripe);
  app.disable('x-powered-by');
  app.set('trust proxy', config.trustProxyHops);
  app.use((_req, res, next) => {
    res.set({
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer',
    });
    next();
  });
  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });

  // Debe ir ANTES de express.json(): Stripe verifica la firma del cuerpo original.
  app.post(
    '/api/stripe/webhook',
    express.raw({ type: 'application/json', limit: '256kb' }),
    async (req, res) => {
      let event: Stripe.Event;
      try {
        const signature = req.get('stripe-signature');
        if (!signature || !Buffer.isBuffer(req.body)) throw new Error('Firma ausente');
        event = stripe.webhooks.constructEvent(
          req.body,
          signature,
          config.stripeWebhookSecret,
        );
      } catch {
        res.status(400).json({ error: 'Firma de Stripe inválida.' });
        return;
      }
      if (
        ![
          'checkout.session.completed',
          'checkout.session.async_payment_succeeded',
        ].includes(event.type)
      ) {
        res.json({ received: true });
        return;
      }
      try {
        const record = paymentRecord(
          event.data.object as Stripe.Checkout.Session,
          event.id,
          event.created,
        );
        if (record) await writePayment(record);
        res.json({ received: true });
      } catch {
        // No registrar datos personales ni secretos. El ID permite investigar en Stripe.
        console.error('payment_sync_failed', { eventId: event.id });
        res
          .status(503)
          .json({ error: 'Registro temporalmente no disponible; reintentar.' });
      }
    },
  );

  const limits = new Map<string, { count: number; until: number }>();
  app.use(['/api/crear-pago', '/api/pago', '/api/comprobante'], (req, res, next) => {
    if (req.get('origin') && req.get('origin') !== config.origin) {
      res.status(403).json({ error: 'Origen no permitido.' });
      return;
    }
    const now = Date.now();
    for (const [key, value] of limits) if (value.until <= now) limits.delete(key);
    const ip = `${req.baseUrl}:${req.ip || 'unknown'}`;
    if (!limits.has(ip) && limits.size >= 10000) {
      res.status(429).json({ error: 'Intenta nuevamente más tarde.' });
      return;
    }
    const limit = limits.get(ip) || { count: 0, until: now + 60000 };
    limits.set(ip, limit);
    if (++limit.count > (req.baseUrl === '/api/crear-pago' ? 10 : 30)) {
      res.set('Retry-After', String(Math.ceil((limit.until - now) / 1000)));
      res.status(429).json({ error: 'Demasiados intentos. Espera un minuto.' });
      return;
    }
    next();
  });
  app.post('/api/crear-pago', express.json({ limit: '8kb' }), async (req, res) => {
    try {
      if (!req.is('application/json')) {
        res.status(415).json({ error: 'Usa application/json.' });
        return;
      }
      const input = parsePayment(req.body, config.maxAmountCents);
      const receiptToken = validateAccessToken(req.body.accessToken);
      const requestId = req.get('Idempotency-Key');
      if (
        !requestId ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
          requestId,
        )
      ) {
        throw new InputError('Envía un UUID v4 en Idempotency-Key.');
      }
      const metadata = {
        source: PAYMENT_SOURCE,
        name: input.name,
        email: input.email,
        phone: input.phone,
        tax_policy: 'iva16-exclusive-v1',
      };
      const session = await stripe.checkout.sessions.create(
        {
          mode: 'payment',
          payment_method_types: ['card'],
          locale: 'es',
          customer_email: input.email,
          client_reference_id: requestId,
          metadata: { ...metadata, receipt_token_hash: tokenHash(receiptToken) },
          payment_intent_data: { metadata },
          line_items: [
            {
              quantity: 1,
              tax_rates: [await vatRate()],
              price_data: {
                currency: 'mxn',
                tax_behavior: 'exclusive',
                unit_amount: input.cents,
                product_data: { name: 'Abono — Axen Life Extreme' },
              },
            },
          ],
          success_url: config.successUrl,
          cancel_url: config.cancelUrl,
        },
        { idempotencyKey: `abono:${requestId}` },
      );
      if (!session.url) throw new Error('Checkout sin URL');
      res.json({ url: session.url });
    } catch (error) {
      if (error instanceof InputError) {
        res.status(400).json({ error: error.message });
        return;
      }
      if ((error as { type?: string }).type === 'StripeIdempotencyError') {
        res
          .status(409)
          .json({ error: 'Los datos cambiaron. Inicia un nuevo intento de pago.' });
        return;
      }
      console.error('checkout_creation_failed');
      res.status(502).json({
        error: 'No se pudo iniciar el pago. Reintenta con el mismo identificador.',
      });
    }
  });
  app.post(
    ['/api/pago', '/api/comprobante'],
    express.json({ limit: '2kb' }),
    async (req, res) => {
      try {
        const result = await lookupPayment(stripe, req.body);
        if (result.status === 'unavailable') {
          res.status(404).json({ error: 'No se encontró un pago accesible.' });
          return;
        }
        if (req.path === '/api/pago') {
          res.json(result);
          return;
        }
        if (result.status !== 'paid') {
          res.status(409).json({
            error:
              'El comprobante solo está disponible para un abono confirmado, sin devoluciones ni disputas.',
          });
          return;
        }
        const pdf = await createReceiptPdf(result.receipt);
        res.set({
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="abono-${result.receipt.reference}.pdf"`,
        });
        res.send(pdf);
      } catch (error) {
        if (error instanceof InputError) {
          res.status(400).json({ error: error.message });
          return;
        }
        if ((error as { code?: string }).code === 'resource_missing') {
          res.status(404).json({ error: 'No se encontró un pago accesible.' });
          return;
        }
        console.error('payment_lookup_failed');
        res.status(502).json({
          error:
            'No pudimos verificar el pago. Reintenta en un momento; no necesitas pagar otra vez.',
        });
      }
    },
  );
  app.use((_req, res) => {
    res.status(404).json({ error: 'Ruta no encontrada.' });
  });
  app.use(
    (
      error: { status?: number },
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction,
    ) => {
      const status = error.status === 413 ? 413 : error.status === 400 ? 400 : 500;
      res.status(status).json({
        error:
          status === 413 ? 'Solicitud demasiado grande.' : 'Solicitud no procesable.',
      });
    },
  );
  return app;
}
