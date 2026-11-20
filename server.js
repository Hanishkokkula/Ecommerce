const express = require("express");
const path = require("path");
const { Pool } = require("pg");

const app = express();
const port = Number(process.env.PORT) || 3000;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: Number(process.env.PGPOOL_MAX) || 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
  ...(process.env.DATABASE_URL
    ? {}
    : {
        host: process.env.PGHOST || "localhost",
        port: Number(process.env.PGPORT) || 5432,
        database: process.env.PGDATABASE || "northstar_market",
        user: process.env.PGUSER || "postgres",
        password: process.env.PGPASSWORD,
      }),
});

pool.on("error", (error) => {
  console.error("Unexpected idle PostgreSQL client error:", error);
});

app.use(express.json({ limit: "20kb" }));
app.use(express.static(path.join(__dirname, "public")));

app.get("/api/products", async (_request, response, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, name, description, category, price_cents, image_url, stock
       FROM products
       WHERE active = TRUE
       ORDER BY id`
    );
    response.json(rows);
  } catch (error) {
    next(error);
  }
});

app.post("/api/orders", async (request, response, next) => {
  const { customerName, email, address, items } = request.body || {};
  const normalizedName =
    typeof customerName === "string" ? customerName.trim() : "";
  const normalizedEmail = typeof email === "string" ? email.trim() : "";
  const normalizedAddress =
    typeof address === "string" ? address.trim() : "";

  if (
    normalizedName.length < 2 ||
    normalizedName.length > 100 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail) ||
    normalizedEmail.length > 254 ||
    normalizedAddress.length < 5 ||
    normalizedAddress.length > 300 ||
    !Array.isArray(items) ||
    items.length === 0 ||
    items.length > 50
  ) {
    return response.status(400).json({ error: "Please check your checkout details." });
  }

  const quantities = new Map();
  for (const item of items) {
    if (
      !item ||
      !Number.isSafeInteger(item.productId) ||
      item.productId < 1 ||
      !Number.isSafeInteger(item.quantity) ||
      item.quantity < 1 ||
      item.quantity > 99
    ) {
      return response.status(400).json({ error: "Your cart contains an invalid item." });
    }
    quantities.set(
      item.productId,
      (quantities.get(item.productId) || 0) + item.quantity
    );
  }

  if ([...quantities.values()].some((quantity) => quantity > 99)) {
    return response.status(400).json({ error: "Please reduce the quantity of an item." });
  }

  let client;
  try {
    client = await pool.connect();
    await client.query("BEGIN");
    const ids = [...quantities.keys()].sort((a, b) => a - b);
    const { rows: products } = await client.query(
      `SELECT id, name, price_cents, stock
       FROM products
       WHERE id = ANY($1::int[]) AND active = TRUE
       ORDER BY id
       FOR UPDATE`,
      [ids]
    );

    if (products.length !== ids.length) {
      await client.query("ROLLBACK");
      return response.status(400).json({ error: "A product in your cart is no longer available." });
    }

    for (const product of products) {
      if (product.stock < quantities.get(product.id)) {
        await client.query("ROLLBACK");
        return response.status(409).json({
          error: `${product.name} does not have enough stock. Please update your cart.`,
        });
      }
    }

    const totalCents = products.reduce(
      (total, product) =>
        total + product.price_cents * quantities.get(product.id),
      0
    );
    const { rows: [order] } = await client.query(
      `INSERT INTO orders (customer_name, email, shipping_address, total_cents)
       VALUES ($1, $2, $3, $4)
       RETURNING id, total_cents`,
      [normalizedName, normalizedEmail, normalizedAddress, totalCents]
    );

    for (const product of products) {
      const quantity = quantities.get(product.id);
      await client.query(
        `INSERT INTO order_items (order_id, product_id, quantity, unit_price_cents)
         VALUES ($1, $2, $3, $4)`,
        [order.id, product.id, quantity, product.price_cents]
      );
      await client.query(
        "UPDATE products SET stock = stock - $1 WHERE id = $2",
        [quantity, product.id]
      );
    }

    await client.query("COMMIT");
    response.status(201).json({
      orderId: order.id,
      totalCents: order.total_cents,
    });
  } catch (error) {
    if (client) {
      await client.query("ROLLBACK").catch((rollbackError) => {
        console.error("Could not roll back failed order:", rollbackError);
      });
    }
    next(error);
  } finally {
    if (client) client.release();
  }
});

app.use((error, _request, response, _next) => {
  console.error("Request failed:", error);
  if (error.type === "entity.parse.failed") {
    return response.status(400).json({ error: "Invalid JSON request." });
  }
  response.status(500).json({ error: "Something went wrong. Please try again." });
});

const server = app.listen(port, () => {
  console.log(`Northstar Market is running at http://localhost:${port}`);
});

async function shutdown() {
  server.close(async () => {
    await pool.end();
    process.exit(0);
  });
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
