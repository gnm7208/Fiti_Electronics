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

// State
// Cart lines are { id, name, price, image, qty }
let cart = [];
let products = [];

// API base URL
const API_BASE = '';

// Cart persistence: prefer the json-server /cart API (Render deployment);
// fall back to localStorage on static hosting (Netlify) where no API exists.
const CART_STORAGE_KEY = 'fiti-cart';
let cartApiAvailable = false;

// --- Utilities -----------------------------------------------------------

// Escape user/data-provided text before inserting into HTML
function escapeHtml(value) {
    const div = document.createElement('div');
    div.textContent = String(value);
    return div.innerHTML;
}

function saveCartLocally() {
    try {
        localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
    } catch (error) {
        console.error('Error saving cart locally:', error);
    }
}

function loadCartLocally() {
    try {
        return JSON.parse(localStorage.getItem(CART_STORAGE_KEY)) || [];
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

// --- Products ------------------------------------------------------------

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
        const filteredProducts = products.filter(product => product.category === category);
        displayProducts(filteredProducts);
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

    // Add event listeners to add to cart buttons
    document.querySelectorAll('.add-to-cart').forEach(button => {
        button.addEventListener('click', addToCart);
    });
}

// --- Cart ----------------------------------------------------------------

// Add product to cart (or bump quantity if it's already there)
async function addToCart(event) {
    const productId = parseInt(event.target.dataset.id);
    const product = products.find(p => p.id === productId);
    if (!product) return;

    const existing = cart.find(line => line.id === productId);
    if (existing) {
        existing.qty += 1;
        await persistCartLine(existing);
    } else {
        const line = {
            id: product.id,
            name: product.name,
            price: product.price,
            image: product.image,
            qty: 1,
        };
        cart.push(line);
        await persistCartLine(line, { isNew: true });
    }

    updateCartDisplay();
    updateCartCount();
}

// Decrement quantity, removing the line when it reaches zero
async function decrementCartLine(productId) {
    const line = cart.find(item => item.id === productId);
    if (!line) return;

    line.qty -= 1;
    if (line.qty <= 0) {
        cart = cart.filter(item => item.id !== productId);
        await persistCartLine(line, { removed: true });
    } else {
        await persistCartLine(line);
    }

    updateCartDisplay();
    updateCartCount();
}

// Remove a line entirely
async function removeFromCart(productId) {
    const line = cart.find(item => item.id === productId);
    if (!line) return;

    cart = cart.filter(item => item.id !== productId);
    await persistCartLine(line, { removed: true });

    updateCartDisplay();
    updateCartCount();
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

    updateCartDisplay();
    updateCartCount();
}

// Update cart display
function updateCartDisplay() {
    cartItems.innerHTML = '';
    let total = 0;

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
        total += lineTotal;
    });

    totalItems.textContent = cart.reduce((sum, item) => sum + item.qty, 0);
    totalCost.textContent = total.toFixed(2);

    // Wire up quantity and remove controls
    document.querySelectorAll('.remove-item').forEach(button => {
        button.addEventListener('click', e => removeFromCart(parseInt(e.target.dataset.id)));
    });
    document.querySelectorAll('.qty-decrease').forEach(button => {
        button.addEventListener('click', e => decrementCartLine(parseInt(e.target.dataset.id)));
    });
    document.querySelectorAll('.qty-increase').forEach(button => {
        button.addEventListener('click', e => {
            const line = cart.find(item => item.id === parseInt(e.target.dataset.id));
            if (line) {
                line.qty += 1;
                persistCartLine(line);
                updateCartDisplay();
                updateCartCount();
            }
        });
    });
}

// Update cart count in header
function updateCartCount() {
    cartCount.textContent = cart.reduce((sum, item) => sum + item.qty, 0);
}

// Save cart to orders
async function saveCart() {
    if (cart.length === 0) return;
    const order = { items: cart, timestamp: new Date().toISOString() };
    if (!cartApiAvailable) {
        // Static hosting: keep a local order history
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

// --- UI ------------------------------------------------------------------

// Toggle cart sidebar
function toggleCart() {
    cartSidebar.classList.toggle('hidden');
}

// Close cart sidebar
function closeCart() {
    cartSidebar.classList.add('hidden');
}

// Show checkout modal
async function showCheckoutModal() {
    if (cart.length === 0) {
        alert('Your cart is empty. Add some products before checking out.');
        return;
    }
    await saveCart();
    await clearCart();
    checkoutModal.classList.remove('hidden');
}

// Close checkout modal
function closeCheckoutModal() {
    checkoutModal.classList.add('hidden');
}

// Search functionality
function searchProducts() {
    const query = searchInput.value.toLowerCase();
    const filteredProducts = products.filter(product =>
        product.name.toLowerCase().includes(query) ||
        product.description.toLowerCase().includes(query)
    );
    displayProducts(filteredProducts);
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
            // Remove active class from all buttons
            document.querySelectorAll('.category-btn').forEach(btn => btn.classList.remove('active'));
            // Add active class to clicked button
            e.target.classList.add('active');
            // Filter products
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
        // Migrate legacy entries without a qty field
        cart = data.map(item => ({ ...item, qty: item.qty || 1 }));
    } catch {
        // Static hosting (e.g. Netlify): fall back to localStorage
        cartApiAvailable = false;
        cart = loadCartLocally();
    }
    updateCartDisplay();
    updateCartCount();
}

// Initialize the app
document.addEventListener('DOMContentLoaded', () => {
    fetchProducts();
    fetchCart();
    // Add category listeners after DOM is loaded
    addCategoryListeners();
});
