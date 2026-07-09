import { describe, it, expect } from 'vitest';
import { buildOverview, buildProductBreakdown, buildTimeSeries } from '../server/statsAggregator.js';

const products = [
    { id: 1, name: 'Phone', price: 100, costPrice: 60, stock: 5 },
    { id: 2, name: 'Laptop', price: 1000, costPrice: 700, stock: 0 },
    { id: 3, name: 'Never Ordered', price: 50, costPrice: 20, stock: 10 },
];

describe('buildOverview', () => {
    it('sums units sold and revenue using the order item qty (defaulting to 1)', () => {
        const orders = [
            { timestamp: '2026-01-01T00:00:00.000Z', items: [{ id: 1, name: 'Phone', price: 100, qty: 2 }] },
            { timestamp: '2026-01-02T00:00:00.000Z', items: [{ id: 2, name: 'Laptop', price: 1000 }] }, // legacy, no qty
        ];
        const overview = buildOverview(products, orders, []);
        expect(overview.totalUnitsSold).toBe(3);
        expect(overview.totalRevenue).toBe(2 * 100 + 1000);
        expect(overview.totalOrders).toBe(2);
    });

    it('uses a snapshotted item costPrice over the live product costPrice', () => {
        const orders = [
            { timestamp: '2026-01-01T00:00:00.000Z', items: [{ id: 1, name: 'Phone', price: 100, qty: 1, costPrice: 40 }] },
        ];
        const overview = buildOverview(products, orders, []);
        expect(overview.totalProfit).toBe(100 - 40);
        expect(overview.unknownCostLineItems).toBe(0);
    });

    it('falls back to the current product costPrice when the item has no snapshot', () => {
        const orders = [
            { timestamp: '2026-01-01T00:00:00.000Z', items: [{ id: 1, name: 'Phone', price: 100, qty: 1 }] },
        ];
        const overview = buildOverview(products, orders, []);
        expect(overview.totalProfit).toBe(100 - 60);
    });

    it('excludes profit (but still counts revenue/units) for items whose product no longer exists', () => {
        const orders = [
            { timestamp: '2026-01-01T00:00:00.000Z', items: [{ id: 999, name: 'Discontinued', price: 30, qty: 2 }] },
        ];
        const overview = buildOverview(products, orders, []);
        expect(overview.totalRevenue).toBe(60);
        expect(overview.totalProfit).toBe(0);
        expect(overview.unknownCostLineItems).toBe(1);
    });

    it('counts in-stock vs out-of-stock products', () => {
        const overview = buildOverview(products, [], []);
        expect(overview.productsInStock).toBe(2);
        expect(overview.productsOutOfStock).toBe(1);
    });

    it('counts unique visitors distinct from total pageviews', () => {
        const pageviews = [
            { visitorId: 'a', timestamp: '2026-01-01T00:00:00.000Z' },
            { visitorId: 'a', timestamp: '2026-01-02T00:00:00.000Z' },
            { visitorId: 'b', timestamp: '2026-01-02T00:00:00.000Z' },
        ];
        const overview = buildOverview(products, [], pageviews);
        expect(overview.totalPageviews).toBe(3);
        expect(overview.uniqueVisitors).toBe(2);
    });
});

describe('buildProductBreakdown', () => {
    it('includes products with zero sales', () => {
        const breakdown = buildProductBreakdown(products, []);
        const neverOrdered = breakdown.find(p => p.id === 3);
        expect(neverOrdered.unitsSold).toBe(0);
        expect(neverOrdered.deleted).toBe(false);
    });

    it('flags a product referenced only by order items (since deleted) rather than assuming zero cost', () => {
        const orders = [
            { timestamp: '2026-01-01T00:00:00.000Z', items: [{ id: 999, name: 'Discontinued', price: 30, qty: 1 }] },
        ];
        const breakdown = buildProductBreakdown(products, orders);
        const deleted = breakdown.find(p => p.id === 999);
        expect(deleted.deleted).toBe(true);
        expect(deleted.name).toBe('Discontinued');
        expect(deleted.revenue).toBe(30);
        expect(deleted.profit).toBe(0);
    });

    it('sorts by units sold descending', () => {
        const orders = [
            { timestamp: '2026-01-01T00:00:00.000Z', items: [{ id: 1, name: 'Phone', price: 100, qty: 1 }] },
            { timestamp: '2026-01-02T00:00:00.000Z', items: [{ id: 2, name: 'Laptop', price: 1000, qty: 5 }] },
        ];
        const breakdown = buildProductBreakdown(products, orders);
        expect(breakdown[0].id).toBe(2);
    });
});

describe('buildTimeSeries', () => {
    it('buckets pageviews, orders, and revenue by day', () => {
        const today = new Date().toISOString().slice(0, 10);
        const pageviews = [{ visitorId: 'a', timestamp: `${today}T10:00:00.000Z` }];
        const orders = [{ timestamp: `${today}T11:00:00.000Z`, items: [{ id: 1, name: 'Phone', price: 100, qty: 2 }] }];
        const series = buildTimeSeries(orders, pageviews, 7);
        expect(series).toHaveLength(7);
        const todayBucket = series[series.length - 1];
        expect(todayBucket.date).toBe(today);
        expect(todayBucket.pageviews).toBe(1);
        expect(todayBucket.orders).toBe(1);
        expect(todayBucket.revenue).toBe(200);
    });

    it('ignores events outside the requested window', () => {
        const orders = [{ timestamp: '2000-01-01T00:00:00.000Z', items: [{ id: 1, name: 'Phone', price: 100, qty: 1 }] }];
        const series = buildTimeSeries(orders, [], 7);
        expect(series.every(bucket => bucket.orders === 0)).toBe(true);
    });
});
