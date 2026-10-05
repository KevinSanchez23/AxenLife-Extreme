export interface Config {
  host: string;
  port: number;
  origin: string;
  successUrl: string;
  cancelUrl: string;
  stripeSecretKey: string;
  stripeWebhookSecret: string;
  sheetsUrl: string;
  sheetsSecret: string;
  maxAmountCents: number;
  trustProxyHops: number;
}

export function loadConfig(env = process.env): Config {
  const required = (key: string) => {
    const value = env[key]?.trim();
    if (!value) throw new Error(`Falta ${key}`);
    return value;
  };
  const integer = (key: string, fallback: number, min: number, max: number) => {
    const value = env[key] === undefined ? fallback : Number(env[key]);
    if (!Number.isSafeInteger(value) || value < min || value > max)
      throw new Error(`${key} inválido`);
    return value;
  };
  const origin = new URL(required('PUBLIC_SITE_URL'));
  if (
    origin.username ||
    origin.password ||
    origin.search ||
    origin.hash ||
    !(
      origin.protocol === 'https:' ||
      (env.NODE_ENV !== 'production' &&
        origin.protocol === 'http:' &&
        ['localhost', '127.0.0.1'].includes(origin.hostname))
    )
  ) {
    throw new Error(
      'PUBLIC_SITE_URL debe usar HTTPS (HTTP local permitido en desarrollo)',
    );
  }
  const success = new URL(origin);
  success.searchParams.set('pago', 'recibido');
  const cancel = new URL(origin);
  cancel.searchParams.set('pago', 'cancelado');
  const sheets = new URL(required('GOOGLE_SHEETS_WEB_APP_URL'));
  if (
    sheets.origin !== 'https://script.google.com' ||
    !/^\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(sheets.pathname) ||
    sheets.search ||
    sheets.hash
  ) {
    throw new Error(
      'GOOGLE_SHEETS_WEB_APP_URL debe ser la URL /exec del Apps Script publicado',
    );
  }
  const sheetsSecret = required('GOOGLE_SHEETS_SHARED_SECRET');
  if (sheetsSecret.length < 32)
    throw new Error(
      'GOOGLE_SHEETS_SHARED_SECRET necesita al menos 32 caracteres aleatorios',
    );
  const stripeSecretKey = required('STRIPE_SECRET_KEY');
  const stripeWebhookSecret = required('STRIPE_WEBHOOK_SECRET');
  if (!/^(sk|rk)_(test|live)_\S+$/.test(stripeSecretKey)) {
    throw new Error(
      'STRIPE_SECRET_KEY inválida: usa una clave secreta sk_test_/sk_live_ o restringida rk_test_/rk_live_. No uses la clave pública pk_.',
    );
  }
  if (!/^whsec_\S+$/.test(stripeWebhookSecret)) {
    throw new Error(
      'STRIPE_WEBHOOK_SECRET inválido: debe ser el secreto whsec_ del webhook o de stripe listen.',
    );
  }
  return {
    host: env.HOST?.trim() || '127.0.0.1',
    port: integer('PORT', 3001, 1, 65535),
    origin: origin.origin,
    successUrl: `${success.href}&session_id={CHECKOUT_SESSION_ID}`,
    cancelUrl: cancel.href,
    stripeSecretKey,
    stripeWebhookSecret,
    sheetsUrl: sheets.href,
    sheetsSecret,
    maxAmountCents: integer('MAX_AMOUNT_CENTS', 99999999, 150000, 99999999),
    trustProxyHops: integer('TRUST_PROXY_HOPS', 0, 0, 5),
  };
}
