# Fiti Electronics

A mini e-commerce web application for browsing and purchasing electronics.

## 🌍 Live Demo Links

- Netlify: [https://fiti.netlify.app]  
- Render: [https://fiti-electronics.onrender.com]

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

## Deployment

### Local Development
- Run `npm run dev` to start json-server serving API and static files on port 3000.
- Access at `http://localhost:3000/index.html`.

### Render Deployment
1. Connect your GitHub repo to Render.
2. Set **Build Command**: Empty (or `npm install`).
3. Set **Start Command**: `npm start`.
4. Environment: Node.
5. The app will be live at your Render URL (e.g., `https://your-app.onrender.com/index.html`).
   - Static files and API are served together via `--static .`.
   - Relative URLs ensure API calls work on the deployed domain.
   - db.json provides persistent data (updates on commits).

Note: Render free tier spins down after inactivity; upgrade for always-on.

## Recent Updates
- Added `--static .` to json-server scripts for serving frontend files.
- Changed API_BASE to relative URLs in script.js for deployment compatibility.
- Fixed cart clearing on checkout using individual DELETE requests.
- Thorough testing: Add/remove cart, checkout, search/filters, edge cases all work.


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
