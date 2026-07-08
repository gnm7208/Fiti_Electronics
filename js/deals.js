// Pure deals/discount logic - no DOM, no fetch. Same pattern as js/cart.js.

/** A product is "on offer" when it carries an originalPrice higher than its current price. */
export function isOnOffer(product) {
    return typeof product.originalPrice === 'number' && product.originalPrice > product.price;
}

/** Filter a product list down to only those currently on offer. */
export function getDeals(products) {
    return products.filter(isOnOffer);
}

/** Whole-number percentage saved off the original price. */
export function discountPercent(price, originalPrice) {
    if (!originalPrice || originalPrice <= 0) return 0;
    return Math.round(((originalPrice - price) / originalPrice) * 100);
}
