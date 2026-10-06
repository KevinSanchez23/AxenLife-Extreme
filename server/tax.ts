import type Stripe from 'stripe';

// One exclusive, fixed rate. No customer-location tax calculation is enabled.
export function createVatRateResolver(stripe: Stripe) {
  let pending: Promise<string> | undefined;
  return () => {
    pending ??= (async () => {
      for await (const rate of stripe.taxRates.list({ active: true, limit: 100 })) {
        if (
          rate.metadata?.source === 'axen-life-extreme-iva-v1' &&
          rate.percentage === 16 &&
          !rate.inclusive &&
          rate.display_name === 'IVA'
        ) {
          return rate.id;
        }
      }
      const rate = await stripe.taxRates.create(
        {
          display_name: 'IVA',
          percentage: 16,
          inclusive: false,
          country: 'MX',
          metadata: { source: 'axen-life-extreme-iva-v1' },
        },
        { idempotencyKey: 'axen-life-extreme-iva-16-exclusive-v1' },
      );
      return rate.id;
    })().catch((error) => {
      pending = undefined;
      throw error;
    });
    return pending;
  };
}
