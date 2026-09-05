// Charger House store backend.
// Products and orders are stored in Postgres (set DATABASE_URL in your
// environment — Render sets this automatically when you attach a Postgres
// database to this service).

const express = require('express');
const path = require('path');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 3000;

// Change this in your hosting provider's environment variables before going live.
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'changeme';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});

const SEED_PRODUCTS = [
  { name: 'Fast Charging Cable (Type-C)', image: '', retailPrice: 700, salePrice: 549, stock: 60 },
  { name: '20W PD Fast Charger Adapter', image: '', retailPrice: 1300, salePrice: 999, stock: 35 },
  { name: 'Wireless Earbuds Pro', image: '', retailPrice: 3800, salePrice: 2999, stock: 18 },
  { name: 'Tempered Glass Screen Protector', image: '', retailPrice: 350, salePrice: 249, stock: 120 },
  { name: 'Shockproof Phone Case', image: '', retailPrice: 900, salePrice: null, stock: 45 },
  { name: '10000mAh Power Bank', image: '', retailPrice: 2800, salePrice: 2299, stock: 22 }
];

async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS products (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      image TEXT DEFAULT '',
      retail_price NUMERIC NOT NULL,
      sale_price NUMERIC,
      stock INTEGER DEFAULT 0
    );
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS orders (
      id SERIAL PRIMARY KEY,
      items JSONB NOT NULL,
      customer JSONB NOT NULL,
      payment_method TEXT NOT NULL,
      status TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT now()
    );
  `);

  const { rows } = await pool.query('SELECT COUNT(*)::int AS count FROM products');
  if (rows[0].count === 0) {
    for (const p of SEED_PRODUCTS) {
      await pool.query(
        'INSERT INTO products (name, image, retail_price, sale_price, stock) VALUES ($1,$2,$3,$4,$5)',
        [p.name, p.image, p.retailPrice, p.salePrice, p.stock]
      );
    }
  }
}

function toProductJson(row) {
  return {
    id: String(row.id),
    name: row.name,
    image: row.image || '',
    retailPrice: Number(row.retail_price),
    salePrice: row.sale_price != null ? Number(row.sale_price) : null,
    stock: row.stock
  };
}

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

function requireAdmin(req, res, next) {
  const password = req.header('x-admin-password');
  if (password !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Incorrect admin password.' });
  }
  next();
}

// ---- Products (public read) ----

app.get('/api/products', async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM products ORDER BY id');
  res.json(rows.map(toProductJson));
});

// ---- Products (admin write) ----

app.post('/api/products', requireAdmin, async (req, res) => {
  const { name, image, retailPrice, salePrice, stock } = req.body;
  if (!name || retailPrice == null || retailPrice === '') {
    return res.status(400).json({ error: 'Name and retail price are required.' });
  }
  const { rows } = await pool.query(
    `INSERT INTO products (name, image, retail_price, sale_price, stock)
     VALUES ($1,$2,$3,$4,$5) RETURNING *`,
    [
      String(name),
      image || '',
      Number(retailPrice),
      salePrice !== undefined && salePrice !== '' ? Number(salePrice) : null,
      stock !== undefined && stock !== '' ? Number(stock) : 0
    ]
  );
  res.json(toProductJson(rows[0]));
});

app.put('/api/products/:id', requireAdmin, async (req, res) => {
  const { rows: existingRows } = await pool.query('SELECT * FROM products WHERE id = $1', [req.params.id]);
  if (!existingRows.length) return res.status(404).json({ error: 'Product not found.' });
  const existing = existingRows[0];

  const { name, image, retailPrice, salePrice, stock } = req.body;
  const updated = {
    name: name !== undefined ? String(name) : existing.name,
    image: image !== undefined ? image : existing.image,
    retail_price: retailPrice !== undefined && retailPrice !== '' ? Number(retailPrice) : existing.retail_price,
    sale_price: salePrice !== undefined ? (salePrice === '' ? null : Number(salePrice)) : existing.sale_price,
    stock: stock !== undefined && stock !== '' ? Number(stock) : existing.stock
  };

  const { rows } = await pool.query(
    `UPDATE products SET name=$1, image=$2, retail_price=$3, sale_price=$4, stock=$5
     WHERE id=$6 RETURNING *`,
    [updated.name, updated.image, updated.retail_price, updated.sale_price, updated.stock, req.params.id]
  );
  res.json(toProductJson(rows[0]));
});

app.delete('/api/products/:id', requireAdmin, async (req, res) => {
  await pool.query('DELETE FROM products WHERE id = $1', [req.params.id]);
  res.json({ ok: true });
});

// ---- Orders ----

app.post('/api/orders', async (req, res) => {
  const { items, customer, paymentMethod } = req.body;
  if (!items || !items.length) {
    return res.status(400).json({ error: 'Cart is empty.' });
  }
  if (!customer || !customer.name || !customer.phone || !customer.address) {
    return res.status(400).json({ error: 'Name, phone, and address are required.' });
  }

  const method = paymentMethod === 'online' ? 'online' : 'cod';
  const status = method === 'online' ? 'awaiting_payment' : 'pending';

  const { rows } = await pool.query(
    `INSERT INTO orders (items, customer, payment_method, status)
     VALUES ($1,$2,$3,$4) RETURNING *`,
    [JSON.stringify(items), JSON.stringify(customer), method, status]
  );

  const order = rows[0];
  res.json({
    ok: true,
    order: {
      id: String(order.id),
      items: order.items,
      customer: order.customer,
      paymentMethod: order.payment_method,
      status: order.status,
      createdAt: order.created_at
    }
  });
});

app.get('/api/orders', requireAdmin, async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM orders ORDER BY id DESC');
  res.json(rows.map((o) => ({
    id: String(o.id),
    items: o.items,
    customer: o.customer,
    paymentMethod: o.payment_method,
    status: o.status,
    createdAt: o.created_at
  })));
});

initDb()
  .then(() => {
    app.listen(PORT, () => console.log(`Charger House running on port ${PORT}`));
  })
  .catch((err) => {
    console.error('Failed to initialize database:', err);
    process.exit(1);
  });
