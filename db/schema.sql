CREATE TABLE IF NOT EXISTS products (
  id SERIAL PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  description TEXT NOT NULL,
  category VARCHAR(60) NOT NULL,
  price_cents INTEGER NOT NULL CHECK (price_cents >= 0),
  image_url TEXT NOT NULL,
  stock INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
  active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS orders (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  customer_name VARCHAR(100) NOT NULL,
  email VARCHAR(254) NOT NULL,
  shipping_address VARCHAR(300) NOT NULL,
  total_cents BIGINT NOT NULL CHECK (total_cents >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS order_items (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  order_id BIGINT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products(id),
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_price_cents INTEGER NOT NULL CHECK (unit_price_cents >= 0)
);

INSERT INTO products (name, description, category, price_cents, image_url, stock)
SELECT seed.name, seed.description, seed.category, seed.price_cents, seed.image_url, seed.stock
FROM (VALUES
  ('Everyday Carry Tote', 'A sturdy, thoughtfully sized canvas tote for market mornings and everyday errands.', 'Accessories', 3200, 'https://images.unsplash.com/photo-1590874103328-eac38a683ce7?auto=format&fit=crop&w=900&q=85', 24),
  ('Ceramic Pour-Over Set', 'A handmade stoneware dripper and matching cup for a slower, better coffee ritual.', 'Home', 5800, 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=900&q=85', 18),
  ('Weekend Linen Shirt', 'Relaxed-fit, breathable European linen with natural shell buttons.', 'Apparel', 7400, 'https://images.unsplash.com/photo-1598033129183-c4f50c736f10?auto=format&fit=crop&w=900&q=85', 12),
  ('Field Notes Journal', 'A pocket-sized recycled-paper notebook made for ideas, lists, and little sketches.', 'Stationery', 1800, 'https://images.unsplash.com/photo-1531346878377-a5be20888e57?auto=format&fit=crop&w=900&q=85', 40),
  ('Sculpted Glass Vase', 'A softly sculpted, clear glass vase that catches the afternoon light.', 'Home', 4600, 'https://images.unsplash.com/photo-1578500494198-246f612d3b3d?auto=format&fit=crop&w=900&q=85', 15),
  ('Daily Ritual Candle', 'A small-batch soy candle with notes of cedar, bergamot, and warm amber.', 'Home', 2800, 'https://images.unsplash.com/photo-1603006905003-be475563bc59?auto=format&fit=crop&w=900&q=85', 30)
) AS seed(name, description, category, price_cents, image_url, stock)
WHERE NOT EXISTS (SELECT 1 FROM products LIMIT 1);
