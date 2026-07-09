import { randomUUID } from 'crypto';
import express from 'express';

/** Thin wrapper around json-server's lowdb instance for the "pageviews" collection. */
function createPageviewsStore(db) {
    function create({ visitorId }) {
        const pageview = { id: randomUUID(), visitorId, timestamp: new Date().toISOString() };
        db.get('pageviews').push(pageview).write();
        return pageview;
    }
    return { create };
}

// Public, unauthenticated - regular site visitors call this once per page load.
export function createAnalyticsRouter(db) {
    const store = createPageviewsStore(db);
    const router = express.Router();

    router.post('/pageview', (req, res) => {
        const { visitorId } = req.body || {};
        if (typeof visitorId !== 'string' || !visitorId) {
            res.status(400).json({ error: 'visitorId is required' });
            return;
        }
        store.create({ visitorId });
        res.status(201).end();
    });

    return router;
}
