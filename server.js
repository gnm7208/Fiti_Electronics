// Custom server: json-server's REST API (products/cart/orders) plus real
// payment routes (M-Pesa Daraja STK Push, Stripe PaymentIntents). Kept as a
// thin wrapper so the existing json-server behavior is unchanged.
import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import jsonServer from 'json-server';
import { config } from './server/config.js';
import { createPaymentsRouter, createStripeWebhookHandler } from './server/paymentsRouter.js';
import { createQueriesRouter } from './server/queriesRouter.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, 'db.json');

const server = jsonServer.create();
const router = jsonServer.router(dbPath);
const middlewares = jsonServer.defaults({ static: __dirname });

server.use(middlewares);

// Stripe requires the raw request body to verify the webhook signature, so this
// route must be registered before the JSON body parser below.
server.post(
    '/api/payments/stripe/webhook',
    express.raw({ type: 'application/json' }),
    createStripeWebhookHandler(router.db)
);

server.use('/api/payments', express.json());
server.use('/api/payments', createPaymentsRouter(router.db));

server.use('/api/queries', express.json());
server.use('/api/queries', createQueriesRouter(router.db));

// The "payments" and "queries" collections hold phone numbers/customer names -
// keep them reachable only through the controlled /api/* routes above, not
// json-server's auto-generated public REST endpoints for those collections.
server.use((req, res, next) => {
    if (
        req.path === '/payments' || req.path.startsWith('/payments/') ||
        req.path === '/queries' || req.path.startsWith('/queries/')
    ) {
        res.status(404).end();
        return;
    }
    next();
});

server.use(router);

server.listen(config.port, '0.0.0.0', () => {
    console.log(`Fiti Electronics server running on port ${config.port}`);
});
