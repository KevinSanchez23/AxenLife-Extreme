import Stripe from 'stripe';
import { createApp } from './app.js';
import { loadConfig } from './config.js';
import { createSheetsWriter } from './sheets.js';

const config = loadConfig();
const stripe = new Stripe(config.stripeSecretKey, {
  timeout: 15000,
  maxNetworkRetries: 1,
});
const app = createApp(config, {
  stripe,
  writePayment: createSheetsWriter(config.sheetsUrl, config.sheetsSecret),
});
// Solo loopback: publicar a través del proxy HTTPS del servidor de Azure.
const server = app.listen(config.port, '127.0.0.1', () =>
  console.log(`API escuchando en 127.0.0.1:${config.port}`),
);
server.requestTimeout = 30000;
server.headersTimeout = 10000;
for (const signal of ['SIGINT', 'SIGTERM'])
  process.on(signal, () => {
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 10000).unref();
  });
