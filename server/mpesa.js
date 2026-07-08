import { config, mpesaConfigured } from './config.js';

const BASE_URL = {
    sandbox: 'https://sandbox.safaricom.co.ke',
    production: 'https://api.safaricom.co.ke',
};

function baseUrl() {
    return BASE_URL[config.mpesa.env] || BASE_URL.sandbox;
}

function timestamp() {
    const d = new Date();
    const pad = n => String(n).padStart(2, '0');
    return (
        d.getFullYear().toString() +
        pad(d.getMonth() + 1) +
        pad(d.getDate()) +
        pad(d.getHours()) +
        pad(d.getMinutes()) +
        pad(d.getSeconds())
    );
}

async function getAccessToken() {
    const credentials = Buffer.from(
        `${config.mpesa.consumerKey}:${config.mpesa.consumerSecret}`
    ).toString('base64');

    const response = await fetch(`${baseUrl()}/oauth/v1/generate?grant_type=client_credentials`, {
        headers: { Authorization: `Basic ${credentials}` },
    });

    if (!response.ok) {
        throw new Error(`Daraja OAuth failed: HTTP ${response.status}`);
    }
    const data = await response.json();
    return data.access_token;
}

/**
 * Initiate an STK Push (Lipa Na M-Pesa Online) prompt to the customer's phone.
 * `phone` must already be normalized to 2547XXXXXXXX / 2541XXXXXXXX format.
 */
export async function initiateStkPush({ phone, amount, accountReference, description }) {
    if (!mpesaConfigured()) {
        throw new Error('M-Pesa is not configured on this server (missing Daraja credentials).');
    }

    const token = await getAccessToken();
    const ts = timestamp();
    const password = Buffer.from(`${config.mpesa.shortcode}${config.mpesa.passkey}${ts}`).toString(
        'base64'
    );

    const response = await fetch(`${baseUrl()}/mpesa/stkpush/v1/processrequest`, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            BusinessShortCode: config.mpesa.shortcode,
            Password: password,
            Timestamp: ts,
            TransactionType: 'CustomerPayBillOnline',
            Amount: Math.round(amount),
            PartyA: phone,
            PartyB: config.mpesa.shortcode,
            PhoneNumber: phone,
            CallBackURL: config.mpesa.callbackUrl,
            AccountReference: accountReference,
            TransactionDesc: description,
        }),
    });

    const data = await response.json();
    if (!response.ok || data.errorCode) {
        throw new Error(data.errorMessage || data.ResponseDescription || 'STK push request failed');
    }
    return data; // { MerchantRequestID, CheckoutRequestID, ResponseCode, CustomerMessage, ... }
}

/** Actively query Safaricom for the result of a previously-initiated STK push. */
export async function queryStkStatus(checkoutRequestId) {
    const token = await getAccessToken();
    const ts = timestamp();
    const password = Buffer.from(`${config.mpesa.shortcode}${config.mpesa.passkey}${ts}`).toString(
        'base64'
    );

    const response = await fetch(`${baseUrl()}/mpesa/stkpushquery/v1/query`, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            BusinessShortCode: config.mpesa.shortcode,
            Password: password,
            Timestamp: ts,
            CheckoutRequestID: checkoutRequestId,
        }),
    });
    return response.json();
}

/** Parse Safaricom's async callback payload into a normalized result. */
export function parseCallback(body) {
    const stkCallback = body?.Body?.stkCallback;
    if (!stkCallback) return null;

    const { CheckoutRequestID, ResultCode, ResultDesc, CallbackMetadata } = stkCallback;
    const metadata = {};
    for (const item of CallbackMetadata?.Item || []) {
        metadata[item.Name] = item.Value;
    }

    return {
        checkoutRequestId: CheckoutRequestID,
        success: ResultCode === 0,
        resultDesc: ResultDesc,
        amount: metadata.Amount,
        mpesaReceiptNumber: metadata.MpesaReceiptNumber,
        transactionDate: metadata.TransactionDate,
        phoneNumber: metadata.PhoneNumber,
    };
}
