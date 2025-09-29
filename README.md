# Fiti Electronics

A mini e-commerce web application for browsing and purchasing electronics.

## Features

- Browse products by categories (All, Computers, Laptops, Phones, TVs, Accessories)
- Search functionality for products
- Add products to shopping cart
- View cart with item count and total cost
- Simulated checkout process with order confirmation
- Responsive design for various screen sizes
- Persistent cart using JSON Server API

## Technologies Used

- **Frontend**: HTML5, CSS3, JavaScript (ES6+)
- **Backend**: JSON Server (mock REST API)
- **Data Storage**: JSON file for products, cart, and orders

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
   This starts the API server on `http://localhost:3000` with watch mode enabled.

   For production-like deployment (uses $PORT env var):
   ```bash
   npm start
   ```

2. Serve the frontend:
   - Option 1: Open `index.html` directly in your browser
   - Option 2: Start a local static server using Node.js (recommended):
     ```bash
     npm run serve
     ```
     This starts the server on `http://localhost:8080`.
   - Option 3: Using Python:
     ```bash
     python -m http.server 8080
     ```
     Then open `http://localhost:8080` in your browser.

3. Use the application:
   - Browse products using category filters
   - Search for specific products
   - Add items to cart
   - View and manage cart items
   - Proceed to checkout

## API Endpoints

The application uses JSON Server to provide RESTful API endpoints:

- `GET /products` - Retrieve all products
- `GET /cart` - Retrieve current cart items
- `POST /cart` - Add an item to the cart
- `DELETE /cart/:id` - Remove a specific item from the cart
- `GET /orders` - Retrieve order history
- `POST /orders` - Create a new order (checkout)

## Project Structure

```
fiti-electronics/
├── index.html          # Main HTML file
├── styles.css          # CSS styles
├── script.js           # JavaScript functionality
├── db.json             # JSON data (products, cart, orders)
├── package.json        # Node.js dependencies and scripts
├── images/             # Product images
├── README.md           # This file
└── LICENSE             # MIT License
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
