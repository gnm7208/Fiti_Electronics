# TODO: Fix Cart Clearing on Checkout

## Steps to Complete
- [x] Edit script.js: Update clearCart() function to use individual DELETE /cart/:id for each item with Promise.all, instead of collection-level DELETE/PUT (which 404 in JSON Server).
- [x] Start JSON Server: Run `npm start` to serve the API on port 3000.
- [x] Start static server if needed: Ensure Python HTTP server on port 8080 for serving HTML/CSS/JS.
- [x] Launch browser: Open http://localhost:8080/index.html and verify products load via API.
- [x] Test add to cart: Click "Add to Cart" on a product, open cart sidebar, confirm item appears and count updates.
- [x] Test checkout: With items in cart, click "Checkout" button; verify modal shows, cart empties in sidebar, and local state updates.
- [x] Verify API changes: Use curl to check /cart is empty [] and /orders has a new entry with the purchased items.
- [x] Test edge cases: Attempt checkout with empty cart (should alert), reload page to confirm fetchCart() loads empty cart.
- [x] Update TODO.md: Mark steps as completed and note any issues.

## Progress Tracking
- Started: Current time
- Completed: To be updated
