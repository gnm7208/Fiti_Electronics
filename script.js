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
import { normalizeKenyanPhone, formatAmount } from './js/payments.js';
import { getDeals, discountPercent } from './js/deals.js';
import { isValidName, isValidMessage, buildQueryPayload } from './js/queries.js';
import { isOutOfStock, isLowStock, availableToAdd } from './js/stock.js';

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

// Checkout / payment DOM elements
const checkoutDemoBanner = document.getElementById('checkout-demo-banner');
const checkoutStepMethod = document.getElementById('checkout-step-method');
const checkoutTotalAmount = document.getElementById('checkout-total-amount');
const paymentMethodButtons = document.querySelectorAll('.payment-method-btn');
const mpesaForm = document.getElementById('checkout-mpesa-form');
const mpesaPhoneInput = document.getElementById('mpesa-phone');
const mpesaPhoneError = document.getElementById('mpesa-phone-error');
const mpesaPayBtn = document.getElementById('mpesa-pay-btn');
const cardForm = document.getElementById('checkout-card-form');
const cardElementContainer = document.getElementById('card-element');
const cardErrorEl = document.getElementById('card-error');
const cardPayBtn = document.getElementById('card-pay-btn');
const cardPayAmount = document.getElementById('card-pay-amount');
const checkoutStatus = document.getElementById('checkout-status');
const checkoutStatusText = document.getElementById('checkout-status-text');
const checkoutReceipt = document.getElementById('checkout-receipt');
const checkoutReceiptIcon = document.getElementById('checkout-receipt-icon');
const checkoutReceiptText = document.getElementById('checkout-receipt-text');
const receiptMethod = document.getElementById('receipt-method');
const receiptAmount = document.getElementById('receipt-amount');
const receiptReference = document.getElementById('receipt-reference');
const receiptDoneBtn = document.getElementById('receipt-done-btn');
const backButtons = document.querySelectorAll('[data-back]');
const checkoutSteps = [checkoutStepMethod, mpesaForm, cardForm, checkoutStatus, checkoutReceipt];
const toastContainer = document.getElementById('toast-container');

// Deals carousel DOM elements
const dealsSection = document.getElementById('deals-section');
const dealsTrack = document.getElementById('deals-track');

// Product detail modal DOM elements
const productModal = document.getElementById('product-modal');
const productModalClose = document.getElementById('product-modal-close');
const productModalMainImage = document.getElementById('product-modal-main-image');
const productModalThumbs = document.getElementById('product-modal-thumbs');
const productModalTitle = document.getElementById('product-modal-title');
const productModalOriginalPrice = document.getElementById('product-modal-original-price');
const productModalPrice = document.getElementById('product-modal-price');
const productModalDiscountBadge = document.getElementById('product-modal-discount-badge');
const productModalDescription = document.getElementById('product-modal-description');
const productModalSpecs = document.getElementById('product-modal-specs');
const productModalAddToCart = document.getElementById('product-modal-add-to-cart');
const productModalStockStatus = document.getElementById('product-modal-stock-status');
const productModalAskToggle = document.getElementById('product-modal-ask-toggle');
const productModalQuery = document.getElementById('product-modal-query');
const productModalQueryProductName = document.getElementById('product-modal-query-product-name');
const productQueryForm = document.getElementById('product-query-form');
const productQueryNameInput = document.getElementById('product-query-name');
const productQueryNameError = document.getElementById('product-query-name-error');
const productQueryMessageInput = document.getElementById('product-query-message');
const productQueryMessageError = document.getElementById('product-query-message-error');

// Contact section DOM elements
const mapToggleBtn = document.getElementById('map-toggle-btn');
const mapWrap = document.getElementById('map-wrap');
const queryForm = document.getElementById('query-form');
const queryNameInput = document.getElementById('query-name');
const queryNameError = document.getElementById('query-name-error');
const queryMessageInput = document.getElementById('query-message');
const queryMessageError = document.getElementById('query-message-error');
const socialPreviewGrid = document.getElementById('social-preview-grid');

// State - cart lines are { id, name, price, image, qty }
let cart = [];
let products = [];
let currentCategory = 'all';
let modalProduct = null;

// Checkout / payment state
let checkoutOrderReference = null;
// null = not checked yet; otherwise { mpesa: bool, stripe: bool } reflecting
// whether each provider actually has real credentials configured server-side
// (not just whether the payments API itself is reachable).
let paymentApiStatus = null;
let mpesaPollTimer = null;
let stripeInstance = null;
let stripeClientSecret = null;
let cardElement = null;

// API base URL
const API_BASE = '';

// Cart persistence: prefer the json-server /cart API (Render deployment);
// fall back to localStorage on static hosting (Netlify) where no API exists.
const CART_STORAGE_KEY = 'fiti-cart';
const QUERIES_STORAGE_KEY = 'fiti-queued-queries';
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
// Fetches the static db.json file directly (rather than a /products API
// route) so product browsing still works on static hosting like Netlify,
// which has no backend at all. The admin dashboard's lowdb writes rewrite
// this same file on disk non-atomically, so a request can rarely land
// mid-write and read a truncated file - one retry clears that up without
// giving up the static-hosting fallback.
async function fetchProductsOnce() {
    const response = await fetch('./db.json');
    const data = await response.json();
    return data.products;
}

async function fetchProducts() {
    try {
        try {
            products = await fetchProductsOnce();
        } catch {
            await new Promise(resolve => setTimeout(resolve, 150));
            products = await fetchProductsOnce();
        }
        displayProducts(products);
        renderDeals();
        renderSocialPreview();
    } catch (error) {
        console.error('Error fetching products:', error);
        productsGrid.innerHTML = '<p>Error loading products. Please try again later.</p>';
    }
}

// Filter products by category
function filterProducts(category) {
    currentCategory = category;
    updateDealsVisibility();
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
        const outOfStock = isOutOfStock(product);
        const lowStock = isLowStock(product);
        const productCard = document.createElement('div');
        productCard.className = 'product-card';
        productCard.dataset.id = String(product.id);
        productCard.innerHTML = `
            <div class="product-image-wrap">
                ${outOfStock ? '<span class="out-of-stock-badge">Out of Stock</span>' : ''}
                <img src="${escapeHtml(product.image)}" alt="${escapeHtml(product.name)}" class="product-image" loading="lazy">
            </div>
            <div class="product-info">
                <h3 class="product-name">${escapeHtml(product.name)}</h3>
                <p class="product-price">$${Number(product.price).toFixed(2)}</p>
                <p class="product-description">${escapeHtml(product.description)}</p>
                ${lowStock ? `<p class="low-stock-hint">Only ${product.stock} left</p>` : ''}
                <button class="add-to-cart" data-id="${Number(product.id)}" ${outOfStock ? 'disabled' : ''}>${outOfStock ? 'Out of Stock' : 'Add to Cart'}</button>
            </div>
        `;
        productsGrid.appendChild(productCard);
    });

    document.querySelectorAll('.add-to-cart').forEach(button => {
        button.addEventListener('click', handleAddToCart);
    });
    document.querySelectorAll('.product-card').forEach(card => {
        card.addEventListener('click', event => {
            if (event.target.closest('.add-to-cart')) return;
            const product = products.find(p => p.id === Number(card.dataset.id));
            if (product) openProductModal(product);
        });
    });
}

// --- Deals carousel -----------------------------------------------------------

function updateDealsVisibility() {
    if (!dealsSection) return;
    const deals = getDeals(products);
    dealsSection.classList.toggle('hidden', currentCategory !== 'all' || deals.length === 0);
}

function renderDeals() {
    if (!dealsTrack) return;
    const deals = getDeals(products);
    updateDealsVisibility();

    dealsTrack.innerHTML = '';
    deals.forEach(product => {
        const percentOff = discountPercent(product.price, product.originalPrice);
        const card = document.createElement('button');
        card.type = 'button';
        card.className = 'deal-card';
        card.dataset.id = String(product.id);
        card.innerHTML = `
            <div class="deal-card-image-wrap">
                <span class="deal-card-badge">-${percentOff}%</span>
                ${isOutOfStock(product) ? '<span class="out-of-stock-badge deal-out-of-stock-badge">Out of Stock</span>' : ''}
                <img src="${escapeHtml(product.image)}" alt="${escapeHtml(product.name)}" class="deal-card-image" loading="lazy">
            </div>
            <div class="deal-card-info">
                <p class="deal-card-name">${escapeHtml(product.name)}</p>
                <p class="deal-card-prices">
                    <span class="deal-card-original-price">$${formatAmount(product.originalPrice)}</span>
                    <span class="deal-card-price">$${formatAmount(product.price)}</span>
                </p>
            </div>
        `;
        card.addEventListener('click', () => openProductModal(product));
        dealsTrack.appendChild(card);
    });
}

// --- Product detail modal ----------------------------------------------------

function renderProductModalImages(product) {
    const images = Array.isArray(product.images) && product.images.length > 0
        ? product.images
        : [product.image];

    productModalMainImage.src = images[0];
    productModalMainImage.alt = product.name;

    productModalThumbs.innerHTML = '';
    productModalThumbs.classList.toggle('hidden', images.length < 2);
    images.forEach((src, index) => {
        const thumb = document.createElement('img');
        thumb.src = src;
        thumb.alt = `${product.name} view ${index + 1}`;
        thumb.className = `product-modal-thumb${index === 0 ? ' active' : ''}`;
        thumb.addEventListener('click', () => {
            productModalMainImage.src = src;
            productModalThumbs.querySelectorAll('.product-modal-thumb').forEach(t => t.classList.remove('active'));
            thumb.classList.add('active');
        });
        productModalThumbs.appendChild(thumb);
    });
}

function renderProductModalSpecs(product) {
    productModalSpecs.innerHTML = '';
    (product.specs || []).forEach(({ label, value }) => {
        const dt = document.createElement('dt');
        dt.textContent = label;
        const dd = document.createElement('dd');
        dd.textContent = value;
        productModalSpecs.appendChild(dt);
        productModalSpecs.appendChild(dd);
    });
}

function openProductModal(product) {
    modalProduct = product;
    productModalTitle.textContent = product.name;
    productModalDescription.textContent = product.description;

    const onOffer = typeof product.originalPrice === 'number' && product.originalPrice > product.price;
    productModalPrice.textContent = `$${formatAmount(product.price)}`;
    productModalOriginalPrice.classList.toggle('hidden', !onOffer);
    productModalDiscountBadge.classList.toggle('hidden', !onOffer);
    if (onOffer) {
        productModalOriginalPrice.textContent = `$${formatAmount(product.originalPrice)}`;
        productModalDiscountBadge.textContent = `-${discountPercent(product.price, product.originalPrice)}%`;
    }

    renderProductModalImages(product);
    renderProductModalSpecs(product);

    const outOfStock = isOutOfStock(product);
    const lowStock = isLowStock(product);
    productModalStockStatus.classList.toggle('hidden', !outOfStock && !lowStock);
    productModalStockStatus.textContent = outOfStock ? 'Out of Stock' : lowStock ? `Only ${product.stock} left` : '';
    productModalAddToCart.disabled = outOfStock;
    productModalAddToCart.textContent = outOfStock ? 'Out of Stock' : 'Add to Cart';

    productModal.classList.remove('hidden');
    productModalClose.focus();
}

function closeProductModal() {
    productModal.classList.add('hidden');
    modalProduct = null;
    if (productModalAskToggle) productModalAskToggle.setAttribute('aria-expanded', 'false');
    if (productModalQuery) productModalQuery.classList.add('hidden');
    if (productQueryForm) productQueryForm.reset();
}

if (productModalClose) productModalClose.addEventListener('click', closeProductModal);
if (productModal) {
    productModal.addEventListener('click', event => {
        if (event.target === productModal) closeProductModal();
    });
}
if (productModalAddToCart) {
    productModalAddToCart.addEventListener('click', async () => {
        if (!modalProduct || isOutOfStock(modalProduct)) return;
        const existingLine = cart.find(line => line.id === modalProduct.id);
        if (existingLine && existingLine.qty >= availableToAdd(modalProduct)) {
            showToast(`Only ${modalProduct.stock} of ${modalProduct.name} in stock`, 'error');
            return;
        }
        const isNew = !existingLine;
        cart = addItem(cart, modalProduct);
        await persistCartLine(cart.find(line => line.id === modalProduct.id), { isNew });
        renderCart();
        showToast(`Added ${modalProduct.name} to cart`, 'success');
        closeProductModal();
    });
}
document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && productModal && !productModal.classList.contains('hidden')) {
        closeProductModal();
    }
});

// --- Cart actions -----------------------------------------------------------

async function handleAddToCart(event) {
    const productId = parseInt(event.target.dataset.id);
    const product = products.find(p => p.id === productId);
    if (!product || isOutOfStock(product)) return;

    const existingLine = cart.find(line => line.id === productId);
    if (existingLine && existingLine.qty >= availableToAdd(product)) {
        showToast(`Only ${product.stock} of ${product.name} in stock`, 'error');
        return;
    }
    const isNew = !existingLine;
    cart = addItem(cart, product);
    await persistCartLine(cart.find(line => line.id === productId), { isNew });
    renderCart();
}

async function handleIncrement(productId) {
    const product = products.find(p => p.id === productId);
    const existingLine = cart.find(line => line.id === productId);
    if (product && existingLine && existingLine.qty >= availableToAdd(product)) {
        showToast(`Only ${product.stock} of ${product.name} in stock`, 'error');
        return;
    }
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
async function saveCart(payment) {
    if (cart.length === 0) return;
    const order = {
        items: cart,
        timestamp: new Date().toISOString(),
        ...(payment && { payment }),
    };
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

function showToast(message, type = 'info') {
    if (!toastContainer) return;
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    toastContainer.appendChild(toast);
    setTimeout(() => toast.classList.add('toast-visible'), 10);
    setTimeout(() => {
        toast.classList.remove('toast-visible');
        setTimeout(() => toast.remove(), 300);
    }, 3200);
}

function showCheckoutStep(step) {
    checkoutSteps.forEach(el => el.classList.toggle('hidden', el !== step));
}

// Detect which payment providers actually have real credentials configured.
// On static hosting (Netlify) there's no backend at all - status-check itself
// fails, so both fall back to the simulated demo flow, same fallback
// philosophy as the cart's localStorage fallback above. On a real deployment
// with the backend up but no Daraja/Stripe credentials yet, each method falls
// back independently.
async function checkPaymentApiAvailable() {
    if (paymentApiStatus !== null) return paymentApiStatus;
    try {
        const response = await fetch(`${API_BASE}/api/payments/status-check`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        paymentApiStatus = await response.json();
    } catch {
        paymentApiStatus = { mpesa: false, stripe: false };
    }
    return paymentApiStatus;
}

// --- Customer queries (contact form / product-specific questions) ----------

function saveQueryLocally(payload) {
    try {
        const queued = JSON.parse(localStorage.getItem(QUERIES_STORAGE_KEY) || '[]');
        queued.push({ ...payload, queuedAt: new Date().toISOString() });
        localStorage.setItem(QUERIES_STORAGE_KEY, JSON.stringify(queued));
    } catch (error) {
        console.error('Error queueing query locally:', error);
    }
}

// Validates a name/message field pair in place (toggling the matching
// .field-error elements), same convention as the checkout form's mpesaPhoneError.
function validateQueryFields(nameInput, nameError, messageInput, messageError) {
    let valid = true;
    if (!isValidName(nameInput.value)) {
        nameError.textContent = 'Please enter your name (at least 2 characters).';
        nameError.classList.remove('hidden');
        valid = false;
    } else {
        nameError.classList.add('hidden');
    }
    if (!isValidMessage(messageInput.value)) {
        messageError.textContent = 'Please enter a question of at least 5 characters.';
        messageError.classList.remove('hidden');
        valid = false;
    } else {
        messageError.classList.add('hidden');
    }
    return valid;
}

// Submit a query to the backend when available; on static hosting or any
// network failure, queue it locally instead - same fallback philosophy as
// the cart's localStorage fallback and the checkout demo-mode flow.
async function submitQuery(payload) {
    try {
        const response = await fetch(`${API_BASE}/api/queries`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        showToast(`Thanks, ${payload.name} — we'll get back to you soon!`, 'success');
    } catch {
        saveQueryLocally(payload);
        showToast('🧪 Demo mode — no live backend detected here, so your question was saved locally.', 'success');
    }
}

if (queryForm) {
    queryForm.addEventListener('submit', async event => {
        event.preventDefault();
        if (!validateQueryFields(queryNameInput, queryNameError, queryMessageInput, queryMessageError)) return;
        const payload = buildQueryPayload({ name: queryNameInput.value, message: queryMessageInput.value });
        await submitQuery(payload);
        queryForm.reset();
    });
}

if (productModalAskToggle) {
    productModalAskToggle.addEventListener('click', () => {
        const expanded = productModalAskToggle.getAttribute('aria-expanded') === 'true';
        productModalAskToggle.setAttribute('aria-expanded', String(!expanded));
        productModalQuery.classList.toggle('hidden', expanded);
        if (!expanded && modalProduct) {
            productModalQueryProductName.textContent = modalProduct.name;
        }
    });
}

if (productQueryForm) {
    productQueryForm.addEventListener('submit', async event => {
        event.preventDefault();
        if (!modalProduct) return;
        if (!validateQueryFields(productQueryNameInput, productQueryNameError, productQueryMessageInput, productQueryMessageError)) return;
        const payload = buildQueryPayload({
            name: productQueryNameInput.value,
            message: productQueryMessageInput.value,
            productId: modalProduct.id,
            productName: modalProduct.name,
        });
        await submitQuery(payload);
        productQueryForm.reset();
        productModalQuery.classList.add('hidden');
        productModalAskToggle.setAttribute('aria-expanded', 'false');
    });
}

// --- Shop map toggle --------------------------------------------------------

if (mapToggleBtn) {
    mapToggleBtn.addEventListener('click', () => {
        const expanded = mapToggleBtn.getAttribute('aria-expanded') === 'true';
        mapToggleBtn.setAttribute('aria-expanded', String(!expanded));
        mapToggleBtn.textContent = expanded ? 'Show map' : 'Hide map';
        mapWrap.classList.toggle('hidden', expanded);
    });
}

// --- Social preview strip ----------------------------------------------------

// Static "sample post" strip built from real product/deal data already in the
// catalogue, standing in for a real social feed until the accounts go live.
function renderSocialPreview() {
    if (!socialPreviewGrid) return;
    const deals = getDeals(products);
    const sample = (deals.length > 0 ? deals : products).slice(0, 4);

    socialPreviewGrid.innerHTML = '';
    sample.forEach(product => {
        const card = document.createElement('div');
        card.className = 'social-preview-card';
        const caption = typeof product.originalPrice === 'number' && product.originalPrice > product.price
            ? `🔥 ${product.name} — now $${formatAmount(product.price)}!`
            : `✨ Check out the ${product.name}`;
        card.innerHTML = `
            <img src="${escapeHtml(product.image)}" alt="${escapeHtml(product.name)}" class="social-preview-image" loading="lazy">
            <p class="social-preview-caption">${escapeHtml(caption)}</p>
        `;
        socialPreviewGrid.appendChild(card);
    });
}

function resetCheckoutModal() {
    showCheckoutStep(checkoutStepMethod);
    mpesaForm.reset();
    mpesaPhoneError.classList.add('hidden');
    cardErrorEl.classList.add('hidden');
    stopMpesaPolling();
    stripeClientSecret = null;
    cardElement = null;
}

async function showCheckoutModal() {
    if (cart.length === 0) {
        showToast('Your cart is empty. Add some products before checking out.', 'error');
        return;
    }
    checkoutOrderReference = `FITI-${Date.now()}`;
    const total = cartTotal(cart);
    checkoutTotalAmount.textContent = formatAmount(total);
    cardPayAmount.textContent = formatAmount(total);
    resetCheckoutModal();
    checkoutModal.classList.remove('hidden');

    const status = await checkPaymentApiAvailable();
    checkoutDemoBanner.classList.toggle('hidden', status.mpesa && status.stripe);
}

function closeCheckoutModal() {
    checkoutModal.classList.add('hidden');
    stopMpesaPolling();
}

async function selectPaymentMethod(method) {
    if (method === 'mpesa') {
        showCheckoutStep(mpesaForm);
        mpesaPhoneInput.focus();
    } else if (method === 'card') {
        showCheckoutStep(cardForm);
        await setupCardPayment();
    }
}

async function completeOrder({ method, amount, reference }) {
    await saveCart({ method, amount, reference });
    await clearCart();
    showCheckoutStep(checkoutReceipt);
    checkoutReceiptIcon.textContent = '✅';
    checkoutReceiptText.textContent = 'Payment successful!';
    receiptMethod.textContent = method;
    receiptAmount.textContent = `$${formatAmount(amount)}`;
    receiptReference.textContent = reference;
}

function showPaymentFailure(message) {
    showCheckoutStep(checkoutReceipt);
    checkoutReceiptIcon.textContent = '❌';
    checkoutReceiptText.textContent = message || 'Payment failed. Your cart has been kept so you can try again.';
    receiptMethod.textContent = '—';
    receiptAmount.textContent = '—';
    receiptReference.textContent = '—';
}

// A polished simulated payment for static hosting (Netlify) where there is no
// backend to hold M-Pesa/Stripe secrets, or as a fallback if the real API errors out.
async function simulatePaymentDemo(method, amount) {
    showCheckoutStep(checkoutStatus);
    checkoutStatusText.textContent = 'Processing demo payment…';
    await new Promise(resolve => setTimeout(resolve, 1200));
    await completeOrder({
        method: method === 'mpesa' ? 'M-Pesa (demo)' : 'Card (demo)',
        amount,
        reference: `DEMO-${Date.now()}`,
    });
}

// --- M-Pesa STK Push ---------------------------------------------------------

function stopMpesaPolling() {
    if (mpesaPollTimer) {
        clearInterval(mpesaPollTimer);
        mpesaPollTimer = null;
    }
}

function pollMpesaStatus(checkoutRequestId, amount) {
    let attempts = 0;
    const maxAttempts = 20; // ~60s at 3s intervals
    stopMpesaPolling();
    mpesaPollTimer = setInterval(async () => {
        attempts += 1;
        try {
            const response = await fetch(
                `${API_BASE}/api/payments/mpesa/status/${checkoutRequestId}`
            );
            const data = await response.json();
            if (data.status === 'success') {
                stopMpesaPolling();
                await completeOrder({
                    method: 'M-Pesa',
                    amount,
                    reference: data.mpesaReceiptNumber || checkoutRequestId,
                });
                return;
            }
            if (data.status === 'failed') {
                stopMpesaPolling();
                showPaymentFailure(data.resultDesc || 'The M-Pesa payment was not completed.');
                return;
            }
        } catch {
            // Transient network error while polling - try again next tick.
        }
        if (attempts >= maxAttempts) {
            stopMpesaPolling();
            checkoutStatusText.textContent =
                'Still waiting for confirmation. Check your phone for the M-Pesa prompt, then reopen your cart to try again.';
        }
    }, 3000);
}

async function handleMpesaSubmit(event) {
    event.preventDefault();
    const normalized = normalizeKenyanPhone(mpesaPhoneInput.value);
    if (!normalized) {
        mpesaPhoneError.textContent = 'Enter a valid Kenyan phone number, e.g. 0712345678.';
        mpesaPhoneError.classList.remove('hidden');
        return;
    }
    mpesaPhoneError.classList.add('hidden');
    mpesaPayBtn.disabled = true;
    mpesaPayBtn.textContent = 'Sending…';

    const total = cartTotal(cart);
    const status = await checkPaymentApiAvailable();

    if (!status.mpesa) {
        await simulatePaymentDemo('mpesa', total);
        mpesaPayBtn.disabled = false;
        mpesaPayBtn.textContent = 'Send M-Pesa Prompt';
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/api/payments/mpesa/stkpush`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                phone: normalized,
                amount: total,
                orderReference: checkoutOrderReference,
            }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'STK push failed');

        showCheckoutStep(checkoutStatus);
        checkoutStatusText.textContent =
            data.customerMessage || 'Check your phone to complete the M-Pesa payment.';
        pollMpesaStatus(data.checkoutRequestId, total);
    } catch (error) {
        mpesaPhoneError.textContent = `Could not start M-Pesa payment: ${error.message}`;
        mpesaPhoneError.classList.remove('hidden');
    } finally {
        mpesaPayBtn.disabled = false;
        mpesaPayBtn.textContent = 'Send M-Pesa Prompt';
    }
}

// --- Stripe card payment ------------------------------------------------------

function loadStripeJs() {
    if (window.Stripe) return Promise.resolve(window.Stripe);
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://js.stripe.com/v3/';
        script.onload = () => resolve(window.Stripe);
        script.onerror = () => reject(new Error('Failed to load Stripe.js'));
        document.head.appendChild(script);
    });
}

function fallBackToCardDemo(message) {
    if (message) {
        cardErrorEl.textContent = message;
        cardErrorEl.classList.remove('hidden');
    }
    if (paymentApiStatus) paymentApiStatus.stripe = false;
    checkoutDemoBanner.classList.remove('hidden');
    cardElementContainer.innerHTML =
        '<p class="demo-card-note">Demo mode: no real card is charged. Click Pay to simulate a successful payment.</p>';
    cardElement = null;
}

async function setupCardPayment() {
    cardErrorEl.classList.add('hidden');
    const status = await checkPaymentApiAvailable();

    if (!status.stripe) {
        fallBackToCardDemo();
        return;
    }

    try {
        const [configData, intentData, Stripe] = await Promise.all([
            fetch(`${API_BASE}/api/payments/stripe/config`).then(r => r.json()),
            fetch(`${API_BASE}/api/payments/stripe/create-payment-intent`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    amount: cartTotal(cart),
                    currency: 'usd',
                    orderReference: checkoutOrderReference,
                }),
            }).then(r => r.json()),
            loadStripeJs(),
        ]);

        if (!configData.publishableKey || !intentData.clientSecret) {
            throw new Error(configData.error || intentData.error || 'Card payments are not available.');
        }

        stripeClientSecret = intentData.clientSecret;
        stripeInstance = Stripe(configData.publishableKey);
        const elements = stripeInstance.elements();
        cardElement = elements.create('card');
        cardElementContainer.innerHTML = '';
        cardElement.mount('#card-element');
    } catch (error) {
        fallBackToCardDemo(error.message);
    }
}

async function handleCardPay() {
    const total = cartTotal(cart);
    cardPayBtn.disabled = true;
    cardPayBtn.textContent = 'Processing…';
    const status = await checkPaymentApiAvailable();

    if (!status.stripe || !cardElement) {
        await simulatePaymentDemo('card', total);
        cardPayBtn.disabled = false;
        cardPayBtn.textContent = `Pay $${formatAmount(total)}`;
        return;
    }

    try {
        const result = await stripeInstance.confirmCardPayment(stripeClientSecret, {
            payment_method: { card: cardElement },
        });
        if (result.error) throw new Error(result.error.message);
        if (result.paymentIntent.status === 'succeeded') {
            await completeOrder({ method: 'Card', amount: total, reference: result.paymentIntent.id });
        } else {
            showPaymentFailure('Card payment was not completed.');
        }
    } catch (error) {
        cardErrorEl.textContent = error.message;
        cardErrorEl.classList.remove('hidden');
    } finally {
        cardPayBtn.disabled = false;
        cardPayBtn.textContent = `Pay $${formatAmount(total)}`;
    }
}

// Checkout event wiring
paymentMethodButtons.forEach(button => {
    button.addEventListener('click', () => selectPaymentMethod(button.dataset.method));
});
backButtons.forEach(button => {
    button.addEventListener('click', () => showCheckoutStep(checkoutStepMethod));
});
mpesaForm.addEventListener('submit', handleMpesaSubmit);
cardPayBtn.addEventListener('click', handleCardPay);
receiptDoneBtn.addEventListener('click', closeCheckoutModal);

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

// --- Analytics ---------------------------------------------------------------

const VISITOR_ID_KEY = 'fiti-visitor-id';

function getVisitorId() {
    try {
        let id = localStorage.getItem(VISITOR_ID_KEY);
        if (!id) {
            id = crypto.randomUUID();
            localStorage.setItem(VISITOR_ID_KEY, id);
        }
        return id;
    } catch {
        return crypto.randomUUID();
    }
}

// Fire-and-forget: silently does nothing on static hosting with no backend
// (same tolerant-of-missing-API philosophy as the rest of this app).
function trackPageview() {
    fetch(`${API_BASE}/api/analytics/pageview`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ visitorId: getVisitorId() }),
    }).catch(() => {});
}

// Initialize the app
document.addEventListener('DOMContentLoaded', () => {
    fetchProducts();
    fetchCart();
    addCategoryListeners();
    trackPageview();
});

// --- PWA + theme -----------------------------------------------------------

// Register the service worker (PWA: installable + offline app shell)
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js').catch(error => {
            console.error('Service worker registration failed:', error);
        });
    });
}

// Dark mode: manual toggle persisted in localStorage, OS preference as default
const themeToggle = document.getElementById('theme-toggle');

function applyTheme(theme) {
    document.documentElement.dataset.theme = theme;
    if (themeToggle) {
        themeToggle.textContent = theme === 'dark' ? '☀️' : '🌙';
    }
    try {
        localStorage.setItem('fiti-theme', theme);
    } catch {
        /* storage unavailable - theme just won't persist */
    }
}

const storedTheme = (() => {
    try {
        return localStorage.getItem('fiti-theme');
    } catch {
        return null;
    }
})();
const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
applyTheme(storedTheme || (prefersDark ? 'dark' : 'light'));

if (themeToggle) {
    themeToggle.addEventListener('click', () => {
        const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
        applyTheme(next);
    });
}
