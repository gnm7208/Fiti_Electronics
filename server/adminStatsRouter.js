import express from 'express';
import { buildOverview, buildProductBreakdown, buildTimeSeries } from './statsAggregator.js';

export function createAdminStatsRouter(db) {
    const router = express.Router();

    router.get('/overview', (_req, res) => {
        res.json(buildOverview(db.get('products').value(), db.get('orders').value(), db.get('pageviews').value()));
    });

    router.get('/timeseries', (req, res) => {
        const days = Math.min(180, Math.max(1, Number(req.query.days) || 30));
        res.json(buildTimeSeries(db.get('orders').value(), db.get('pageviews').value(), days));
    });

    router.get('/products', (_req, res) => {
        res.json(buildProductBreakdown(db.get('products').value(), db.get('orders').value()));
    });

    return router;
}
