// Pure payment logic - no DOM, no fetch. Kept separate from api.js so it's
// fully unit-testable, same pattern as js/cart.js.

/**
 * Normalize a Kenyan phone number to the 2547XXXXXXXX / 2541XXXXXXXX format
 * Safaricom's Daraja API requires. Accepts 07.., 01.., +254.., 254.. inputs
 * with optional spaces/dashes. Returns null if the input isn't a valid
 * Kenyan mobile number.
 */
export function normalizeKenyanPhone(input) {
    const digits = String(input).replace(/[\s-]/g, '').replace(/^\+/, '');

    let normalized;
    if (digits.startsWith('254')) {
        normalized = digits;
    } else if (digits.startsWith('0')) {
        normalized = `254${digits.slice(1)}`;
    } else if (digits.startsWith('7') || digits.startsWith('1')) {
        normalized = `254${digits}`;
    } else {
        return null;
    }

    return /^254[17]\d{8}$/.test(normalized) ? normalized : null;
}

export function isValidKenyanPhone(input) {
    return normalizeKenyanPhone(input) !== null;
}

/** Format cents/whole-unit amount as a 2dp currency string (no symbol). */
export function formatAmount(amount) {
    return Number(amount).toFixed(2);
}

/**
 * Reduce a stream of payment status responses to a UI-friendly state.
 * Mirrors the states the M-Pesa polling endpoint and Stripe confirmation
 * can report, so the checkout UI has one place to branch on.
 */
export function paymentStatusLabel(status) {
    switch (status) {
        case 'success':
            return 'Payment successful';
        case 'failed':
            return 'Payment failed';
        case 'pending':
            return 'Waiting for confirmation...';
        default:
            return 'Unknown status';
    }
}
