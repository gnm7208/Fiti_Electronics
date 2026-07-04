// Main entry point: DOM wiring + persistence. Pure cart logic lives in
// js/cart.js and utilities in js/utils.js so they can be unit-tested.

import {
    addItem,
    incrementItem,
    decrementItem,
    removeItem,
    itemCount,
    cartTotal,
    normalizeCart,
} from './js/cart.js';
import { escapeHtml } from './js/utils.js';

// DOM elements
const productsGrid = document.getElementById('products-grid');
const cartItems = document.getElementById('cart-items');
const cartCount = document.getElementById('cart-count');
const totalItems = document.getElementById('total-items');
const totalCost = document.getElementById('total-cost');
const cartSidebar = document.getElementById('cart-sidebar');
const cartToggle = document.getElementById('cart-toggle');
const cartClose = document.getElementById('cart-close');
const checkoutBtn = document.getElementById('checkout-btn');
const checkoutModal = document.getElementById('checkout-modal');
const closeModal = document.getElementById('close-modal');
const searchInput = document.getElementById('search');
const searchBtn = document.getElementById('search-btn');

// State - cart lines are { id, name, price, image, qty }
let cart = [];
let products = [];

// API base URL
const API_BASE = '';

// Cart persistence: prefer the json-server /cart API (Render deployment);
// fall back to localStorage on static hosting (Netlify) where no API exists.
const CART_STORAGE_KEY = 'fiti-cart';
let cartApiAvailable = false;

// --- Persistence ----------------------------------------------------------

function saveCartLocally() {
    try {
        localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
    } catch (error) {
        console.error('Error saving cart locally:', error);
    }
}

function loadCartLocally() {
    try {
        return normalizeCart(JSON.parse(localStorage.getItem(CART_STORAGE_KEY)));
    } catch {
        return [];
    }
}

// Persist a single cart line to whichever backend is available
async function persistCartLine(line, { isNew = false, removed = false } = {}) {
    if (!cartApiAvailable) {
        saveCartLocally();
        return;
    }
    try {
        if (removed) {
            await fetch(`${API_BASE}/cart/${line.id}`, { method: 'DELETE' });
        } else if (isNew) {
            await fetch(`${API_BASE}/cart`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(line),
            });
        } else {
            await fetch(`${API_BASE}/cart/${line.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(line),
            });
        }
    } catch (error) {
        console.error('Error persisting cart, falling back to localStorage:', error);
        cartApiAvailable = false;
        saveCartLocally();
    }
}

// --- Products ---------------------------------------------------------------

// Fetch products from local db.json
async function fetchProducts() {
    try {
        const response = await fetch('./db.json');
        const data = await response.json();
        products = data.products;
        displayProducts(products);
    } catch (error) {
        console.error('Error fetching products:', error);
        productsGrid.innerHTML = '<p>Error loading products. Please try again later.</p>';
    }
}

// Filter products by category
function filterProducts(category) {
    if (category === 'all') {
        displayProducts(products);
    } else {
        displayProducts(products.filter(product => product.category === category));
    }
}

// Display products in the grid
function displayProducts(productsToShow) {
    productsGrid.innerHTML = '';
    productsToShow.forEach(product => {
        const productCard = document.createElement('div');
        productCard.className = 'product-card';
        productCard.innerHTML = `
            <img src="${escapeHtml(product.image)}" alt="${escapeHtml(product.name)}" class="product-image" loading="lazy">
            <div class="product-info">
                <h3 class="product-name">${escapeHtml(product.name)}</h3>
                <p class="product-price">$${Number(product.price).toFixed(2)}</p>
                <p class="product-description">${escapeHtml(product.description)}</p>
                <button class="add-to-cart" data-id="${Number(product.id)}">Add to Cart</button>
            </div>
        `;
        productsGrid.appendChild(productCard);
    });

    document.querySelectorAll('.add-to-cart').forEach(button => {
        button.addEventListener('click', handleAddToCart);
    });
}

// --- Cart actions -----------------------------------------------------------

async function handleAddToCart(event) {
    const productId = parseInt(event.target.dataset.id);
    const product = products.find(p => p.id === productId);
    if (!product) return;

    const isNew = !cart.some(line => line.id === productId);
    cart = addItem(cart, product);
    await persistCartLine(cart.find(line => line.id === productId), { isNew });
    renderCart();
}

async function handleIncrement(productId) {
    cart = incrementItem(cart, productId);
    await persistCartLine(cart.find(line => line.id === productId));
    renderCart();
}

async function handleDecrement(productId) {
    const before = cart.find(line => line.id === productId);
    if (!before) return;
    cart = decrementItem(cart, productId);
    const after = cart.find(line => line.id === productId);
    await persistCartLine(after || before, { removed: !after });
    renderCart();
}

async function handleRemove(productId) {
    const line = cart.find(item => item.id === productId);
    if (!line) return;
    cart = removeItem(cart, productId);
    await persistCartLine(line, { removed: true });
    renderCart();
}

// Clear entire cart
async function clearCart() {
    if (cart.length === 0) return;

    const lines = [...cart];
    cart = [];
    if (cartApiAvailable) {
        try {
            await Promise.all(
                lines.map(line => fetch(`${API_BASE}/cart/${line.id}`, { method: 'DELETE' }))
            );
        } catch (error) {
            console.error('Error clearing cart:', error);
        }
    }
    saveCartLocally();
    renderCart();
}

// --- Rendering --------------------------------------------------------------

function renderCart() {
    cartItems.innerHTML = '';

    cart.forEach(item => {
        const lineTotal = item.price * item.qty;
        const cartItem = document.createElement('div');
        cartItem.className = 'cart-item';
        cartItem.innerHTML = `
            <span class="cart-item-name">${escapeHtml(item.name)}</span>
            <span class="cart-item-qty">
                <button class="qty-btn qty-decrease" data-id="${Number(item.id)}" aria-label="Decrease quantity">−</button>
                ×${Number(item.qty)}
                <button class="qty-btn qty-increase" data-id="${Number(item.id)}" aria-label="Increase quantity">+</button>
            </span>
            <span class="cart-item-price">$${lineTotal.toFixed(2)}</span>
            <button class="remove-item" data-id="${Number(item.id)}" aria-label="Remove ${escapeHtml(item.name)} from cart">Remove</button>
        `;
        cartItems.appendChild(cartItem);
    });

    totalItems.textContent = itemCount(cart);
    totalCost.textContent = cartTotal(cart).toFixed(2);
    cartCount.textContent = itemCount(cart);

    document.querySelectorAll('.remove-item').forEach(button => {
        button.addEventListener('click', e => handleRemove(parseInt(e.target.dataset.id)));
    });
    document.querySelectorAll('.qty-decrease').forEach(button => {
        button.addEventListener('click', e => handleDecrement(parseInt(e.target.dataset.id)));
    });
    document.querySelectorAll('.qty-increase').forEach(button => {
        button.addEventListener('click', e => handleIncrement(parseInt(e.target.dataset.id)));
    });
}

// Save cart to orders
async function saveCart() {
    if (cart.length === 0) return;
    const order = { items: cart, timestamp: new Date().toISOString() };
    if (!cartApiAvailable) {
        try {
            const orders = JSON.parse(localStorage.getItem('fiti-orders')) || [];
            orders.push(order);
            localStorage.setItem('fiti-orders', JSON.stringify(orders));
        } catch (error) {
            console.error('Error saving order locally:', error);
        }
        return;
    }
    try {
        const response = await fetch(`${API_BASE}/orders`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(order),
        });
        if (!response.ok) {
            console.error('Error saving cart');
        }
    } catch (error) {
        console.error('Error saving cart:', error);
    }
}

// --- UI ----------------------------------------------------------------------

function toggleCart() {
    cartSidebar.classList.toggle('hidden');
}

function closeCart() {
    cartSidebar.classList.add('hidden');
}

async function showCheckoutModal() {
    if (cart.length === 0) {
        alert('Your cart is empty. Add some products before checking out.');
        return;
    }
    await saveCart();
    await clearCart();
    checkoutModal.classList.remove('hidden');
}

function closeCheckoutModal() {
    checkoutModal.classList.add('hidden');
}

function searchProducts() {
    const query = searchInput.value.toLowerCase();
    displayProducts(
        products.filter(product =>
            product.name.toLowerCase().includes(query) ||
            product.description.toLowerCase().includes(query)
        )
    );
}

// Event listeners
cartToggle.addEventListener('click', toggleCart);
cartClose.addEventListener('click', closeCart);
checkoutBtn.addEventListener('click', showCheckoutModal);
closeModal.addEventListener('click', closeCheckoutModal);
searchBtn.addEventListener('click', searchProducts);
searchInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        searchProducts();
    }
});

// Category filter event listeners
function addCategoryListeners() {
    document.querySelectorAll('.category-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            document.querySelectorAll('.category-btn').forEach(btn => btn.classList.remove('active'));
            e.target.classList.add('active');
            filterProducts(e.target.dataset.category);
        });
    });
}

// Load the cart: use the /cart API when present, otherwise localStorage
async function fetchCart() {
    try {
        const response = await fetch(`${API_BASE}/cart`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        cartApiAvailable = true;
        cart = normalizeCart(data);
    } catch {
        cartApiAvailable = false;
        cart = loadCartLocally();
    }
    renderCart();
}

// Initialize the app
document.addEventListener('DOMContentLoaded', () => {
    fetchProducts();
    fetchCart();
    addCategoryListeners();
});
