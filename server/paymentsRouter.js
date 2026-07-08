import express from 'express';
import { initiateStkPush, queryStkStatus, parseCallback } from './mpesa.js';
import { createPaymentIntent, constructWebhookEvent } from './stripeService.js';
import { createPaymentsStore } from './paymentsStore.js';
import { config, mpesaConfigured, stripeConfigured } from './config.js';

/** JSON-body routes for M-Pesa STK Push and Stripe PaymentIntents. */
export function createPaymentsRouter(db) {
    const store = createPaymentsStore(db);
    const router = express.Router();

    router.get('/status-check', (_req, res) => {
        res.json({ mpesa: mpesaConfigured(), stripe: stripeConfigured() });
    });

    // Publishable key is safe to expose - it only identifies the account, it
    // can't move money on its own. The frontend needs it to build the Stripe.js
    // Elements form.
    router.get('/stripe/config', (_req, res) => {
        if (!stripeConfigured()) {
            res.status(503).json({ error: 'Stripe is not configured on this server' });
            return;
        }
        res.json({ publishableKey: config.stripe.publishableKey });
    });

    router.post('/mpesa/stkpush', async (req, res) => {
        const { phone, amount, orderReference, description } = req.body || {};
        if (!phone || !amount) {
            res.status(400).json({ error: 'phone and amount are required' });
            return;
        }
        try {
            const result = await initiateStkPush({
                phone,
                amount,
                accountReference: orderReference || 'FitiElectronics',
                description: description || 'Fiti Electronics purchase',
            });
            store.create({
                method: 'mpesa',
                amount,
                currency: 'KES',
                reference: orderReference || null,
                phone,
                checkoutRequestId: result.CheckoutRequestID,
                merchantRequestId: result.MerchantRequestID,
            });
            res.json({
                checkoutRequestId: result.CheckoutRequestID,
                customerMessage: result.CustomerMessage,
            });
        } catch (error) {
            res.status(502).json({ error: error.message });
        }
    });

    router.get('/mpesa/status/:checkoutRequestId', async (req, res) => {
        const { checkoutRequestId } = req.params;
        const stored = store.getByCheckoutRequestId(checkoutRequestId);
        if (stored && stored.status !== 'pending') {
            res.json(stored);
            return;
        }
        try {
            const result = await queryStkStatus(checkoutRequestId);
            if (String(result.ResultCode) === '0') {
                const updated = store.updateByCheckoutRequestId(checkoutRequestId, {
                    status: 'success',
                    resultDesc: result.ResultDesc,
                });
                res.json(updated || { status: 'success', resultDesc: result.ResultDesc });
                return;
            }
            if (result.errorCode) {
                // Safaricom returns errorCode 500.001.1001 while the prompt is still awaiting the user
                res.json(stored || { status: 'pending' });
                return;
            }
            const updated = store.updateByCheckoutRequestId(checkoutRequestId, {
                status: 'failed',
                resultDesc: result.ResultDesc,
            });
            res.json(updated || { status: 'failed', resultDesc: result.ResultDesc });
        } catch (error) {
            res.json(stored || { status: 'pending', error: error.message });
        }
    });

    router.post('/mpesa/callback', (req, res) => {
        const parsed = parseCallback(req.body);
        if (parsed) {
            store.updateByCheckoutRequestId(parsed.checkoutRequestId, {
                status: parsed.success ? 'success' : 'failed',
                resultDesc: parsed.resultDesc,
                mpesaReceiptNumber: parsed.mpesaReceiptNumber,
            });
        }
        // Safaricom expects a 200 acknowledgement regardless of business outcome
        res.json({ ResultCode: 0, ResultDesc: 'Accepted' });
    });

    router.post('/stripe/create-payment-intent', async (req, res) => {
        const { amount, currency, orderReference } = req.body || {};
        if (!amount) {
            res.status(400).json({ error: 'amount is required' });
            return;
        }
        try {
            const intent = await createPaymentIntent({ amount, currency, orderReference });
            store.create({
                method: 'stripe',
                amount,
                currency: currency || 'usd',
                reference: orderReference || null,
                paymentIntentId: intent.id,
            });
            res.json({ clientSecret: intent.client_secret });
        } catch (error) {
            res.status(502).json({ error: error.message });
        }
    });

    return router;
}

/** Raw-body Stripe webhook handler (must be mounted with express.raw, not express.json). */
export function createStripeWebhookHandler(db) {
    const store = createPaymentsStore(db);
    return (req, res) => {
        const signature = req.headers['stripe-signature'];
        let event;
        try {
            event = constructWebhookEvent(req.body, signature);
        } catch (error) {
            res.status(400).send(`Webhook signature verification failed: ${error.message}`);
            return;
        }

        if (
            event.type === 'payment_intent.succeeded' ||
            event.type === 'payment_intent.payment_failed'
        ) {
            const intent = event.data.object;
            const payment = store.getByPaymentIntentId(intent.id);
            if (payment) {
                store.updateById(payment.id, {
                    status: event.type === 'payment_intent.succeeded' ? 'success' : 'failed',
                });
            }
        }
        res.json({ received: true });
    };
}
