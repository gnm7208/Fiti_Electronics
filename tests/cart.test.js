import { describe, it, expect } from 'vitest';
import {
    addItem,
    incrementItem,
    decrementItem,
    removeItem,
    itemCount,
    cartTotal,
    normalizeCart,
} from '../js/cart.js';
import { escapeHtml } from '../js/utils.js';

const laptop = { id: 1, name: 'Laptop', price: 999.99, image: 'l.png' };
const phone = { id: 2, name: 'Phone', price: 499.5, image: 'p.png' };

describe('cart logic', () => {
    it('adds a new product as a qty-1 line', () => {
        const cart = addItem([], laptop);
        expect(cart).toHaveLength(1);
        expect(cart[0]).toMatchObject({ id: 1, qty: 1, price: 999.99 });
    });

    it('bumps qty instead of duplicating lines', () => {
        const cart = addItem(addItem([], laptop), laptop);
        expect(cart).toHaveLength(1);
        expect(cart[0].qty).toBe(2);
    });

    it('does not mutate the original cart', () => {
        const original = addItem([], laptop);
        addItem(original, laptop);
        expect(original[0].qty).toBe(1);
    });

    it('increments and decrements quantities', () => {
        let cart = addItem([], laptop);
        cart = incrementItem(cart, 1);
        expect(cart[0].qty).toBe(2);
        cart = decrementItem(cart, 1);
        expect(cart[0].qty).toBe(1);
    });

    it('drops a line when decremented to zero', () => {
        const cart = decrementItem(addItem([], laptop), 1);
        expect(cart).toHaveLength(0);
    });

    it('removes a line entirely regardless of qty', () => {
        let cart = addItem(addItem(addItem([], laptop), laptop), phone);
        cart = removeItem(cart, 1);
        expect(cart).toHaveLength(1);
        expect(cart[0].id).toBe(2);
    });

    it('computes item count across lines', () => {
        const cart = addItem(addItem(addItem([], laptop), laptop), phone);
        expect(itemCount(cart)).toBe(3);
    });

    it('computes cart total from qty * price', () => {
        const cart = addItem(addItem(addItem([], laptop), laptop), phone);
        expect(cartTotal(cart)).toBeCloseTo(999.99 * 2 + 499.5);
    });

    it('normalizes legacy carts without qty fields', () => {
        const cart = normalizeCart([{ id: 1, name: 'X', price: 5 }]);
        expect(cart[0].qty).toBe(1);
    });

    it('normalizes non-array data to an empty cart', () => {
        expect(normalizeCart(null)).toEqual([]);
        expect(normalizeCart({})).toEqual([]);
    });
});

describe('escapeHtml', () => {
    it('escapes HTML-significant characters', () => {
        expect(escapeHtml('<img src=x onerror="alert(1)">')).toBe(
            '&lt;img src=x onerror=&quot;alert(1)&quot;&gt;'
        );
        expect(escapeHtml("O'Brien & Sons")).toBe('O&#39;Brien &amp; Sons');
    });
});
