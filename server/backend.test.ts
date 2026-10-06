import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac, randomUUID } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import vm from 'node:vm';
import Stripe from 'stripe';
import { createApp } from './app.js';
import { loadConfig } from './config.js';
import { parsePayment, paymentRecord, PAYMENT_SOURCE } from './payments.js';
import { createSheetsWriter } from './sheets.js';
import { tokenHash } from './receipt.js';
import { createVatRateResolver } from './tax.js';

const config = loadConfig({
  PUBLIC_SITE_URL: 'http://localhost:5173/',
  STRIPE_SECRET_KEY: 'sk_test_example',
  STRIPE_WEBHOOK_SECRET: 'whsec_example',
  GOOGLE_SHEETS_WEB_APP_URL: 'https://script.google.com/macros/s/example/exec',
  GOOGLE_SHEETS_SHARED_SECRET: 'a'.repeat(64),
});
const input = {
  name: 'Ana Pérez',
  email: ' ANA@example.com ',
  phone: '+52 5555555555',
  amount: '1500.01',
  accessToken: 'a'.repeat(64),
};
const session = {
  id: 'cs_test_example123',
  mode: 'payment',
  payment_status: 'paid',
  currency: 'mxn',
  amount_total: 150001,
  payment_intent: 'pi_example',
  livemode: false,
  metadata: {
    source: PAYMENT_SOURCE,
    name: input.name,
    email: 'ana@example.com',
    phone: input.phone,
  },
} as unknown as Stripe.Checkout.Session;
const record = paymentRecord(session, 'evt_example', 1700000000)!;

test('importe en centavos exactos, mínimo y validación del formulario', () => {
  assert.equal(parsePayment(input, 99999999).cents, 150001);
  assert.equal(parsePayment({ ...input, amount: '1500' }, 99999999).cents, 150000);
  assert.equal(parsePayment(input, 99999999).email, 'ana@example.com');
  for (const amount of [
    '1499.99',
    '-1500',
    '1e4',
    '1500.001',
    'NaN',
    '1000000',
    1500,
    null,
  ]) {
    assert.throws(() => parsePayment({ ...input, amount }, 99999999));
  }
  assert.throws(() => parsePayment({ ...input, email: 'invalid' }, 99999999));
  assert.throws(() => parsePayment(input, 150000));
});

test('solo pagos confirmados de esta landing; correo original preservado', () => {
  assert.equal(record.email, 'ana@example.com');
  assert.equal(
    paymentRecord({ ...session, payment_status: 'unpaid' }, 'evt_x', 1700000000),
    null,
  );
  assert.equal(paymentRecord({ ...session, metadata: {} }, 'evt_x', 1700000000), null);
  assert.throws(() =>
    paymentRecord({ ...session, currency: 'usd' }, 'evt_x', 1700000000),
  );
});

test('IVA exclusivo: redondeo, límites y compatibilidad de pagos anteriores', () => {
  assert.equal(record.taxCents, 0);
  assert.equal(record.subtotalCents, 150001);
  for (const [base, tax] of [
    [150000, 24000],
    [150001, 24000],
    [150004, 24001],
  ]) {
    const taxed = {
      ...session,
      amount_subtotal: base,
      amount_total: base + tax,
      total_details: { amount_tax: tax, amount_discount: 0, amount_shipping: 0 },
      metadata: { ...session.metadata, tax_policy: 'iva16-exclusive-v1' },
    };
    assert.equal(paymentRecord(taxed, 'evt_tax', 1700000000)?.taxCents, tax);
    assert.throws(() =>
      paymentRecord({ ...taxed, amount_total: base }, 'evt_tax', 1700000000),
    );
  }
  assert.equal(parsePayment({ ...input, amount: '862068.96' }, 99999999).cents, 86206896);
  assert.throws(() => parsePayment({ ...input, amount: '862068.97' }, 99999999));
});

test('tasa fija se crea exclusiva, comparte concurrencia y permite reintentar errores', async () => {
  const stripe = new Stripe(config.stripeSecretKey);
  stripe.taxRates.list = (() => ({
    async *[Symbol.asyncIterator]() {},
  })) as unknown as typeof stripe.taxRates.list;
  let calls = 0;
  stripe.taxRates.create = (async (params: Stripe.TaxRateCreateParams) => {
    calls++;
    assert.equal(params.percentage, 16);
    assert.equal(params.inclusive, false);
    if (calls === 1) throw new Error('temporary');
    return { id: 'txr_fixed' };
  }) as typeof stripe.taxRates.create;
  const resolve = createVatRateResolver(stripe);
  await assert.rejects(resolve());
  assert.deepEqual(await Promise.all([resolve(), resolve()]), ['txr_fixed', 'txr_fixed']);
  assert.equal(calls, 2);
});

test('configuración rechaza URLs inseguras y secretos ausentes', () => {
  assert.throws(() => loadConfig({}));
  assert.throws(() =>
    loadConfig({ PUBLIC_SITE_URL: 'http://example.com', NODE_ENV: 'production' }),
  );
});

test('configuración acepta claves restringidas y distingue errores sin revelar secretos', () => {
  const env = {
    PUBLIC_SITE_URL: 'http://localhost:5173/',
    STRIPE_SECRET_KEY: 'sk_test_example',
    STRIPE_WEBHOOK_SECRET: 'whsec_example',
    GOOGLE_SHEETS_WEB_APP_URL: 'https://script.google.com/macros/s/example/exec',
    GOOGLE_SHEETS_SHARED_SECRET: 'a'.repeat(64),
  };
  for (const prefix of ['sk_test_', 'sk_live_', 'rk_test_', 'rk_live_']) {
    const key = `${prefix}example`;
    assert.equal(loadConfig({ ...env, STRIPE_SECRET_KEY: key }).stripeSecretKey, key);
  }
  for (const key of ['pk_live_privatevalue', 'rk_live_', 'rk_live_invalid value']) {
    assert.throws(
      () => loadConfig({ ...env, STRIPE_SECRET_KEY: key }),
      (error: Error) => {
        assert.match(error.message, /STRIPE_SECRET_KEY/);
        if (key !== 'rk_live_') assert.ok(!error.message.includes(key));
        return true;
      },
    );
  }
  assert.throws(
    () => loadConfig({ ...env, STRIPE_WEBHOOK_SECRET: 'invalid_privatevalue' }),
    /STRIPE_WEBHOOK_SECRET inválido/,
  );
});

test('API: Checkout, idempotencia, firma real Stripe, errores y reintentos', async () => {
  const stripe = new Stripe(config.stripeSecretKey);
  const creations: unknown[] = [];
  stripe.taxRates.list = (() => ({
    async *[Symbol.asyncIterator]() {
      yield {
        id: 'txr_iva16',
        percentage: 16,
        inclusive: false,
        display_name: 'IVA',
        metadata: { source: 'axen-life-extreme-iva-v1' },
      };
    },
  })) as unknown as typeof stripe.taxRates.list;
  stripe.checkout.sessions.create = (async (params: unknown, options: unknown) => {
    creations.push({ params, options });
    return { id: session.id, url: 'https://checkout.stripe.com/example' };
  }) as typeof stripe.checkout.sessions.create;
  let fail = false;
  let writes = 0;
  const app = createApp(config, {
    stripe,
    writePayment: async () => {
      if (fail) throw new Error('offline');
      writes++;
    },
  });
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const address = server.address() as { port: number };
  const base = `http://127.0.0.1:${address.port}`;
  const post = (body: unknown, headers: Record<string, string> = {}) =>
    fetch(`${base}/api/crear-pago`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': randomUUID(),
        ...headers,
      },
      body: JSON.stringify(body),
    });
  const webhook = (payload: object, valid = true) => {
    const body = JSON.stringify(payload);
    const signature = stripe.webhooks.generateTestHeaderString({
      payload: body,
      secret: valid ? config.stripeWebhookSecret : 'wrong',
    });
    return fetch(`${base}/api/stripe/webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Stripe-Signature': signature },
      body,
    });
  };
  try {
    const key = randomUUID();
    assert.equal((await post(input, { 'Idempotency-Key': key })).status, 200);
    const creation = creations[0] as {
      params: Stripe.Checkout.SessionCreateParams;
      options: { idempotencyKey: string };
    };
    assert.equal(creation.params.line_items![0].price_data!.unit_amount, 150001);
    assert.equal(creation.params.line_items![0].price_data!.currency, 'mxn');
    assert.deepEqual(creation.params.line_items![0].tax_rates, ['txr_iva16']);
    assert.equal(creation.params.line_items![0].price_data!.tax_behavior, 'exclusive');
    assert.equal(creation.options.idempotencyKey, `abono:${key}`);
    assert.equal(
      creation.params.metadata?.receipt_token_hash,
      tokenHash(input.accessToken),
    );
    assert.ok(creation.params.success_url?.includes('session_id={CHECKOUT_SESSION_ID}'));
    assert.equal((await post({ ...input, amount: '1499.99' })).status, 400);
    assert.equal((await post(input, { Origin: 'https://evil.example' })).status, 403);
    assert.equal((await post(input, { 'Idempotency-Key': 'invalid' })).status, 400);
    assert.equal(creations.length, 1);
    const event = {
      id: 'evt_example',
      type: 'checkout.session.completed',
      created: 1700000000,
      data: { object: session },
    };
    assert.equal((await webhook(event, false)).status, 400);
    assert.equal(writes, 0);
    assert.equal((await webhook(event)).status, 200);
    assert.equal(writes, 1);
    fail = true;
    assert.equal((await webhook(event)).status, 503);
    fail = false;
    assert.equal((await webhook(event)).status, 200);
    assert.equal(writes, 2);
    assert.equal(
      (
        await webhook({
          ...event,
          data: { object: { ...session, payment_status: 'unpaid' } },
        })
      ).status,
      200,
    );
    assert.equal(writes, 2);
    assert.equal(
      (await webhook({ ...event, type: 'checkout.session.async_payment_succeeded' }))
        .status,
      200,
    );
    assert.equal(writes, 3);
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
});

test('retorno y PDF: acceso privado, Stripe confirmado, pendiente, devolución y datos originales', async () => {
  const stripe = new Stripe(config.stripeSecretKey);
  let current = {
    ...session,
    amount_subtotal: 150000,
    amount_total: 174000,
    total_details: { amount_tax: 24000, amount_discount: 0, amount_shipping: 0 },
    status: 'complete',
    metadata: { ...session.metadata, receipt_token_hash: tokenHash(input.accessToken) },
    payment_intent: {
      id: 'pi_example123',
      status: 'succeeded',
      latest_charge: {
        created: 1790611200,
        paid: true,
        amount_refunded: 0,
        disputed: false,
      },
    },
  };
  stripe.checkout.sessions.retrieve = (async () =>
    current) as unknown as typeof stripe.checkout.sessions.retrieve;
  const server = createApp(config, {
    stripe,
    writePayment: async () => assert.fail('Consultar no escribe en Sheets'),
  }).listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  const request = (path: string, accessToken = input.accessToken) =>
    fetch(`${base}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: session.id, accessToken }),
    });
  try {
    assert.equal((await request('/api/pago', 'b'.repeat(64))).status, 404);
    assert.equal((await request('/api/comprobante', 'b'.repeat(64))).status, 404);
    const response = await request('/api/pago');
    const result = await response.json();
    assert.equal(result.status, 'paid');
    assert.equal(result.receipt.email, 'ana@example.com');
    assert.equal(result.receipt.cents, 174000);
    assert.equal(result.receipt.subtotalCents, 150000);
    assert.equal(result.receipt.taxCents, 24000);
    const pdf = await request('/api/comprobante');
    assert.equal(pdf.status, 200);
    assert.equal(pdf.headers.get('content-type'), 'application/pdf');
    assert.match(pdf.headers.get('content-disposition')!, /abono-pi_example123.pdf/);
    const buffer = Buffer.from(await pdf.arrayBuffer());
    assert.equal(buffer.subarray(0, 5).toString(), '%PDF-');
    mkdirSync('tmp/pdfs', { recursive: true });
    writeFileSync('tmp/pdfs/comprobante-prueba.pdf', buffer);
    current = { ...current, payment_status: 'unpaid' };
    assert.equal((await (await request('/api/pago')).json()).status, 'pending');
    assert.equal((await request('/api/comprobante')).status, 409);
    current = {
      ...current,
      payment_status: 'paid',
      payment_intent: {
        ...current.payment_intent,
        latest_charge: { ...current.payment_intent.latest_charge, amount_refunded: 100 },
      },
    };
    assert.equal((await (await request('/api/pago')).json()).status, 'refunded');
    assert.equal((await request('/api/comprobante')).status, 409);
    current = { ...current, metadata: { ...current.metadata, source: 'another-site' } };
    assert.equal((await request('/api/pago')).status, 404);
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

test('Google transport firma el payload y comprueba la confirmación de escritura', async () => {
  const fetcher = (async (_url: unknown, options: RequestInit) => {
    const envelope = JSON.parse(options.body as string);
    assert.equal(
      envelope.signature,
      createHmac('sha256', config.sheetsSecret)
        .update(`${envelope.timestamp}.${envelope.payload}`)
        .digest('hex'),
    );
    return new Response(JSON.stringify({ ok: true, paymentId: record.paymentId }));
  }) as typeof fetch;
  await createSheetsWriter(config.sheetsUrl, config.sheetsSecret, fetcher)(record);
  for (const response of [{ ok: false }, { ok: true, paymentId: 'pi_wrong' }]) {
    await assert.rejects(
      createSheetsWriter(
        config.sheetsUrl,
        config.sheetsSecret,
        (async () => new Response(JSON.stringify(response))) as typeof fetch,
      )(record),
    );
  }
});

test('Apps Script: HMAC, bloqueo, deduplicación por pago y neutralización de fórmulas', () => {
  const rows: unknown[][] = [];
  let locked = false;
  let lockCount = 0;
  const sheet = {
    getLastRow: () => rows.length,
    appendRow: (row: unknown[]) => {
      assert.ok(locked);
      rows.push(row);
    },
    setFrozenRows: () => {},
    getRange: (_row: number, column: number, _count: number, width: number) => ({
      getValues: () => [
        Array.from({ length: width }, (_, i) => rows[0][column - 1 + i] ?? ''),
      ],
      setValues: (values: unknown[][]) => {
        rows[0].splice(column - 1, width, ...values[0]);
      },
      createTextFinder: (id: string) => {
        const finder = {
          matchEntireCell: () => finder,
          useRegularExpression: () => finder,
          findNext: () => rows.slice(1).find((row) => row[0] === id),
        };
        return finder;
      },
    }),
  };
  const context = vm.createContext({
    PropertiesService: {
      getScriptProperties: () => ({
        getProperty: (key: string) =>
          key === 'SHARED_SECRET' ? config.sheetsSecret : 'sheet',
      }),
    },
    Utilities: {
      Charset: { UTF_8: 'utf8' },
      computeHmacSha256Signature: (data: string, secret: string) =>
        Array.from(createHmac('sha256', secret).update(data).digest()),
    },
    LockService: {
      getScriptLock: () => ({
        waitLock: () => {
          assert.equal(locked, false);
          locked = true;
          lockCount++;
        },
        hasLock: () => locked,
        releaseLock: () => {
          locked = false;
        },
      }),
    },
    SpreadsheetApp: {
      openById: () => ({ getSheetByName: () => sheet }),
      flush: () => {},
    },
    ContentService: {
      MimeType: { JSON: 'json' },
      createTextOutput: (text: string) => ({ setMimeType: () => JSON.parse(text) }),
    },
  });
  vm.runInContext(
    readFileSync(new URL('../google-apps-script/Code.gs', import.meta.url), 'utf8'),
    context,
  );
  const invoke = (data: unknown, timestamp = String(Date.now()), tamper = false) => {
    const payload = JSON.stringify(data);
    const signature = createHmac('sha256', config.sheetsSecret)
      .update(`${timestamp}.${payload}`)
      .digest('hex');
    return context.doPost({
      postData: {
        contents: JSON.stringify({
          timestamp,
          payload: tamper ? payload + ' ' : payload,
          signature,
        }),
      },
    });
  };
  assert.equal(invoke(record, String(Date.now() - 600000)).ok, false);
  assert.equal(invoke(record, String(Date.now()), true).ok, false);
  assert.equal(rows.length, 0);
  assert.equal(invoke({ ...record, name: '=IMPORTXML("evil")' }).ok, true);
  assert.equal(rows.length, 2);
  assert.equal(rows[1][4], '\'=IMPORTXML("evil")');
  assert.equal(rows[1][7], 1500.01);
  assert.equal(rows[1][11], 1500.01);
  assert.equal(rows[1][12], 0);
  assert.equal(invoke({ ...record, eventId: 'evt_second' }).duplicate, true);
  assert.equal(rows.length, 2);
  assert.equal(lockCount, 2);
  assert.equal(locked, false);
  rows[0] = rows[0].slice(0, 11); // Upgrade a pre-IVA sheet without changing old rows.
  assert.equal(
    invoke({
      ...record,
      paymentId: 'pi_tax',
      amountCents: 174000,
      subtotalCents: 150000,
      taxCents: 24000,
    }).ok,
    true,
  );
  assert.equal(rows[2][7], 1740);
  assert.equal(rows[2][11], 1500);
  assert.equal(rows[2][12], 240);
  assert.equal(invoke({ ...record, taxCents: 10 }).ok, false);
});
