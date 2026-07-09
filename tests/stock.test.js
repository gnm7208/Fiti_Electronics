import { describe, it, expect } from 'vitest';
import { isOutOfStock, isLowStock, availableToAdd } from '../js/stock.js';

describe('isOutOfStock', () => {
    it('is true when stock is 0', () => {
        expect(isOutOfStock({ stock: 0 })).toBe(true);
    });

    it('is false when stock is positive', () => {
        expect(isOutOfStock({ stock: 5 })).toBe(false);
    });

    it('is false when stock is not tracked at all (legacy product)', () => {
        expect(isOutOfStock({})).toBe(false);
    });
});

describe('isLowStock', () => {
    it('is true when stock is positive but at/below the threshold', () => {
        expect(isLowStock({ stock: 3 })).toBe(true);
        expect(isLowStock({ stock: 1 })).toBe(true);
    });

    it('is false when out of stock (0), above the threshold, or untracked', () => {
        expect(isLowStock({ stock: 0 })).toBe(false);
        expect(isLowStock({ stock: 10 })).toBe(false);
        expect(isLowStock({})).toBe(false);
    });

    it('respects a custom threshold', () => {
        expect(isLowStock({ stock: 5 }, 5)).toBe(true);
        expect(isLowStock({ stock: 6 }, 5)).toBe(false);
    });
});

describe('availableToAdd', () => {
    it('returns the stock count when tracked', () => {
        expect(availableToAdd({ stock: 4 })).toBe(4);
    });

    it('clamps negative stock to 0', () => {
        expect(availableToAdd({ stock: -2 })).toBe(0);
    });

    it('returns Infinity for untracked (legacy) products', () => {
        expect(availableToAdd({})).toBe(Infinity);
    });
});
