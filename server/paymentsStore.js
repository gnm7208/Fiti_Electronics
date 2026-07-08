import { randomUUID } from 'crypto';

/** Thin wrapper around json-server's lowdb instance for the "payments" collection. */
export function createPaymentsStore(db) {
    function create(record) {
        const payment = {
            id: randomUUID(),
            status: 'pending',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            ...record,
        };
        db.get('payments').push(payment).write();
        return payment;
    }

    function updateByCheckoutRequestId(checkoutRequestId, changes) {
        db.get('payments')
            .find({ checkoutRequestId })
            .assign({ ...changes, updatedAt: new Date().toISOString() })
            .write();
        return db.get('payments').find({ checkoutRequestId }).value();
    }

    function updateById(id, changes) {
        db.get('payments')
            .find({ id })
            .assign({ ...changes, updatedAt: new Date().toISOString() })
            .write();
        return db.get('payments').find({ id }).value();
    }

    function getByCheckoutRequestId(checkoutRequestId) {
        return db.get('payments').find({ checkoutRequestId }).value();
    }

    function getById(id) {
        return db.get('payments').find({ id }).value();
    }

    function getByPaymentIntentId(paymentIntentId) {
        return db.get('payments').find({ paymentIntentId }).value();
    }

    return {
        create,
        updateByCheckoutRequestId,
        updateById,
        getByCheckoutRequestId,
        getById,
        getByPaymentIntentId,
    };
}
