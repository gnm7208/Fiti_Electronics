// One-time seed script - NOT run by the server, run manually once:
//   node scripts/seedAdminData.js
// Stop the dev server first (lowdb overwrites the whole file on its next
// write, which would silently revert this script's changes otherwise).
//
// Adds costPrice/stock to every product (currently missing entirely) and
// generates ~2 months of synthetic historical orders/pageviews so the admin
// dashboard's stats/charts have realistic-looking data from day one. All of
// this is clearly fabricated demo data - costPrice/stock are editable via
// the dashboard afterward, and real orders/pageviews accumulate naturally on
// top of this without needing to run the script again.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, '..', 'db.json');

const db = JSON.parse(fs.readFileSync(dbPath, 'utf-8'));

// Deterministic pseudo-random generator seeded per-call so re-reading this
// file's output is reproducible from the same seed, without needing a
// dependency - mulberry32.
function mulberry32(seed) {
    let a = seed;
    return function random() {
        a |= 0;
        a = (a + 0x6d2b79f5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

const rng = mulberry32(20260709);

function randomInRange(min, max) {
    return min + rng() * (max - min);
}

function randomIntInRange(min, max) {
    return Math.floor(randomInRange(min, max + 1));
}

// --- 1. costPrice + stock on every product -----------------------------------

const OUT_OF_STOCK_COUNT = 5;
const LOW_STOCK_COUNT = 5;

const shuffledProductIds = [...db.products.map(p => p.id)].sort(() => rng() - 0.5);
const outOfStockIds = new Set(shuffledProductIds.slice(0, OUT_OF_STOCK_COUNT));
const lowStockIds = new Set(shuffledProductIds.slice(OUT_OF_STOCK_COUNT, OUT_OF_STOCK_COUNT + LOW_STOCK_COUNT));

db.products.forEach(product => {
    const marginRatio = randomInRange(0.65, 0.8); // costPrice is 65-80% of sell price
    product.costPrice = Math.round(product.price * marginRatio * 100) / 100;

    if (outOfStockIds.has(product.id)) {
        product.stock = 0;
    } else if (lowStockIds.has(product.id)) {
        product.stock = randomIntInRange(1, 3);
    } else {
        product.stock = randomIntInRange(4, 40);
    }

    // A per-product popularity weight for order generation below - on-offer
    // products and a random factor combine so some products clearly sell
    // better than others (meaningful demand-comparison chart), not a flat
    // uniform distribution.
    product._popularityWeight = (product.originalPrice ? 3 : 1) * randomInRange(0.5, 2.5);
});

// --- 2. ~70 synthetic historical orders over the last ~60 days ---------------

const ORDER_COUNT = 70;
const DAYS_BACK = 60;
const PAYMENT_METHODS = ['M-Pesa (demo)', 'Card (demo)'];

function weightedPick(products, excludeIds) {
    const pool = products.filter(p => !excludeIds.has(p.id));
    const totalWeight = pool.reduce((sum, p) => sum + p._popularityWeight, 0);
    let roll = rng() * totalWeight;
    for (const product of pool) {
        roll -= product._popularityWeight;
        if (roll <= 0) return product;
    }
    return pool[pool.length - 1];
}

let nextOrderId = Math.max(0, ...db.orders.map(o => o.id)) + 1;

for (let i = 0; i < ORDER_COUNT; i++) {
    const daysAgo = randomIntInRange(0, DAYS_BACK - 1);
    const timestamp = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000 - randomIntInRange(0, 23) * 60 * 60 * 1000).toISOString();

    const itemCount = randomIntInRange(1, 3);
    const usedIds = new Set();
    const items = [];
    for (let j = 0; j < itemCount; j++) {
        const product = weightedPick(db.products, usedIds);
        usedIds.add(product.id);
        const qty = randomIntInRange(1, 3);
        items.push({
            id: product.id,
            name: product.name,
            price: product.price,
            image: product.image,
            qty,
            costPrice: product.costPrice, // snapshotted, same convention the live order handler uses
        });
    }

    const amount = items.reduce((sum, item) => sum + item.price * item.qty, 0);
    db.orders.push({
        items,
        timestamp,
        payment: {
            method: PAYMENT_METHODS[randomIntInRange(0, PAYMENT_METHODS.length - 1)],
            amount: Math.round(amount * 100) / 100,
            reference: `SEED-${randomUUID().slice(0, 8)}`,
        },
        id: nextOrderId++,
    });
}

// --- 3. ~150-200 synthetic pageviews over the last 30 days -------------------

const PAGEVIEW_DAYS = 30;
const RETURNING_VISITOR_POOL = Array.from({ length: 15 }, () => randomUUID());

for (let day = 0; day < PAGEVIEW_DAYS; day++) {
    // More recent days trend busier - a linearly increasing base count plus noise.
    const viewsToday = randomIntInRange(2, 4) + Math.round((day / PAGEVIEW_DAYS) * 8);
    for (let v = 0; v < viewsToday; v++) {
        const visitorId = rng() < 0.4
            ? RETURNING_VISITOR_POOL[randomIntInRange(0, RETURNING_VISITOR_POOL.length - 1)]
            : randomUUID();
        const timestamp = new Date(
            Date.now() - (PAGEVIEW_DAYS - 1 - day) * 24 * 60 * 60 * 1000 - randomIntInRange(0, 23) * 60 * 60 * 1000
        ).toISOString();
        db.pageviews.push({ id: randomUUID(), visitorId, timestamp });
    }
}

// Drop the scratch weight field before writing - it's not part of the product schema.
db.products.forEach(product => {
    delete product._popularityWeight;
});

fs.writeFileSync(dbPath, `${JSON.stringify(db, null, 2)}\n`);

console.log(`Seeded costPrice/stock on ${db.products.length} products.`);
console.log(`Added ${ORDER_COUNT} synthetic orders (now ${db.orders.length} total).`);
console.log(`Added synthetic pageviews (now ${db.pageviews.length} total).`);
console.log(`Out of stock: ${[...outOfStockIds].join(', ')} | Low stock: ${[...lowStockIds].join(', ')}`);
