# 👍 Fiti Electronics

A mini e-commerce web application for browsing and purchasing electronics.

## 🌍 Live Demo Links

- Netlify: [https://fiti.netlify.app]  
- Render: [https://fiti-electronics.onrender.com]

## Features

- Browse products by categories (All, Computers, Laptops, Phones, TVs, Accessories)
- Search functionality for products
- Add products to shopping cart
- View cart with item count and total cost
- Checkout with **real M-Pesa (Safaricom Daraja STK Push)** or **card payments (Stripe)**,
  with a polished simulated fallback when no payment credentials are configured or when
  running on static hosting with no backend (see [Payments Setup](#payments-setup))
- Responsive design for various screen sizes
- Persistent cart using JSON Server API (falls back to `localStorage` on static hosting)
- "Deals of the Day" carousel and a detailed product popup (gallery + specs) on click
- Contact & Visit Us section: shop location map + directions, delivery-area coverage,
  phone/social links, and a customer query form (general, or product-specific from the
  product popup) - see [API Endpoints](#api-endpoints)

## Technologies Used

- **Frontend**: HTML5, CSS3 (custom properties, dark mode), JavaScript (ES6+ modules)
- **Backend**: Express + JSON Server (mock REST API), extended with real payment routes
- **Payments**: Safaricom Daraja (M-Pesa STK Push), Stripe (card payments via Stripe.js Elements)
- **Data Storage**: JSON file for products, cart, orders, and payment records

## Installation

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd fiti-electronics
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

## Usage

1. Start the JSON Server backend (development mode):
   ```bash
   npm run dev
   ```
   This starts the API server on `http://localhost:3000` with watch mode enabled, serving both API and static files.

   For production-like deployment (uses $PORT env var):
   ```bash
   npm start
   ```

2. Access the app:
   - Open `http://localhost:3000/index.html` (served by json-server with `--static .`).
   - Or use a separate static server:
     ```bash
     npm run serve
     ```
     Then open `http://localhost:8080/index.html` (API at `http://localhost:3000`).

3. Use the application:
   - Browse products using category filters
   - Search for specific products
   - Add items to cart
   - View and manage cart items
   - Proceed to checkout

## API Endpoints

The application uses JSON Server to provide RESTful API endpoints (relative URLs for deployment):

- `GET /products` - Retrieve all products
- `GET /cart` - Retrieve current cart items
- `POST /cart` - Add an item to the cart
- `DELETE /cart/:id` - Remove a specific item from the cart
- `GET /orders` - Retrieve order history
- `POST /orders` - Create a new order (checkout)

Payment endpoints (see [Payments Setup](#payments-setup)):

- `GET /api/payments/status-check` - Whether M-Pesa/Stripe are configured on this server
- `GET /api/payments/stripe/config` - Publishable key for Stripe.js
- `POST /api/payments/mpesa/stkpush` - Initiate an M-Pesa STK Push prompt
- `GET /api/payments/mpesa/status/:checkoutRequestId` - Poll for the STK Push result
- `POST /api/payments/mpesa/callback` - Safaricom's async result webhook
- `POST /api/payments/stripe/create-payment-intent` - Create a Stripe PaymentIntent
- `POST /api/payments/stripe/webhook` - Stripe's signed payment-confirmation webhook

The `payments` collection is intentionally **not** exposed through json-server's generic
REST routes (it holds phone numbers and payment references) - it's only reachable through
the routes above.

Customer queries (the contact form / "ask about this product" form):

- `POST /api/queries` - Submit a name + question (optionally tagged with a product), used
  by the Contact & Visit Us section and the product popup's "Ask about this product" toggle

Like `payments`, the `queries` collection is not exposed through json-server's generic REST
routes (it holds customer names/messages) - only reachable through the route above. On
static hosting with no backend, submissions are queued in `localStorage` instead.

## Payments Setup

Real M-Pesa and card payments require credentials that only work on a server with a
backend (i.e. the Render deployment, not the static Netlify one). Without them, checkout
still works end-to-end using a clearly-labeled simulated "demo mode".

1. Copy `.env.example` to `.env` and fill in:
   - **M-Pesa (Safaricom Daraja sandbox)**: create a free account and app at
     [developer.safaricom.co.ke](https://developer.safaricom.co.ke) under
     "Lipa Na M-Pesa Sandbox" for `MPESA_CONSUMER_KEY` / `MPESA_CONSUMER_SECRET`.
     `MPESA_CALLBACK_URL` must be a publicly reachable HTTPS URL (your Render URL +
     `/api/payments/mpesa/callback`) - Safaricom cannot call back to `localhost`.
   - **Stripe (test mode)**: from [dashboard.stripe.com](https://dashboard.stripe.com) ->
     Developers -> API keys, with test mode toggled on.
2. On Render, add the same variables under the service's Environment settings.
3. Test M-Pesa with Safaricom's sandbox test number `254708374149`; test cards with
   Stripe's `4242 4242 4242 4242` (any future expiry, any CVC).

## Deployment

### Local Development
- Run `npm run dev` to start the custom Express + json-server backend (with payment
  routes) with file-watch enabled, serving both API and static files on port 3000.
- Access at `http://localhost:3000/index.html`.

### Render Deployment
1. Connect your GitHub repo to Render.
2. Set **Build Command**: `npm install`.
3. Set **Start Command**: `npm start`.
4. Environment: Node. Add the M-Pesa/Stripe environment variables from
   [Payments Setup](#payments-setup) if you want real payments instead of demo mode.
5. The app will be live at your Render URL (e.g., `https://your-app.onrender.com/index.html`).
   - Static files and the API (including `/api/payments/*`) are served together.
   - Relative URLs ensure API calls work on the deployed domain.
   - db.json provides persistent data (updates on commits).

Note: Render free tier spins down after inactivity; upgrade for always-on.

### Netlify (static-only) Deployment

Netlify serves the static files only - there's no backend, so `/api/payments/*` and
`/cart` don't exist there. The app detects this automatically and falls back to the
simulated demo checkout and a `localStorage`-backed cart, so the site fully works either
way.

## Recent Updates
- Added `--static .` to json-server scripts for serving frontend files.
- Changed API_BASE to relative URLs in script.js for deployment compatibility.
- Fixed cart clearing on checkout using individual DELETE requests.
- Thorough testing: Add/remove cart, checkout, search/filters, edge cases all work.


## Project Structure

```
fiti-electronics/
├── index.html          # Main HTML file
├── styles.css          # CSS styles (design tokens, dark mode, checkout UI)
├── script.js           # DOM wiring, cart persistence, checkout/payment orchestration
├── js/
│   ├── cart.js         # Pure cart logic (unit-testable)
│   ├── payments.js     # Pure payment logic: phone validation, formatting (unit-testable)
│   ├── deals.js        # Pure discount/deals logic (unit-testable)
│   ├── queries.js      # Pure query-form validation/payload logic (unit-testable)
│   └── utils.js        # Shared helpers (HTML escaping)
├── server.js            # Express + json-server entry point (products/cart/orders + payments/queries)
├── server/
│   ├── config.js         # Env var loading for Daraja/Stripe
│   ├── mpesa.js           # Safaricom Daraja OAuth + STK Push + status query
│   ├── stripeService.js   # Stripe PaymentIntents + webhook verification
│   ├── paymentsRouter.js  # /api/payments/* route handlers
│   ├── paymentsStore.js   # Payment record persistence (json-server's db)
│   ├── queriesRouter.js   # /api/queries route handler
│   └── queriesStore.js    # Query record persistence (json-server's db)
├── tests/               # Vitest unit tests
├── db.json              # JSON data (products, cart, orders, payments, queries)
├── .env.example         # Required environment variables (copy to .env)
├── package.json        # Node.js dependencies and scripts
├── images/             # Product images
├── README.md           # This file
└── LICENSE             # MIT License
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
