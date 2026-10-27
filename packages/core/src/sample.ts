/**
 * Sample SQLite Database Schema and Seed Data.
 * Used for demonstrations, browser fallback mode, and quick testing.
 */

export const SAMPLE_STORE_SQL = `
CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  description TEXT
);

CREATE TABLE IF NOT EXISTS customers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  country TEXT DEFAULT 'US',
  balance REAL DEFAULT 0.0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  category_id INTEGER,
  sku TEXT UNIQUE,
  price REAL NOT NULL,
  stock_qty INTEGER DEFAULT 0,
  FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_products_cat ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);

CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id INTEGER NOT NULL,
  order_date DATETIME DEFAULT CURRENT_TIMESTAMP,
  total_amount REAL NOT NULL,
  status TEXT CHECK(status IN ('pending', 'completed', 'shipped', 'cancelled')) DEFAULT 'pending',
  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS order_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL,
  product_id INTEGER NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price REAL NOT NULL,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT
);

CREATE VIEW IF NOT EXISTS customer_order_summary AS
SELECT 
  c.id AS customer_id,
  c.name AS customer_name,
  c.email,
  COUNT(o.id) AS total_orders,
  COALESCE(SUM(o.total_amount), 0.0) AS lifetime_spent
FROM customers c
LEFT JOIN orders o ON c.id = o.customer_id
GROUP BY c.id;

CREATE TRIGGER IF NOT EXISTS update_customer_balance AFTER INSERT ON orders
BEGIN
  UPDATE customers SET balance = balance + NEW.total_amount WHERE id = NEW.customer_id;
END;

INSERT OR IGNORE INTO categories (id, name, description) VALUES
  (1, 'Electronics', 'Smartphones, laptops, and consumer gadgets'),
  (2, 'Office Supplies', 'Ergonomic chairs, desks, stationery'),
  (3, 'Audio', 'Noise-canceling headphones, monitors, microphones');

INSERT OR IGNORE INTO customers (id, name, email, country, balance) VALUES
  (1, 'Sarah Jenkins', 'sarah.j@example.com', 'US', 249.50),
  (2, 'Alexandre Dumas', 'alex.dumas@france.fr', 'FR', 0.00),
  (3, 'Kenji Takahashi', 'kenji.t@tokyo.jp', 'JP', 1250.75),
  (4, 'Elena Rostova', 'elena.rostova@berlin.de', 'DE', 89.20),
  (5, 'Carlos Mendez', 'carlos.m@buenosaires.ar', 'AR', 415.00);

INSERT OR IGNORE INTO products (id, name, category_id, sku, price, stock_qty) VALUES
  (1, 'Mechanical Keyboard (Cherry Brown)', 1, 'KB-MECH-BR', 129.99, 45),
  (2, 'Ultra-wide 34" Curved Monitor', 1, 'MON-34-UW', 599.00, 18),
  (3, 'Studio Reference Headphones', 3, 'AUD-REF-80', 189.50, 32),
  (4, 'Standing Desk Converter', 2, 'DSK-CONV-01', 220.00, 12),
  (5, 'USB-C 10-in-1 Hub', 1, 'HUB-USBC-10', 49.99, 120);

INSERT OR IGNORE INTO orders (id, customer_id, total_amount, status) VALUES
  (1, 1, 129.99, 'completed'),
  (2, 1, 119.51, 'shipped'),
  (3, 3, 1250.75, 'pending'),
  (4, 5, 415.00, 'completed');

INSERT OR IGNORE INTO order_items (id, order_id, product_id, quantity, unit_price) VALUES
  (1, 1, 1, 1, 129.99),
  (2, 2, 5, 2, 49.99),
  (3, 3, 2, 2, 599.00),
  (4, 4, 4, 1, 220.00),
  (5, 4, 3, 1, 189.50);
`;
