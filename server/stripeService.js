import Stripe from 'stripe';
import { config, stripeConfigured } from './config.js';

let stripeClient = null;
function getClient() {
    if (!stripeConfigured()) {
        throw new Error('Stripe is not configured on this server (missing STRIPE_SECRET_KEY).');
    }
    if (!stripeClient) {
        stripeClient = new Stripe(config.stripe.secretKey);
    }
    return stripeClient;
}

/** Create a PaymentIntent for the given cart total (amount in whole currency units). */
export async function createPaymentIntent({ amount, currency = 'usd', orderReference }) {
    const stripe = getClient();
    return stripe.paymentIntents.create({
        amount: Math.round(amount * 100), // Stripe expects the smallest currency unit (cents)
        currency,
        automatic_payment_methods: { enabled: true },
        metadata: orderReference ? { orderReference } : undefined,
    });
}

/** Verify and parse an incoming Stripe webhook request. `rawBody` must be the raw request buffer. */
export function constructWebhookEvent(rawBody, signature) {
    const stripe = getClient();
    return stripe.webhooks.constructEvent(rawBody, signature, config.stripe.webhookSecret);
}
