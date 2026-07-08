import { describe, it, expect } from 'vitest';
import {
    normalizeKenyanPhone,
    isValidKenyanPhone,
    formatAmount,
    paymentStatusLabel,
} from '../js/payments.js';

describe('normalizeKenyanPhone', () => {
    it('normalizes 07... local format', () => {
        expect(normalizeKenyanPhone('0712345678')).toBe('254712345678');
    });

    it('normalizes 01... local format', () => {
        expect(normalizeKenyanPhone('0112345678')).toBe('254112345678');
    });

    it('normalizes +254... international format', () => {
        expect(normalizeKenyanPhone('+254712345678')).toBe('254712345678');
    });

    it('normalizes bare 254... format', () => {
        expect(normalizeKenyanPhone('254712345678')).toBe('254712345678');
    });

    it('normalizes bare 7... / 1... short format', () => {
        expect(normalizeKenyanPhone('712345678')).toBe('254712345678');
        expect(normalizeKenyanPhone('112345678')).toBe('254112345678');
    });

    it('strips spaces and dashes', () => {
        expect(normalizeKenyanPhone('0712 345 678')).toBe('254712345678');
        expect(normalizeKenyanPhone('0712-345-678')).toBe('254712345678');
    });

    it('rejects non-Kenyan-mobile numbers', () => {
        expect(normalizeKenyanPhone('0212345678')).toBeNull(); // landline prefix
        expect(normalizeKenyanPhone('12345')).toBeNull(); // too short
        expect(normalizeKenyanPhone('not-a-phone')).toBeNull();
        expect(normalizeKenyanPhone('+15551234567')).toBeNull(); // US number
    });
});

describe('isValidKenyanPhone', () => {
    it('mirrors normalizeKenyanPhone success/failure', () => {
        expect(isValidKenyanPhone('0712345678')).toBe(true);
        expect(isValidKenyanPhone('not-a-phone')).toBe(false);
    });
});

describe('formatAmount', () => {
    it('formats to two decimal places', () => {
        expect(formatAmount(5)).toBe('5.00');
        expect(formatAmount(1999.999)).toBe('2000.00');
        expect(formatAmount('42.1')).toBe('42.10');
    });
});

describe('paymentStatusLabel', () => {
    it('maps known statuses to human labels', () => {
        expect(paymentStatusLabel('success')).toBe('Payment successful');
        expect(paymentStatusLabel('failed')).toBe('Payment failed');
        expect(paymentStatusLabel('pending')).toBe('Waiting for confirmation...');
    });

    it('falls back for unknown statuses', () => {
        expect(paymentStatusLabel('bogus')).toBe('Unknown status');
    });
});
