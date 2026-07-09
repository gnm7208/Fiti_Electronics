// Custom server: json-server's REST API (products/cart/orders) plus real
// payment routes (M-Pesa Daraja STK Push, Stripe PaymentIntents), customer
// queries, and an admin dashboard API (auth, product CRUD, stats,
// notifications, analytics). Kept as a thin wrapper so the existing
// json-server behavior is unchanged where it isn't explicitly overridden.
import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import cookieParser from 'cookie-parser';
import jsonServer from 'json-server';
import { config } from './server/config.js';
import { createPaymentsRouter, createStripeWebhookHandler } from './server/paymentsRouter.js';
import { createQueriesRouter } from './server/queriesRouter.js';
import { createAdminAuthRouter, requireAdminAuth } from './server/adminAuth.js';
import { createAdminProductsRouter } from './server/adminProductsRouter.js';
import { createAdminStatsRouter } from './server/adminStatsRouter.js';
import { createNotificationsRouter } from './server/notificationsRouter.js';
import { createAnalyticsRouter } from './server/analyticsRouter.js';
import { createOrderHandler } from './server/orderHandler.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, 'db.json');

const server = jsonServer.create();
const router = jsonServer.router(dbPath);
const middlewares = jsonServer.defaults({ static: __dirname });

server.use(middlewares);
server.use(cookieParser());

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

server.use('/api/analytics', express.json());
server.use('/api/analytics', createAnalyticsRouter(router.db));

server.use('/api/admin/auth', express.json());
server.use('/api/admin/auth', createAdminAuthRouter());

// Product photo uploads use multipart/form-data (parsed by multer inside the
// router itself), not express.json() - only the auth check is added here.
server.use('/api/admin/products', requireAdminAuth, createAdminProductsRouter(router.db));

server.use('/api/admin/stats', requireAdminAuth, createAdminStatsRouter(router.db));

server.use('/api/admin/notifications', requireAdminAuth, express.json());
server.use('/api/admin/notifications', createNotificationsRouter(router.db));

// Takes over order creation from json-server's generic auto-REST handler
// (registered before `server.use(router)` below, so Express's first-match
// routing means the generic router never sees POST /orders) to enforce
// stock, snapshot cost/price, and fire notifications.
server.post('/orders', express.json(), createOrderHandler(router.db));

// Several collections must not be reachable through json-server's generic
// auto-generated REST routes:
// - "payments"/"queries"/"notifications"/"pageviews" hold customer/business data
//   not meant to be publicly listable, and are only reachable via the
//   controlled /api/* routes above.
// - "products" writes (POST/PUT/PATCH/DELETE) must go through the
//   authenticated /api/admin/products/* routes - only GET (browsing) stays public.
// - "orders" is fully blocked here - writes go through the interception
//   handler above, reads are admin-only via /api/admin/stats/*.
server.use((req, res, next) => {
    const blockedEntirely = ['/payments', '/queries', '/notifications', '/pageviews', '/orders'];
    const matches = (prefix) => req.path === prefix || req.path.startsWith(`${prefix}/`);

    if (blockedEntirely.some(matches)) {
        res.status(404).end();
        return;
    }
    if (matches('/products') && req.method !== 'GET') {
        res.status(404).end();
        return;
    }
    next();
});

server.use(router);

server.listen(config.port, '0.0.0.0', () => {
    console.log(`Fiti Electronics server running on port ${config.port}`);
});
