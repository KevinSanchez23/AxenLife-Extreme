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
// Docker usa HOST=0.0.0.0; Compose publica el puerto solo en loopback del host.
const server = app.listen(config.port, config.host, () =>
  console.log(`API escuchando en ${config.host}:${config.port}`),
);
server.requestTimeout = 30000;
server.headersTimeout = 10000;
for (const signal of ['SIGINT', 'SIGTERM'])
  process.on(signal, () => {
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 10000).unref();
  });
