// Pure cart logic - no DOM, no fetch. Every function returns a NEW cart
// array (immutable updates), which keeps this fully unit-testable.

/** Add a product to the cart, bumping qty if the line already exists. */
export function addItem(cart, product) {
    const existing = cart.find(line => line.id === product.id);
    if (existing) {
        return cart.map(line =>
            line.id === product.id ? { ...line, qty: line.qty + 1 } : line
        );
    }
    return [
        ...cart,
        {
            id: product.id,
            name: product.name,
            price: product.price,
            image: product.image,
            qty: 1,
        },
    ];
}

/** Increase a line's quantity by one. */
export function incrementItem(cart, productId) {
    return cart.map(line =>
        line.id === productId ? { ...line, qty: line.qty + 1 } : line
    );
}

/** Decrease a line's quantity by one, dropping the line at zero. */
export function decrementItem(cart, productId) {
    return cart
        .map(line =>
            line.id === productId ? { ...line, qty: line.qty - 1 } : line
        )
        .filter(line => line.qty > 0);
}

/** Remove a line entirely. */
export function removeItem(cart, productId) {
    return cart.filter(line => line.id !== productId);
}

/** Total number of units in the cart. */
export function itemCount(cart) {
    return cart.reduce((sum, line) => sum + line.qty, 0);
}

/** Total cost of the cart. */
export function cartTotal(cart) {
    return cart.reduce((sum, line) => sum + line.price * line.qty, 0);
}

/** Normalize cart data loaded from storage (legacy lines lack qty). */
export function normalizeCart(data) {
    if (!Array.isArray(data)) return [];
    return data.map(line => ({ ...line, qty: line.qty || 1 }));
}
