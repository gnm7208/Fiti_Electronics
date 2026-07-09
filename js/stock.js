// Pure stock-status logic - no DOM, no fetch. Same pattern as js/deals.js.

export const LOW_STOCK_THRESHOLD = 3;

/** A product with no stock field is treated as always in stock (pre-stock-tracking data). */
export function isOutOfStock(product) {
    return typeof product.stock === 'number' && product.stock <= 0;
}

/** Low but not zero - a "running low" hint, distinct from fully out of stock. */
export function isLowStock(product, threshold = LOW_STOCK_THRESHOLD) {
    return typeof product.stock === 'number' && product.stock > 0 && product.stock <= threshold;
}

/** How many more units of this product can currently be added to a cart. */
export function availableToAdd(product) {
    return typeof product.stock === 'number' ? Math.max(0, product.stock) : Infinity;
}
