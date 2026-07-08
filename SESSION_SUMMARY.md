# Fiti Electronics — Project Status Summary

**Branch:** `optimize/modernization`
**Written:** as a safety-net record of everything done on this project, both before and during the current Claude Code chat session. Nothing described below as "in progress" has been committed or pushed yet — see [Commit status](#commit-status) at the bottom.

---

## 1. Prior to this chat (git history)

Commits already on `optimize/modernization` before this session started, oldest to newest:

1. `5244f62` Initial commit
2. `13662b8` index.html
3. `cb2388a` styles.css
4. `5e2f984` script.js
5. `f74ae90` db.json
6. `d83a924` category db.json
7. `b7632c4` category style.css
8. `794d0a7` filter products script.js
9. `ebc47fe` add laptops
10. `29120fe` add Event Listeners
11. `38d3fe9` button functionality and more products
12. `1e1516f` images
13. `612b9d5` Prepare for Render deployment: add API_BASE and update start script
14. `1bb063f` Fix start script to use PORT env var for Render
15. `14e1518` Add serve script and http-server dependency for static file serving, update package-lock and db.json
16. `e5f9aa6` Update README.md to include recommended npm run dev and npm run serve commands
17. `52fa339` Fix start script for deployment by adding --host 0.0.0.0 to bind to all interfaces
18. `2bfa42b` Update README with deployment instructions and recent changes; fix json-server scripts and API_BASE for Render deployment
19. `f1f21f9` Add .gitignore to exclude node_modules; remove node_modules from tracking; update README
20. `f6e9316` Add live demo links for Netlify and Render to README.md
21. `fd864b1` Add thumbs up emoji to the title in README.md
22. `d988234` Add thumbs up emoji to the header title in index.html
23. `1e6d137` Add arrow to the Add to Cart button
24. `238de7a` Increase cart sidebar width to 420px on desktop
25. `e3dbdec` fix: cart quantity handling, localStorage fallback for static hosting, XSS-safe rendering
26. `28f5e6b` refactor: extract pure cart logic into ES modules; add Vitest, ESLint, and CI
27. `6fb1d22` feat: PWA (manifest + service worker), dark mode, accessibility & SEO pass

At the start of this chat, the app was: a vanilla JS + json-server e-commerce demo (products/cart/orders), with ES-module cart logic, Vitest tests, ESLint + CI, a PWA service worker, dark mode, and basic accessibility/SEO — but with a plain "simulated checkout" (no real payment integration), stock product photos with visible white studio backgrounds, and a red (`#d32f2f`) brand color scheme.

---

## 2. Done during this chat session (uncommitted)

### 2.1 Real payment integration (M-Pesa + Stripe)
- New `server.js` + `server/` — extends json-server with a real Express backend:
  - `server/mpesa.js` — Safaricom Daraja OAuth, STK Push, status query, callback parsing.
  - `server/stripeService.js` — Stripe PaymentIntents + webhook signature verification.
  - `server/paymentsRouter.js` — `/api/payments/*` routes (stkpush, status polling, callback, Stripe config/create-intent/webhook).
  - `server/paymentsStore.js` — payment records persisted into a new `payments` collection in `db.json`, deliberately **not** exposed via json-server's generic REST routes (blocked in `server.js`) since it holds phone numbers/amounts.
  - `server/config.js` — env var loading; `.env.example` documents required Daraja/Stripe variables.
- Frontend checkout modal rebuilt (`index.html`, `script.js`, `styles.css`): payment method step (M-Pesa / Card) → phone entry or Stripe Elements card form → live status polling → receipt, with toasts replacing `alert()`.
- **Demo-mode fallback**: when Daraja/Stripe credentials aren't configured (current state — user has neither yet) or the backend is unreachable (static Netlify hosting), checkout automatically falls back to a clearly-labeled simulated flow, per-method independently.
- New pure logic module `js/payments.js` (Kenyan phone validation/normalization, amount formatting) + `tests/payments.test.js` (11 tests).
- Bugs found and fixed during this work:
  1. Checkout only checked payment-API reachability, not per-provider configuration — would've attempted a real STK push with no credentials.
  2. A CSS specificity bug made all checkout steps render simultaneously (`#id` selector beat a `.class.hidden` rule).
  3. `.demo-banner.hidden` had no matching CSS rule at all.
  4. json-server was auto-exposing `GET /payments` publicly — now blocked with a 404 guard.

### 2.2 UI overhaul — first pass
- CSS rewritten around design tokens (custom properties) for light/dark theming instead of scattered per-selector dark-mode overrides.
- Hero banner added, product cards/cart/checkout restyled, spinner/toast/receipt components added.
- Self-hosted **Manrope** font (5 weights, WOFF2) — avoids an external font request so the PWA's offline app shell stays intact.
- Header logo: replaced the 👍 emoji with an inline SVG lightning-bolt icon.
- "Add to Cart" button: arrow replaced with a 🛒 trolley emoji.

### 2.3 Product image background removal
- All 76 product PNGs processed with `rembg` (U²-Net AI background segmentation) to strip the baked-in white studio backgrounds (confirmed via alpha-channel inspection, not just visual guess — the PNGs were RGBA but fully opaque).
- Verified cutout quality on white-colored products specifically (HP headphones, Apple keyboard) to confirm it's real segmentation, not naive white-color-keying.
- **Found and fixed a rembg failure mode**: 6 TV images (`tv-4`, `tv-5`, `tv-7`, `tv-13`, `tv-14`, `tv-15` — TCL, Hisense U8K, Panasonic, Element, Westinghouse, Sceptre) had the AI mistake the *on-screen wallpaper content* for the product and strip away the actual TV bezel/stand. Fixed with a different technique: border-connected flood-fill (removes only white pixels connected to the image edge, so it can't misidentify the subject no matter how vivid the screen content is). Same technique + failure mode also hit a sourced Raspberry Pi board photo (rembg kept only the CPU chip); fixed the same way.
- Service worker fix: the old `sw.js` used a cache-first strategy that kept serving pre-processing (white-background) image bytes even after reload. Rewritten to network-first with cache only as an offline fallback, and cache version bumped, so asset updates can't be masked by stale cache again.

### 2.4 Color palette redesign (twice)
- First pass: replaced brand red (`#d32f2f`) with blue (`#2563eb`) — user felt this new blue "screamed" and clashed.
- Second pass (current): full redesign around **one coherent hue family**. The issue diagnosed: the navy ink color (`#1a1a2e`, used for text/hero) sits at a different hue angle (~240°) than the initial blue (~217°) — two different blues fighting each other.
  - Primary: soft indigo `#5c6bc0` / hover `#3f51b5` / deep `#283593` (same hue family as the existing navy).
  - Dark-mode product image tiles: changed from a separate teal to the same indigo family.
  - Success/checkout accent: teal-green `#00897b`.
  - Danger red (`#d32f2f` — the *original* brand red) now reserved strictly for the Remove button/errors, never as a broad color.
  - M-Pesa payment button gets a subtle real M-Pesa-green hover accent; Card button gets a light indigo tint.

### 2.5 New features: Deals carousel + product detail modal (done)
Requested: (a) a slidable "Deals" carousel above "Our Products", visible only on the "All" category view, showing struck-through original price + discounted price; (b) a product detail view (gallery + vertical specs) on clicking a product, as a focused modal (or better, if found); (c) fixing products whose background-removed image lost real content (see §2.3 — the 6 TVs), replacing with alternates where needed.

- **Data model** (`db.json`): every product now has a `specs` array (label/value pairs — hand-written accurate specs for ~16 well-known flagship products like the iPhones/MacBooks/Galaxy S23/Watch Series 8, auto-generated from parsed description text + category templates for the rest) and an `images` array (gallery-ready).
- **Discounts**: 12 products curated as "on offer" with an `originalPrice` field added (iPhone 14, Samsung Galaxy S23, MacBook Air M2, Sony WH-1000XM5, LG OLED 65" TV, Apple Watch Series 8, Dell XPS 13, Samsung Galaxy Buds Pro, Raspberry Pi 4, Bose QuietComfort Earbuds, ASUS ROG Strix Gaming Laptop, Hisense 75" U8K TV).
- **Alternate photos**: sourced 1 additional real photo each for iPhone 14 and Raspberry Pi 4 from Wikimedia Commons (freely licensed), background-removed and resized to catalog conventions. (Bounded scope — not all 12 deal products have a second photo yet; a low-quality candid Apple Watch photo was found and deliberately rejected rather than used.)
- **Pure logic**: `js/deals.js` (`isOnOffer`, `getDeals`, `discountPercent`) + `tests/deals.test.js` (7 tests) — all passing.
- **HTML/CSS/JS**: deals carousel (`#deals-section`) inserted above "Our Products", built from `renderDeals()` using `getDeals(products)`; the section hides itself outside the "All" category filter. Clicking any product card (grid or deal card) opens `openProductModal()` (`#product-modal`) — image gallery (main image + clickable thumbnails when a product has more than one photo), strikethrough original price + discount badge when on offer, description, vertical specs list, and an Add to Cart button that adds the item, toasts, and closes the modal. Closes via ✕, backdrop click, or Escape.
- **Carousel nav — iterated per feedback**: first built as circular prev/next arrow buttons (SVG chevrons, hover-slide + press animation). User clarified they meant the *scrollbar*, not the buttons — buttons were removed entirely and replaced with a custom-styled native scrollbar instead (indigo gradient thumb via `::-webkit-scrollbar-thumb` + Firefox `scrollbar-color` fallback), which is the current/final state.
- **Bugs found and fixed while verifying**:
  1. A classic flexbox shrink bug — `.deals-track` (and one level up, `.products-section`) had `flex: 1` + overflow without `min-width: 0`, so instead of the carousel scrolling internally, the *entire page* overflowed horizontally and pushed the category menu off-screen. Fixed by adding `min-width: 0` at both levels.
  2. `db.json` lost the two alt-photo `images` array entries after a cart-mutating request — because the running server process had a stale in-memory snapshot from before that edit (lowdb writes its full in-memory state back to disk on every mutation, silently reverting any direct file edits made after the server last started). Re-applied the fix and restarted the server as the final step once all `db.json` edits were finished, to avoid recurrence.
  3. The custom scrollbar initially appeared not to render at all in verification screenshots — turned out to be Playwright's headless Chromium hiding scrollbars by default (`--hide-scrollbars` launch flag), not a real bug. Confirmed working by relaunching with that flag disabled.
- Verified via a full Playwright pass: deals hide/show correctly per category filter, carousel scrolls via the styled scrollbar, product modal opens from both grid and carousel cards with correct gallery/specs/pricing, Add to Cart from the modal works, all confirmed in both light and dark mode with zero console errors.

### 2.6 Contact & Visit Us section + customer query feature
Requested: a bottom-of-page section with a Google Maps toggle/directions to the shop, the shop address, delivery-area coverage, phone number, a general query form ("ask about a product or the shop"), a product-specific query toggle inside the existing product popup, and social media links (Telegram/Instagram/Facebook) populated with sample content, added last.

- **Shop location**: resolved from a Google Maps link the user provided to coordinates `-1.119813, 37.003611` (Juja, Kiambu County, Kenya) — confirmed via `WebFetch` following the `maps.app.goo.gl` redirect, not guessed.
- **New footer section** (`index.html`, `#contact-section`): key-less Google Maps iframe embed (`google.com/maps?q=...&output=embed`, no API key/billing needed) with a show/hide toggle, a "Get Directions" link using Google's documented `maps/dir/?api=1&destination=...` URL scheme (opens the native Maps app on phones, Google Maps web on desktop), shop address, delivery-area list (Nairobi same/next-day; Thika, Nakuru, Kisumu, Mombasa, Eldoret 2–3 day courier; nationwide via courier), a `tel:` phone link, a general query form, and — last on the page, per instruction — social links plus a static "sample post" preview strip built from real product/deal images already in the catalogue (clearly labeled as samples, not a live feed).
- **Social handles are invented placeholders** (not live accounts, since creating real social media accounts isn't something I can do): Telegram `@FitiElectronicsKE`, Instagram `@fitielectronics.ke`, Facebook `Fiti Electronics Kenya`. Swap these for real accounts once registered.
- **Product-specific query toggle**: an "❓ Ask about this product" button was added *inside the existing product detail popup* (`#product-modal`, the same modal opened when a product card is clicked) — not a separate popup. Toggling it reveals an inline mini-form pre-tagged "Regarding: {product name}".
- **Backend** (`server/queriesRouter.js` + `server/queriesStore.js`, mirroring the payments router/store pattern exactly): `POST /api/queries` validates and persists to a new `queries` collection in `db.json`; the collection is blocked from json-server's generic public REST routes via the same 404-guard idiom used for `payments`, since it holds customer names/messages.
- **Demo-mode fallback**: same philosophy as checkout — if `/api/queries` is unreachable (e.g. static Netlify hosting with no backend), the query is queued in `localStorage` instead and the user still sees a success toast, so the form never appears broken on static hosting.
- New pure logic module `js/queries.js` (name/message validation, payload building) + `tests/queries.test.js` (7 tests, 36 total now).
- `sw.js`: cache bumped to `fiti-v4`; `js/queries.js` added to the offline app-shell list (and the pre-existing gap where `js/deals.js` was missing from that list was fixed at the same time).
- A "Contact" link was added to the header, scrolling to the new section (`html { scroll-behavior: smooth }`).
- Verified via a Playwright pass (headless Chromium, run manually — not committed to the project): map toggle, directions link href, general query submit (success toast + record landed in `db.json`'s `queries` array via the running dev server), product-modal ask-toggle with correct product context, social links/preview grid, light/dark mode, and mobile-width layout (single-column stacking) — zero new console errors introduced.

### 2.7 Verification performed throughout
- ESLint + full Vitest suite (29 tests as of now: 11 cart + 11 payments + 7 deals) re-run after every change and passing.
- Real browser verification via a headless-Chromium (Playwright) driver script for: full checkout flow (M-Pesa + card, demo fallback), dark/light mode, color palette changes, image background-removal results — plus the app opened live in the user's actual desktop browser several times for manual review.
- `db.json` test-artifact pollution (from automated browser runs adding items to cart) was cleaned up each time; **order id 6 in `db.json` is real user data from an actual manual checkout test and was deliberately preserved**, not test noise.

---

## Commit status

**Nothing in §2 has been committed or pushed.** Per explicit instruction, this branch is only to be committed/pushed once the user has confirmed everything works. All of the above exists only as uncommitted working-tree changes (see `git status` / `git diff --stat` for the exact file list) plus a few new untracked files: `.env.example`, `fonts/`, `js/deals.js`, `js/payments.js`, `server.js`, `server/`, `tests/deals.test.js`, `tests/payments.test.js`, and two sourced alt-photo images.
