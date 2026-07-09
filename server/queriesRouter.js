import express from 'express';
import { createQueriesStore } from './queriesStore.js';
import { createNotificationsStore } from './notificationsStore.js';
import { isValidName, isValidMessage } from '../js/queries.js';

/** JSON-body route for customer queries (general shop/product questions). */
export function createQueriesRouter(db) {
    const store = createQueriesStore(db);
    const notifications = createNotificationsStore(db);
    const router = express.Router();

    router.post('/', (req, res) => {
        const { name, message, productId, productName } = req.body || {};
        if (!isValidName(name) || !isValidMessage(message)) {
            res.status(400).json({ error: 'A name and a question of at least 5 characters are required' });
            return;
        }
        const record = { name: name.trim(), message: message.trim() };
        if (productId != null && productName) {
            record.productId = productId;
            record.productName = String(productName).trim();
        }
        const query = store.create(record);
        notifications.create({
            type: 'query',
            message: record.productName
                ? `${record.name} asked about ${record.productName}`
                : `${record.name} sent a question about the shop`,
            meta: { queryId: query.id, productId: record.productId || null },
        });
        res.status(201).json(query);
    });

    return router;
}
