// Pure stats/aggregation logic - no Express, no db coupling. Takes plain
// arrays (as read from db.json) and returns computed numbers, so this is
// fully unit-testable, same separation-of-concerns convention as js/cart.js.

/** Mirrors normalizeCart's qty-default convention for legacy order items. */
function itemQty(item) {
    return item.qty || 1;
}

/**
 * Resolves an order item's per-unit cost: the item's own snapshotted cost
 * (taken at order-creation time going forward) takes priority; falls back to
 * the product's *current* costPrice only for legacy/seeded orders that never
 * snapshotted one. Returns null (not 0) when the cost is genuinely unknown -
 * e.g. the product has since been deleted - so callers don't silently treat
 * a discontinued product as 100%-margin.
 */
function resolveItemCost(item, productsById) {
    if (typeof item.costPrice === 'number') return item.costPrice;
    const product = productsById.get(item.id);
    if (product && typeof product.costPrice === 'number') return product.costPrice;
    return null;
}

function productsIndex(products) {
    return new Map(products.map(p => [p.id, p]));
}

function toDateKey(isoString) {
    return String(isoString).slice(0, 10);
}

/** Overall totals for the dashboard's stat-tile row. */
export function buildOverview(products, orders, pageviews) {
    const productsById = productsIndex(products);
    let totalUnitsSold = 0;
    let totalRevenue = 0;
    let totalProfit = 0;
    let unknownCostLineItems = 0;

    for (const order of orders) {
        for (const item of order.items || []) {
            const qty = itemQty(item);
            totalUnitsSold += qty;
            totalRevenue += item.price * qty;
            const cost = resolveItemCost(item, productsById);
            if (cost === null) {
                unknownCostLineItems += 1;
            } else {
                totalProfit += (item.price - cost) * qty;
            }
        }
    }

    const productsInStock = products.filter(p => (p.stock || 0) > 0).length;
    const productsOutOfStock = products.filter(p => (p.stock || 0) <= 0).length;
    const uniqueVisitors = new Set(pageviews.map(pv => pv.visitorId)).size;

    return {
        totalOrders: orders.length,
        totalUnitsSold,
        totalRevenue,
        totalProfit,
        unknownCostLineItems,
        productsInStock,
        productsOutOfStock,
        totalPageviews: pageviews.length,
        uniqueVisitors,
    };
}

/**
 * Per-product sales breakdown, including products that were never ordered
 * (0 units sold) and products since deleted from the catalogue (flagged
 * `deleted: true`, name taken from the order item snapshot) - both matter for
 * an admin deciding what to restock vs. phase out. Sorted by unitsSold desc.
 */
export function buildProductBreakdown(products, orders) {
    const productsById = productsIndex(products);
    const byId = new Map();

    for (const product of products) {
        byId.set(product.id, {
            id: product.id,
            name: product.name,
            image: product.image,
            price: product.price,
            costPrice: product.costPrice,
            stock: product.stock,
            unitsSold: 0,
            revenue: 0,
            profit: 0,
            deleted: false,
        });
    }

    for (const order of orders) {
        for (const item of order.items || []) {
            const qty = itemQty(item);
            let entry = byId.get(item.id);
            if (!entry) {
                entry = {
                    id: item.id,
                    name: item.name,
                    image: item.image,
                    price: item.price,
                    costPrice: undefined,
                    stock: 0,
                    unitsSold: 0,
                    revenue: 0,
                    profit: 0,
                    deleted: true,
                };
                byId.set(item.id, entry);
            }
            const cost = resolveItemCost(item, productsById);
            entry.unitsSold += qty;
            entry.revenue += item.price * qty;
            if (cost !== null) entry.profit += (item.price - cost) * qty;
        }
    }

    return Array.from(byId.values()).sort((a, b) => b.unitsSold - a.unitsSold);
}

/** Daily buckets (oldest to newest) of pageviews/orders/revenue for the last `days` days. */
export function buildTimeSeries(orders, pageviews, days = 30) {
    const buckets = new Map();
    const today = new Date();
    for (let i = days - 1; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        const key = date.toISOString().slice(0, 10);
        buckets.set(key, { date: key, pageviews: 0, orders: 0, revenue: 0 });
    }

    for (const pv of pageviews) {
        const bucket = buckets.get(toDateKey(pv.timestamp));
        if (bucket) bucket.pageviews += 1;
    }

    for (const order of orders) {
        const bucket = buckets.get(toDateKey(order.timestamp));
        if (!bucket) continue;
        bucket.orders += 1;
        for (const item of order.items || []) {
            bucket.revenue += item.price * itemQty(item);
        }
    }

    return Array.from(buckets.values());
}
