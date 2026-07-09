/** Thin wrapper around json-server's lowdb instance for the "products" collection. */
export function createProductsStore(db) {
    function getAll() {
        return db.get('products').value();
    }

    function getById(id) {
        return db.get('products').find({ id: Number(id) }).value();
    }

    // Uses json-server's own lodash-id mixin (same as its generic POST handler)
    // so admin-created products get ids consistent with the existing catalogue.
    function create(product) {
        const created = db.get('products').insert(product).value();
        db.write();
        return created;
    }

    function update(id, changes) {
        db.get('products').find({ id: Number(id) }).assign(changes).write();
        return getById(id);
    }

    function remove(id) {
        db.get('products').remove({ id: Number(id) }).write();
    }

    /** Clamped at 0 as a safety net - callers should validate sufficient stock first. */
    function decrementStock(id, qty) {
        const product = getById(id);
        if (!product) return null;
        const nextStock = Math.max(0, (product.stock || 0) - qty);
        return update(id, { stock: nextStock });
    }

    return { getAll, getById, create, update, remove, decrementStock };
}
