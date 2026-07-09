import { createProductsStore } from './productsStore.js';
import { createNotificationsStore } from './notificationsStore.js';

const LOW_STOCK_THRESHOLD = 3;

function itemQty(item) {
    return item.qty || 1;
}

function formatMoney(amount) {
    return Number(amount).toFixed(2);
}

/**
 * Takes over POST /orders from json-server's generic auto-REST handler (this
 * route is registered before `server.use(router)` in server.js, so Express's
 * first-match routing means the generic router never sees it) to enforce
 * stock, snapshot cost/price onto each item, decrement stock, and fire
 * order/stock notifications - none of which json-server's generic handler
 * can do.
 */
export function createOrderHandler(db) {
    const products = createProductsStore(db);
    const notifications = createNotificationsStore(db);

    return (req, res) => {
        const { items, payment } = req.body || {};
        if (!Array.isArray(items) || items.length === 0) {
            res.status(400).json({ error: 'items is required and must be a non-empty array' });
            return;
        }

        const insufficient = [];
        for (const item of items) {
            const product = products.getById(item.id);
            if (product && (product.stock || 0) < itemQty(item)) {
                insufficient.push({ id: product.id, name: product.name, available: product.stock || 0, requested: itemQty(item) });
            }
        }
        if (insufficient.length > 0) {
            res.status(409).json({ error: 'Insufficient stock for one or more items', insufficientItems: insufficient });
            return;
        }

        const stockNotifications = [];
        const snapshottedItems = items.map(item => {
            const product = products.getById(item.id);
            if (!product) return item;

            const qty = itemQty(item);
            const previousStock = product.stock || 0;
            const updated = products.decrementStock(item.id, qty);
            if (previousStock > 0 && updated.stock === 0) {
                stockNotifications.push({
                    type: 'out_of_stock',
                    message: `${product.name} is now out of stock`,
                    meta: { productId: product.id },
                });
            } else if (previousStock > LOW_STOCK_THRESHOLD && updated.stock <= LOW_STOCK_THRESHOLD) {
                stockNotifications.push({
                    type: 'low_stock',
                    message: `${product.name} is running low (${updated.stock} left)`,
                    meta: { productId: product.id },
                });
            }

            return { ...item, costPrice: product.costPrice };
        });

        const order = {
            items: snapshottedItems,
            timestamp: new Date().toISOString(),
            ...(payment && { payment }),
        };
        const created = db.get('orders').insert(order).value();
        db.write();

        const totalUnits = snapshottedItems.reduce((sum, item) => sum + itemQty(item), 0);
        const total = snapshottedItems.reduce((sum, item) => sum + item.price * itemQty(item), 0);
        notifications.create({
            type: 'order',
            message: `New order: ${totalUnits === 1 ? '1 item' : `${totalUnits} items`}, $${formatMoney(total)}`,
            meta: { orderId: created.id },
        });
        stockNotifications.forEach(n => notifications.create(n));

        res.status(201).json(created);
    };
}
