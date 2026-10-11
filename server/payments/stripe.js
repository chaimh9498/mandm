/** Optional, independent Stripe Checkout extension. Nothing charges until configured. */
import Stripe from 'stripe';

export const stripeSettings = () => ({
  enabledFlag: process.env.STRIPE_ENABLED === 'true',
  hasSecretKey: !!process.env.STRIPE_SECRET_KEY,
  hasWebhookSecret: !!process.env.STRIPE_WEBHOOK_SECRET,
  hasBaseUrl: !!process.env.PUBLIC_BASE_URL,
  collectShipping: process.env.STRIPE_COLLECT_SHIPPING === 'true',
  automaticTax: process.env.STRIPE_AUTOMATIC_TAX === 'true',
  testMode: process.env.STRIPE_SECRET_KEY?.startsWith('sk_test_') ?? null
});
export const stripeReady = () => {
  const c = stripeSettings();
  return c.enabledFlag && c.hasSecretKey && c.hasWebhookSecret && c.hasBaseUrl;
};
export function getStripe() {
  if (!stripeReady()) throw new Error('Stripe is not connected yet.');
  return new Stripe(process.env.STRIPE_SECRET_KEY);
}

export async function openCheckout({ items, orderId }) {
  const stripe = getStripe();
  const baseUrl = process.env.PUBLIC_BASE_URL.replace(/\/$/, '');
  const line_items = items.map(({ product, quantity }) => ({
    price_data: {
      currency: 'usd',
      unit_amount: product.priceCents,
      product_data: { name: product.name, description: product.description?.slice(0, 500) || undefined }
    },
    quantity
  }));
  const options = {
    line_items,
    mode: 'payment',
    client_reference_id: orderId,
    metadata: { order_id: orderId },
    success_url: `${baseUrl}/?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${baseUrl}/?checkout=cancelled`,
    billing_address_collection: 'auto'
  };
  if (process.env.STRIPE_COLLECT_SHIPPING === 'true') {
    const allowed_countries = (process.env.STRIPE_SHIPPING_COUNTRIES || 'US').split(',').map(x => x.trim().toUpperCase()).filter(Boolean);
    options.shipping_address_collection = { allowed_countries };
  }
  if (process.env.STRIPE_AUTOMATIC_TAX === 'true') options.automatic_tax = { enabled: true };
  return stripe.checkout.sessions.create(options, { idempotencyKey: `order-${orderId}` });
}

export function verifyWebhook(rawBody, signature) {
  if (!stripeReady()) throw new Error('Stripe is disabled');
  return getStripe().webhooks.constructEvent(rawBody, signature, process.env.STRIPE_WEBHOOK_SECRET);
}