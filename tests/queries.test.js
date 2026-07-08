import { describe, it, expect } from 'vitest';
import { isValidName, isValidMessage, buildQueryPayload } from '../js/queries.js';

describe('isValidName', () => {
    it('accepts a normal name', () => {
        expect(isValidName('Jane Doe')).toBe(true);
    });

    it('rejects empty, whitespace-only, or too-short names', () => {
        expect(isValidName('')).toBe(false);
        expect(isValidName('   ')).toBe(false);
        expect(isValidName('J')).toBe(false);
    });
});

describe('isValidMessage', () => {
    it('accepts a normal message', () => {
        expect(isValidMessage('Do you have this in stock?')).toBe(true);
    });

    it('rejects empty, whitespace-only, or too-short messages', () => {
        expect(isValidMessage('')).toBe(false);
        expect(isValidMessage('     ')).toBe(false);
        expect(isValidMessage('hi')).toBe(false);
    });
});

describe('buildQueryPayload', () => {
    it('trims name and message for a general query', () => {
        expect(buildQueryPayload({ name: '  Jane  ', message: '  Do you deliver to Thika?  ' })).toEqual({
            name: 'Jane',
            message: 'Do you deliver to Thika?',
        });
    });

    it('includes trimmed product context when both productId and productName are given', () => {
        expect(
            buildQueryPayload({
                name: 'Jane',
                message: 'Is this available in black?',
                productId: 12,
                productName: '  iPhone 14  ',
            })
        ).toEqual({
            name: 'Jane',
            message: 'Is this available in black?',
            productId: 12,
            productName: 'iPhone 14',
        });
    });

    it('omits product context when productName is missing', () => {
        const payload = buildQueryPayload({ name: 'Jane', message: 'General question', productId: 12 });
        expect(payload).toEqual({ name: 'Jane', message: 'General question' });
    });
});
