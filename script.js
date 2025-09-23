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
let cart = [];
let products = [];

// API base URL
const API_BASE = 'http://localhost:3000';

// Fetch products from JSON server
async function fetchProducts() {
    try {
        const response = await fetch(`${API_BASE}/products`);
        products = await response.json();
        displayProducts(products);
    } catch (error) {
        console.error('Error fetching products:', error);
        productsGrid.innerHTML = '<p>Error loading products. Please try again later.</p>';
    }
}

// Display products in the grid
function displayProducts(productsToShow) {
    productsGrid.innerHTML = '';
    productsToShow.forEach(product => {
        const productCard = document.createElement('div');
        productCard.className = 'product-card';
        productCard.innerHTML = `
            <img src="${product.image}" alt="${product.name}" class="product-image">
            <div class="product-info">
                <h3 class="product-name">${product.name}</h3>
                <p class="product-price">$${product.price.toFixed(2)}</p>
                <p class="product-description">${product.description}</p>
                <button class="add-to-cart" data-id="${product.id}">Add to Cart</button>
            </div>
        `;
        productsGrid.appendChild(productCard);
    });

    // Add event listeners to add to cart buttons
    document.querySelectorAll('.add-to-cart').forEach(button => {
        button.addEventListener('click', addToCart);
    });
}

// Add product to cart
async function addToCart(event) {
    const productId = parseInt(event.target.dataset.id);
    const product = products.find(p => p.id === productId);

    if (product) {
        try {
            const response = await fetch(`${API_BASE}/cart`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(product),
            });

            if (response.ok) {
                cart.push(product);
                updateCartDisplay();
                updateCartCount();
            } else {
                console.error('Error adding to cart');
            }
        } catch (error) {
            console.error('Error adding to cart:', error);
        }
    }
}

// Remove item from cart
async function removeFromCart(event) {
    const productId = parseInt(event.target.dataset.id);
    
    try {
        const response = await fetch(`${API_BASE}/cart/${productId}`, {
            method: 'DELETE',
        });

        if (response.ok) {
            cart = cart.filter(item => item.id !== productId);
            updateCartDisplay();
            updateCartCount();
        } else {
            console.error('Error removing from cart');
        }
    } catch (error) {
        console.error('Error removing from cart:', error);
    }
}

// Update cart display
function updateCartDisplay() {
    cartItems.innerHTML = '';
    let total = 0;

    cart.forEach(item => {
        const cartItem = document.createElement('div');
        cartItem.className = 'cart-item';
        cartItem.innerHTML = `
            <span class="cart-item-name">${item.name}</span>
            <span class="cart-item-price">$${item.price.toFixed(2)}</span>
            <button class="remove-item" data-id="${item.id}">Remove</button>
        `;
        cartItems.appendChild(cartItem);
        total += item.price;
    });

    totalItems.textContent = cart.length;
    totalCost.textContent = total.toFixed(2);

    // Add event listeners to remove buttons
    document.querySelectorAll('.remove-item').forEach(button => {
        button.addEventListener('click', removeFromCart);
    });
}

// Update cart count in header
function updateCartCount() {
    cartCount.textContent = cart.length;
}

// Toggle cart sidebar
function toggleCart() {
    cartSidebar.classList.toggle('hidden');
}

// Close cart sidebar
function closeCart() {
    cartSidebar.classList.add('hidden');
}

// Show checkout modal
function showCheckoutModal() {
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

// Fetch cart data on page load
async function fetchCart() {
    try {
        const response = await fetch(`${API_BASE}/cart`);
        cart = await response.json();
        updateCartDisplay();
        updateCartCount();
    } catch (error) {
        console.error('Error fetching cart:', error);
    }
}

// Initialize the app
document.addEventListener('DOMContentLoaded', () => {
    fetchProducts();
    fetchCart();
});
