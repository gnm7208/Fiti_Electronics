import { describe, it, expect } from 'vitest';
import { isOnOffer, getDeals, discountPercent } from '../js/deals.js';

const onOffer = { id: 1, name: 'A', price: 80, originalPrice: 100 };
const notOnOffer = { id: 2, name: 'B', price: 50 };
const sameAsOriginal = { id: 3, name: 'C', price: 50, originalPrice: 50 };

describe('isOnOffer', () => {
    it('is true when originalPrice is greater than price', () => {
        expect(isOnOffer(onOffer)).toBe(true);
    });

    it('is false when there is no originalPrice', () => {
        expect(isOnOffer(notOnOffer)).toBe(false);
    });

    it('is false when originalPrice equals price', () => {
        expect(isOnOffer(sameAsOriginal)).toBe(false);
    });
});

describe('getDeals', () => {
    it('filters a product list down to only discounted items', () => {
        const deals = getDeals([onOffer, notOnOffer, sameAsOriginal]);
        expect(deals).toEqual([onOffer]);
    });

    it('returns an empty array when nothing is on offer', () => {
        expect(getDeals([notOnOffer, sameAsOriginal])).toEqual([]);
    });
});

describe('discountPercent', () => {
    it('computes a rounded whole-number percentage off', () => {
        expect(discountPercent(80, 100)).toBe(20);
        expect(discountPercent(849.99, 999.99)).toBe(15);
    });

    it('returns 0 when there is no valid original price', () => {
        expect(discountPercent(50, 0)).toBe(0);
        expect(discountPercent(50, undefined)).toBe(0);
    });
});
