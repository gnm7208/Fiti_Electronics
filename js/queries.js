// Pure query-form logic - no DOM, no fetch. Same pattern as js/payments.js.

/** A name must be non-empty after trimming and at least 2 characters. */
export function isValidName(name) {
    return typeof name === 'string' && name.trim().length >= 2;
}

/** A message must be non-empty after trimming and at least 5 characters. */
export function isValidMessage(message) {
    return typeof message === 'string' && message.trim().length >= 5;
}

/**
 * Assemble the payload sent to /api/queries from raw form input. Trims
 * strings and only includes product context fields when both are present,
 * so a general (non-product) query doesn't carry empty productId/productName.
 */
export function buildQueryPayload({ name, message, productId, productName }) {
    const payload = {
        name: String(name).trim(),
        message: String(message).trim(),
    };
    if (productId != null && productName) {
        payload.productId = productId;
        payload.productName = String(productName).trim();
    }
    return payload;
}
