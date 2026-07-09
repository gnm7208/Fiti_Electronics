import express from 'express';
import { createNotificationsStore } from './notificationsStore.js';
import { subscribeToNotifications } from './notificationsHub.js';

export function createNotificationsRouter(db) {
    const store = createNotificationsStore(db);
    const router = express.Router();

    router.get('/', (_req, res) => {
        res.json(store.list());
    });

    router.post('/:id/read', (req, res) => {
        res.json(store.markRead(req.params.id));
    });

    // Native EventSource sends cookies same-origin by default, so the existing
    // requireAdminAuth cookie check (applied before this router mounts) already
    // protects this stream - no separate token handshake needed.
    router.get('/stream', (req, res) => {
        res.set({
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            Connection: 'keep-alive',
        });
        res.flushHeaders();

        const unsubscribe = subscribeToNotifications(notification => {
            res.write(`data: ${JSON.stringify(notification)}\n\n`);
            // json-server's defaults() wraps every response in gzip
            // compression, which buffers writes internally for better ratios -
            // fatal for SSE, where res.write() would otherwise sit in that
            // buffer indefinitely since this response never ends. res.flush()
            // is added by the `compression` middleware specifically to force
            // a chunk out now; optional-chained in case compression is ever
            // disabled (`--noGzip`), where a plain write is already unbuffered.
            res.flush?.();
        });

        req.on('close', unsubscribe);
    });

    return router;
}
