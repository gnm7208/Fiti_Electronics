// Admin dashboard: auth flow, stats/charts, product CRUD, live notifications.
// Hand-rolled SVG charts (no charting library) per this app's vanilla-JS
// approach; palette/marks follow the dataviz skill's guidance (single-hue
// per small-multiple chart since visits/orders/revenue are different scales
// - never a dual-axis chart; nominal bars for the demand chart share one hue).
import { escapeHtml } from './js/utils.js';

const API_BASE = '';

// --- DOM refs ----------------------------------------------------------------

const loginScreen = document.getElementById('admin-login-screen');
const loginForm = document.getElementById('admin-login-form');
const loginError = document.getElementById('admin-login-error');
const dashboard = document.getElementById('admin-dashboard');
const logoutBtn = document.getElementById('admin-logout-btn');
const themeToggle = document.getElementById('admin-theme-toggle');

const notifToggle = document.getElementById('admin-notifications-toggle');
const notifBadge = document.getElementById('admin-notif-badge');
const notifPanel = document.getElementById('admin-notifications-panel');
const notifClose = document.getElementById('admin-notifications-close');
const notifList = document.getElementById('admin-notifications-list');

const statTiles = document.getElementById('admin-stat-tiles');
const chartVisits = document.getElementById('chart-visits');
const chartOrders = document.getElementById('chart-orders');
const chartRevenue = document.getElementById('chart-revenue');
const chartDemand = document.getElementById('chart-demand');

const productsTbody = document.getElementById('admin-products-tbody');
const addProductBtn = document.getElementById('admin-add-product-btn');

const productModal = document.getElementById('admin-product-modal');
const productModalTitle = document.getElementById('admin-product-modal-title');
const productModalClose = document.getElementById('admin-product-modal-close');
const productForm = document.getElementById('admin-product-form');
const productFormError = document.getElementById('admin-product-form-error');
const productIdField = document.getElementById('admin-product-id');
const nameField = document.getElementById('admin-product-name');
const categoryField = document.getElementById('admin-product-category');
const descriptionField = document.getElementById('admin-product-description');
const priceField = document.getElementById('admin-product-price');
const costPriceField = document.getElementById('admin-product-cost-price');
const stockField = document.getElementById('admin-product-stock');
const originalPriceField = document.getElementById('admin-product-original-price');
const photoFileField = document.getElementById('admin-product-photo-file');
const photoUrlField = document.getElementById('admin-product-photo-url');
const galleryFilesField = document.getElementById('admin-product-gallery-files');
const galleryUrlsField = document.getElementById('admin-product-gallery-urls');
const specsRowsContainer = document.getElementById('admin-specs-rows');
const addSpecRowBtn = document.getElementById('admin-add-spec-row');

const toastContainer = document.getElementById('admin-toast-container');

// --- State --------------------------------------------------------------------

let products = [];
let productBreakdown = [];
let notifications = [];
let eventSource = null;

// --- Toast (mirrors script.js's showToast) ------------------------------------

function showToast(message, type = 'info') {
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

function formatMoney(amount) {
    return `$${Number(amount || 0).toFixed(2)}`;
}

// --- Auth ----------------------------------------------------------------------

async function apiFetch(path, options = {}) {
    const response = await fetch(`${API_BASE}${path}`, { credentials: 'same-origin', ...options });
    if (response.status === 401) {
        showLogin();
        throw new Error('Not authenticated');
    }
    return response;
}

function showLogin() {
    stopNotificationStream();
    loginScreen.classList.remove('hidden');
    dashboard.classList.add('hidden');
}

async function showDashboard() {
    loginScreen.classList.add('hidden');
    dashboard.classList.remove('hidden');
    await loadAll();
    startNotificationStream();
}

async function checkAuth() {
    try {
        const response = await fetch(`${API_BASE}/api/admin/auth/me`, { credentials: 'same-origin' });
        if (response.ok) {
            await showDashboard();
        } else {
            showLogin();
        }
    } catch {
        showLogin();
    }
}

loginForm.addEventListener('submit', async event => {
    event.preventDefault();
    loginError.classList.add('hidden');
    const username = document.getElementById('admin-username').value;
    const password = document.getElementById('admin-password').value;
    try {
        const response = await fetch(`${API_BASE}/api/admin/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin',
            body: JSON.stringify({ username, password }),
        });
        if (!response.ok) {
            const body = await response.json().catch(() => ({}));
            loginError.textContent = body.error || 'Login failed';
            loginError.classList.remove('hidden');
            return;
        }
        loginForm.reset();
        await showDashboard();
    } catch {
        loginError.textContent = 'Could not reach the server. Is it running?';
        loginError.classList.remove('hidden');
    }
});

logoutBtn.addEventListener('click', async () => {
    await fetch(`${API_BASE}/api/admin/auth/logout`, { method: 'POST', credentials: 'same-origin' });
    showLogin();
});

// --- Data loading ---------------------------------------------------------------

// Guards against overlapping loadAll() calls (e.g. several SSE notifications
// arriving in quick succession, or an inline edit racing a live-push refresh)
// applying their results out of order - only the most recently *started*
// call is allowed to render.
let loadAllToken = 0;

async function loadAll() {
    const token = ++loadAllToken;
    const [overview, timeseries, breakdown, notifs] = await Promise.all([
        apiFetch('/api/admin/stats/overview').then(r => r.json()),
        apiFetch('/api/admin/stats/timeseries?days=30').then(r => r.json()),
        apiFetch('/api/admin/stats/products').then(r => r.json()),
        apiFetch('/api/admin/notifications').then(r => r.json()),
        loadProducts(),
    ]);
    if (token !== loadAllToken) return; // a newer loadAll() has since started - discard this one

    productBreakdown = breakdown;
    notifications = notifs;

    renderStatTiles(overview);
    renderLineChart(chartVisits, timeseries, 'pageviews', v => String(v));
    renderLineChart(chartOrders, timeseries, 'orders', v => String(v));
    renderLineChart(chartRevenue, timeseries, 'revenue', v => formatMoney(v));
    renderDemandChart(productBreakdown.filter(p => !p.deleted));
    renderProductsTable();
    renderNotifications();
}

async function loadProducts() {
    const response = await fetch(`${API_BASE}/products`);
    products = await response.json();
}

// --- Stat tiles -------------------------------------------------------------------

function renderStatTiles(overview) {
    const tiles = [
        { label: 'Total visits', value: overview.totalPageviews },
        { label: 'Unique visitors', value: overview.uniqueVisitors },
        { label: 'Orders', value: overview.totalOrders },
        { label: 'Units sold', value: overview.totalUnitsSold },
        { label: 'Revenue', value: formatMoney(overview.totalRevenue) },
        { label: 'Profit', value: formatMoney(overview.totalProfit), cls: 'accent' },
        { label: 'In stock', value: overview.productsInStock },
        { label: 'Out of stock', value: overview.productsOutOfStock, cls: overview.productsOutOfStock > 0 ? 'danger' : '' },
    ];
    statTiles.innerHTML = '';
    tiles.forEach(tile => {
        const el = document.createElement('div');
        el.className = 'admin-stat-tile';
        el.innerHTML = `
            <p class="admin-stat-tile-label"></p>
            <p class="admin-stat-tile-value ${tile.cls || ''}"></p>
        `;
        el.querySelector('.admin-stat-tile-label').textContent = tile.label;
        el.querySelector('.admin-stat-tile-value').textContent = tile.value;
        statTiles.appendChild(el);
    });
}

// --- SVG chart helpers --------------------------------------------------------------

const SVG_NS = 'http://www.w3.org/2000/svg';

function svgEl(tag, attrs = {}) {
    const el = document.createElementNS(SVG_NS, tag);
    Object.entries(attrs).forEach(([key, value]) => el.setAttribute(key, value));
    return el;
}

function niceMax(value) {
    if (value <= 0) return 1;
    const magnitude = 10 ** Math.floor(Math.log10(value));
    return Math.ceil(value / magnitude) * magnitude;
}

/**
 * A single-series line chart (visits/orders/revenue each get their own -
 * different scales, so per the "never dual-axis" rule these are small
 * multiples rather than one combined chart). Includes gridlines, an
 * end-point value label, and a hover crosshair + tooltip.
 */
function renderLineChart(container, series, key, formatValue) {
    container.innerHTML = '';
    const width = 400;
    const height = 140;
    const padTop = 16;
    const padBottom = 20;
    const padX = 8;
    const plotHeight = height - padTop - padBottom;
    const values = series.map(d => d[key]);
    const max = niceMax(Math.max(...values, 1));

    const xFor = i => padX + (i / Math.max(1, series.length - 1)) * (width - padX * 2);
    const yFor = v => padTop + plotHeight - (v / max) * plotHeight;

    const svg = svgEl('svg', { viewBox: `0 0 ${width} ${height}`, role: 'img', 'aria-label': `${key} over the last ${series.length} days` });

    // Gridlines at 0%, 50%, 100%, with rounded value labels (never a number on every point).
    [0, 0.5, 1].forEach(fraction => {
        const y = padTop + plotHeight - fraction * plotHeight;
        svg.appendChild(svgEl('line', { x1: padX, x2: width - padX, y1: y, y2: y, class: 'admin-chart-gridline' }));
        const label = svgEl('text', { x: 0, y: y - 2, class: 'admin-chart-label' });
        label.textContent = formatValue(Math.round(max * fraction));
        svg.appendChild(label);
    });

    const linePoints = series.map((d, i) => `${xFor(i)},${yFor(d[key])}`).join(' ');
    svg.appendChild(svgEl('polyline', { points: linePoints, class: 'admin-chart-line' }));

    const areaPoints = `${xFor(0)},${yFor(0)} ${linePoints} ${xFor(series.length - 1)},${yFor(0)}`;
    const areaPath = svgEl('polygon', { points: areaPoints, class: 'admin-chart-area' });
    svg.appendChild(areaPath);
    // Fill the area with the line's own color (one source of truth: the CSS stroke color).
    requestAnimationFrame(() => {
        const lineEl = svg.querySelector('.admin-chart-line');
        if (lineEl) areaPath.setAttribute('fill', getComputedStyle(lineEl).stroke);
    });

    // End-point marker + direct label (selective labeling: only the latest value).
    const lastIndex = series.length - 1;
    const lastX = xFor(lastIndex);
    const lastY = yFor(series[lastIndex][key]);
    const dot = svgEl('circle', { cx: lastX, cy: lastY, r: 4, class: 'admin-chart-dot' });
    requestAnimationFrame(() => {
        const lineEl = svg.querySelector('.admin-chart-line');
        if (lineEl) dot.setAttribute('stroke', getComputedStyle(lineEl).stroke);
    });
    svg.appendChild(dot);
    const endLabel = svgEl('text', { x: Math.min(lastX + 6, width - 30), y: lastY - 8, class: 'admin-chart-value-label' });
    endLabel.textContent = formatValue(series[lastIndex][key]);
    svg.appendChild(endLabel);

    // Sparse x-axis labels: first and last date only.
    [0, lastIndex].forEach(i => {
        const label = svgEl('text', { x: xFor(i), y: height - 4, class: 'admin-chart-label', 'text-anchor': i === 0 ? 'start' : 'end' });
        label.textContent = series[i].date.slice(5);
        svg.appendChild(label);
    });

    // Hover crosshair + tooltip, snapping to the nearest day.
    const crosshair = svgEl('line', { x1: 0, x2: 0, y1: padTop, y2: height - padBottom, class: 'admin-chart-crosshair' });
    svg.appendChild(crosshair);

    const tooltip = document.createElement('div');
    tooltip.className = 'admin-chart-tooltip';
    container.appendChild(tooltip);
    container.style.position = 'relative';

    const hitArea = svgEl('rect', { x: 0, y: 0, width, height, fill: 'transparent' });
    hitArea.addEventListener('pointermove', event => {
        const rect = svg.getBoundingClientRect();
        const relativeX = ((event.clientX - rect.left) / rect.width) * width;
        const index = Math.max(0, Math.min(series.length - 1, Math.round(((relativeX - padX) / (width - padX * 2)) * (series.length - 1))));
        const x = xFor(index);
        crosshair.setAttribute('x1', x);
        crosshair.setAttribute('x2', x);
        crosshair.style.opacity = '1';
        tooltip.textContent = `${series[index].date}: ${formatValue(series[index][key])}`;
        tooltip.classList.add('visible');
        tooltip.style.left = `${(x / width) * 100}%`;
        tooltip.style.top = `${(yFor(series[index][key]) / height) * 100}%`;
    });
    hitArea.addEventListener('pointerleave', () => {
        crosshair.style.opacity = '0';
        tooltip.classList.remove('visible');
    });
    svg.appendChild(hitArea);

    container.appendChild(svg);
}

/**
 * Horizontal bar chart for product demand: nominal categories (product
 * names), so every bar shares one hue - color never encodes rank/value here.
 * Products never sold get a muted "zero sales" fill as a distinct state.
 */
function renderDemandChart(breakdown) {
    chartDemand.innerHTML = '';
    if (breakdown.length === 0) {
        chartDemand.textContent = 'No product data yet.';
        return;
    }

    const top = breakdown.slice(0, 8);
    const bottom = breakdown.slice(-5).filter(p => !top.includes(p));

    const renderGroup = (title, list) => {
        if (list.length === 0) return;
        const heading = document.createElement('p');
        heading.className = 'admin-card-hint-inline';
        heading.style.margin = '0.5rem 0 0.35rem';
        heading.textContent = title;
        chartDemand.appendChild(heading);

        const width = 400;
        const barHeight = 22;
        const gap = 6;
        const labelWidth = 140;
        const height = list.length * (barHeight + gap);
        const maxUnits = Math.max(...list.map(p => p.unitsSold), 1);

        const svg = svgEl('svg', { viewBox: `0 0 ${width} ${height}`, role: 'img', 'aria-label': title });
        const tooltip = document.createElement('div');
        tooltip.className = 'admin-chart-tooltip';

        list.forEach((product, i) => {
            const y = i * (barHeight + gap);
            const barMaxWidth = width - labelWidth - 40;
            const barWidth = (product.unitsSold / maxUnits) * barMaxWidth;

            const group = svgEl('g', { class: 'admin-demand-bar-row' });
            const nameLabel = svgEl('text', { x: 0, y: y + barHeight / 2 + 4, class: 'admin-demand-name' });
            nameLabel.textContent = product.name.length > 18 ? `${product.name.slice(0, 17)}…` : product.name;
            group.appendChild(nameLabel);

            const bar = svgEl('rect', {
                x: labelWidth,
                y,
                width: Math.max(2, barWidth),
                height: barHeight,
                rx: 4,
                class: `admin-demand-bar${product.unitsSold === 0 ? ' zero-sales' : ''}`,
            });
            group.appendChild(bar);

            const valueLabel = svgEl('text', { x: labelWidth + Math.max(2, barWidth) + 6, y: y + barHeight / 2 + 4, class: 'admin-demand-value' });
            valueLabel.textContent = String(product.unitsSold);
            group.appendChild(valueLabel);

            group.addEventListener('pointermove', event => {
                const rect = chartDemand.getBoundingClientRect();
                tooltip.textContent = `${product.name}: ${product.unitsSold} sold, ${formatMoney(product.revenue)} revenue`;
                tooltip.classList.add('visible');
                tooltip.style.left = `${event.clientX - rect.left}px`;
                tooltip.style.top = `${event.clientY - rect.top}px`;
            });
            group.addEventListener('pointerleave', () => tooltip.classList.remove('visible'));

            svg.appendChild(group);
        });

        const wrap = document.createElement('div');
        wrap.style.position = 'relative';
        wrap.appendChild(svg);
        wrap.appendChild(tooltip);
        chartDemand.appendChild(wrap);
    };

    renderGroup('Top sellers', top);
    renderGroup('Lowest demand — consider phasing out', bottom);
}

// --- Notifications ------------------------------------------------------------------

function notificationTimeAgo(iso) {
    const diffMs = Date.now() - new Date(iso).getTime();
    const minutes = Math.round(diffMs / 60000);
    if (minutes < 1) return 'just now';
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.round(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.round(hours / 24)}d ago`;
}

function renderNotifications() {
    const unreadCount = notifications.filter(n => !n.read).length;
    notifBadge.textContent = String(unreadCount);
    notifBadge.classList.toggle('hidden', unreadCount === 0);

    notifList.innerHTML = '';
    if (notifications.length === 0) {
        const empty = document.createElement('p');
        empty.className = 'admin-card-hint';
        empty.textContent = 'No notifications yet.';
        notifList.appendChild(empty);
        return;
    }
    notifications.forEach(notification => {
        const item = document.createElement('div');
        item.className = `admin-notification-item type-${notification.type}${notification.read ? '' : ' unread'}`;
        item.tabIndex = 0;
        const messageEl = document.createElement('span');
        messageEl.textContent = notification.message;
        const timeEl = document.createElement('span');
        timeEl.className = 'admin-notification-time';
        timeEl.textContent = notificationTimeAgo(notification.createdAt);
        item.appendChild(messageEl);
        item.appendChild(timeEl);

        const markRead = async () => {
            if (notification.read) return;
            await apiFetch(`/api/admin/notifications/${notification.id}/read`, { method: 'POST' });
            notification.read = true;
            renderNotifications();
        };
        item.addEventListener('click', markRead);
        notifList.appendChild(item);
    });
}

function startNotificationStream() {
    stopNotificationStream();
    eventSource = new EventSource(`${API_BASE}/api/admin/notifications/stream`);
    eventSource.onmessage = event => {
        const notification = JSON.parse(event.data);
        notifications.unshift(notification);
        renderNotifications();
        showToast(notification.message, notification.type === 'out_of_stock' || notification.type === 'low_stock' ? 'error' : 'success');
        // A new order/stock event likely changed the numbers everywhere else too.
        loadAll();
    };
}

function stopNotificationStream() {
    if (eventSource) {
        eventSource.close();
        eventSource = null;
    }
}

notifToggle.addEventListener('click', () => {
    const isHidden = notifPanel.classList.contains('hidden');
    notifPanel.classList.toggle('hidden', !isHidden);
    notifToggle.setAttribute('aria-expanded', String(isHidden));
});
notifClose.addEventListener('click', () => {
    notifPanel.classList.add('hidden');
    notifToggle.setAttribute('aria-expanded', 'false');
});

// --- Products table ------------------------------------------------------------------

function renderProductsTable() {
    const soldById = new Map(productBreakdown.map(p => [p.id, p.unitsSold]));
    productsTbody.innerHTML = '';
    products.forEach(product => {
        const stock = product.stock ?? 0;
        const margin = product.price > 0 ? Math.round(((product.price - (product.costPrice || 0)) / product.price) * 100) : 0;
        const row = document.createElement('tr');
        row.innerHTML = `
            <td><img class="admin-product-thumb" src="${escapeHtml(product.image)}" alt=""></td>
            <td>${escapeHtml(product.name)}</td>
            <td>${escapeHtml(product.category)}</td>
            <td>$${Number(product.price).toFixed(2)}</td>
            <td>$${Number(product.costPrice || 0).toFixed(2)}</td>
            <td>${margin}%</td>
            <td><input type="number" min="0" step="1" class="admin-stock-input${stock <= 0 ? ' out-of-stock' : ''}" data-id="${product.id}" value="${stock}"></td>
            <td>${soldById.get(product.id) || 0}</td>
            <td class="admin-table-actions">
                <button type="button" class="admin-edit-btn" data-id="${product.id}">Edit</button>
                <button type="button" class="admin-delete-btn" data-id="${product.id}">Delete</button>
            </td>
        `;
        productsTbody.appendChild(row);
    });

    productsTbody.querySelectorAll('.admin-stock-input').forEach(input => {
        input.addEventListener('change', async () => {
            const id = input.dataset.id;
            const value = Math.max(0, Math.round(Number(input.value) || 0));
            input.value = value;
            const formData = new FormData();
            formData.append('stock', String(value));
            const response = await apiFetch(`/api/admin/products/${id}`, { method: 'PUT', body: formData });
            if (response.ok) {
                showToast('Stock updated', 'success');
                await loadAll();
            } else {
                showToast('Failed to update stock', 'error');
            }
        });
    });

    productsTbody.querySelectorAll('.admin-edit-btn').forEach(btn => {
        btn.addEventListener('click', () => openProductModal(products.find(p => p.id === Number(btn.dataset.id))));
    });

    productsTbody.querySelectorAll('.admin-delete-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            const product = products.find(p => p.id === Number(btn.dataset.id));
            if (!product || !confirm(`Delete "${product.name}"? This cannot be undone.`)) return;
            const response = await apiFetch(`/api/admin/products/${product.id}`, { method: 'DELETE' });
            if (response.ok) {
                showToast(`Deleted ${product.name}`, 'success');
                await loadAll();
            } else {
                showToast('Failed to delete product', 'error');
            }
        });
    });
}

// --- Add/edit product modal -----------------------------------------------------------

function addSpecRow(label = '', value = '') {
    const row = document.createElement('div');
    row.className = 'admin-spec-row';
    row.innerHTML = `
        <input type="text" class="admin-spec-label" placeholder="Label (e.g. Display)">
        <input type="text" class="admin-spec-value" placeholder="Value (e.g. 6.1″ OLED)">
        <button type="button" class="admin-spec-remove-btn" aria-label="Remove spec">✕</button>
    `;
    row.querySelector('.admin-spec-label').value = label;
    row.querySelector('.admin-spec-value').value = value;
    row.querySelector('.admin-spec-remove-btn').addEventListener('click', () => row.remove());
    specsRowsContainer.appendChild(row);
}

addSpecRowBtn.addEventListener('click', () => addSpecRow());

function openProductModal(product) {
    productFormError.classList.add('hidden');
    productForm.reset();
    specsRowsContainer.innerHTML = '';

    if (product) {
        productModalTitle.textContent = `Edit ${product.name}`;
        productIdField.value = product.id;
        nameField.value = product.name;
        categoryField.value = product.category;
        descriptionField.value = product.description;
        priceField.value = product.price;
        costPriceField.value = product.costPrice || 0;
        stockField.value = product.stock || 0;
        originalPriceField.value = product.originalPrice || '';
        photoUrlField.value = product.image || '';
        const gallery = (product.images || []).filter(img => img !== product.image);
        galleryUrlsField.value = gallery.join('\n');
        (product.specs || []).forEach(spec => addSpecRow(spec.label, spec.value));
    } else {
        productModalTitle.textContent = 'Add Product';
        productIdField.value = '';
    }
    if (!product) addSpecRow();

    productModal.classList.remove('hidden');
}

function closeProductModal() {
    productModal.classList.add('hidden');
}

addProductBtn.addEventListener('click', () => openProductModal(null));
productModalClose.addEventListener('click', closeProductModal);
productModal.addEventListener('click', event => {
    if (event.target === productModal) closeProductModal();
});

productForm.addEventListener('submit', async event => {
    event.preventDefault();
    productFormError.classList.add('hidden');

    const specs = Array.from(specsRowsContainer.querySelectorAll('.admin-spec-row'))
        .map(row => ({
            label: row.querySelector('.admin-spec-label').value.trim(),
            value: row.querySelector('.admin-spec-value').value.trim(),
        }))
        .filter(spec => spec.label && spec.value);

    const galleryUrls = galleryUrlsField.value
        .split('\n')
        .map(line => line.trim())
        .filter(Boolean);

    const formData = new FormData();
    formData.append('name', nameField.value.trim());
    formData.append('category', categoryField.value);
    formData.append('description', descriptionField.value.trim());
    formData.append('price', priceField.value);
    formData.append('costPrice', costPriceField.value);
    formData.append('stock', stockField.value);
    if (originalPriceField.value) formData.append('originalPrice', originalPriceField.value);
    if (specs.length > 0) formData.append('specs', JSON.stringify(specs));
    if (photoFileField.files[0]) formData.append('photo', photoFileField.files[0]);
    if (photoUrlField.value.trim()) formData.append('imageUrl', photoUrlField.value.trim());
    Array.from(galleryFilesField.files).forEach(file => formData.append('galleryPhotos', file));
    if (galleryUrls.length > 0) formData.append('galleryUrls', JSON.stringify(galleryUrls));

    const id = productIdField.value;
    try {
        const response = await apiFetch(id ? `/api/admin/products/${id}` : '/api/admin/products', {
            method: id ? 'PUT' : 'POST',
            body: formData,
        });
        if (!response.ok) {
            const body = await response.json().catch(() => ({}));
            productFormError.textContent = body.error || 'Could not save product';
            productFormError.classList.remove('hidden');
            return;
        }
        showToast(id ? 'Product updated' : 'Product added', 'success');
        closeProductModal();
        await loadAll();
    } catch {
        productFormError.textContent = 'Could not reach the server';
        productFormError.classList.remove('hidden');
    }
});

// --- Theme (shared localStorage key with the storefront) ------------------------------

function applyTheme(theme) {
    document.documentElement.dataset.theme = theme;
    themeToggle.textContent = theme === 'dark' ? '☀️' : '🌙';
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
applyTheme(storedTheme || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'));

themeToggle.addEventListener('click', () => {
    applyTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');
});

// --- Init --------------------------------------------------------------------------

checkAuth();
