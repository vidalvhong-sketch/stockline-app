import "dotenv/config";
import express from "express";
import cors from "cors";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import { fileURLToPath } from "url";
import jwt from "jsonwebtoken";
import Database from "better-sqlite3";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 8787;
const JWT_SECRET = process.env.JWT_SECRET || "stockline-dev-secret-change-me";
const DEFAULT_ADMIN_PIN = process.env.DEFAULT_ADMIN_PIN || "1234";

/* ---------------- PIN hashing (scrypt, no extra dependency) ---------------- */
function hashPin(pin) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(String(pin), salt, 64).toString("hex");
  return `${salt}:${hash}`;
}
function verifyPin(pin, stored) {
  const [salt, hash] = (stored || "").split(":");
  if (!salt || !hash) return false;
  const check = crypto.scryptSync(String(pin), salt, 64).toString("hex");
  const a = Buffer.from(hash, "hex");
  const b = Buffer.from(check, "hex");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/* ---------------- DB setup ---------------- */
const DB_PATH = process.env.DATABASE_PATH || path.join(__dirname, "stockline.db");
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
const db = new Database(DB_PATH);
// DELETE (not WAL) journal mode: every commit writes straight into the main
// .db file. WAL mode defers writes into a separate .db-wal file that only
// gets folded back in on a clean checkpoint/close — on platforms like
// Railway that SIGTERM the container on redeploy, that checkpoint may never
// happen, silently losing data. DELETE mode trades a little write throughput
// (irrelevant at this app's scale) for writes that are durable immediately.
db.pragma("journal_mode = DELETE");
db.pragma("synchronous = FULL");

// Belt-and-suspenders: close the DB cleanly on shutdown signals too.
function shutdown() {
  try { db.close(); } catch {}
  process.exit(0);
}
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

db.exec(`
CREATE TABLE IF NOT EXISTS agents (
  id TEXT PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  pin_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user',
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS suppliers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  contact TEXT,
  phone TEXT
);
CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  barcode TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  purchase_price REAL NOT NULL DEFAULT 0,
  retail_price REAL NOT NULL DEFAULT 0,
  market_price REAL,
  stock INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active',
  unit TEXT NOT NULL DEFAULT 'pcs'
);
CREATE TABLE IF NOT EXISTS transactions (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL,
  type TEXT NOT NULL,
  qty INTEGER NOT NULL,
  staff TEXT NOT NULL,
  supplier_id TEXT,
  price REAL NOT NULL DEFAULT 0,
  timestamp TEXT NOT NULL
);
`);

// Migration: add `unit` to databases created before this column existed
const productCols = db.prepare("PRAGMA table_info(products)").all().map((c) => c.name);
if (!productCols.includes("unit")) {
  db.exec("ALTER TABLE products ADD COLUMN unit TEXT NOT NULL DEFAULT 'pcs'");
  console.log("Migrated products table: added unit column.");
}

// Migration: split the old single `price` column into purchase/retail/market pricing
const hadLegacyPrice = productCols.includes("price");
const hadPricingColumns = productCols.includes("purchase_price");
if (!productCols.includes("purchase_price")) db.exec("ALTER TABLE products ADD COLUMN purchase_price REAL NOT NULL DEFAULT 0");
if (!productCols.includes("retail_price")) db.exec("ALTER TABLE products ADD COLUMN retail_price REAL NOT NULL DEFAULT 0");
if (!productCols.includes("market_price")) db.exec("ALTER TABLE products ADD COLUMN market_price REAL");
if (hadLegacyPrice && !hadPricingColumns) {
  db.exec("UPDATE products SET purchase_price = price, retail_price = price WHERE purchase_price = 0 AND retail_price = 0");
  console.log("Migrated products table: split price into purchase_price / retail_price / market_price.");
}

function genId(prefix) {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}
function genBarcode() {
  let code = "";
  for (let i = 0; i < 12; i++) code += Math.floor(Math.random() * 10);
  return code;
}

// Seed the default admin account on first run
const agentCount = db.prepare("SELECT COUNT(*) AS c FROM agents").get().c;
if (agentCount === 0) {
  db.prepare("INSERT INTO agents (id, name, pin_hash, role, created_at) VALUES (?,?,?,?,?)")
    .run(genId("agt"), "Admin", hashPin(DEFAULT_ADMIN_PIN), "admin", new Date().toISOString());
  console.log(`Created default admin account \u2014 name "Admin", PIN "${DEFAULT_ADMIN_PIN}". Sign in and add your team from the Agents tab.`);
}

// Seed sample inventory data on first run only
const productCount = db.prepare("SELECT COUNT(*) AS c FROM products").get().c;
if (productCount === 0) {
  const supStmt = db.prepare("INSERT INTO suppliers (id, name, contact, phone) VALUES (?,?,?,?)");
  const sup1 = genId("sup"), sup2 = genId("sup");
  supStmt.run(sup1, "Metro Paper Trading", "Ana Reyes", "0917 555 0142");
  supStmt.run(sup2, "Sunrise Electronics Supply", "Ben Cruz", "0918 555 0231");

  const prodStmt = db.prepare("INSERT INTO products (id, barcode, name, category, purchase_price, retail_price, market_price, stock, status, unit) VALUES (?,?,?,?,?,?,?,?,?,?)");
  const p1 = genId("prd"), p2 = genId("prd"), p3 = genId("prd"), p4 = genId("prd");
  prodStmt.run(p1, genBarcode(), "A4 Bond Paper", "Office Supplies", 180, 220, 240, 140, "active", "ream");
  prodStmt.run(p2, genBarcode(), "USB Headset", "Electronics", 650, 850, 950, 32, "active", "pcs");
  prodStmt.run(p3, genBarcode(), "Ballpoint Pen", "Office Supplies", 70, 95, 110, 4, "active", "box");
  prodStmt.run(p4, genBarcode(), "Rice", "Groceries", 1500, 1800, 1900, 0, "stopped", "sack");

  const txnStmt = db.prepare("INSERT INTO transactions (id, product_id, type, qty, staff, supplier_id, price, timestamp) VALUES (?,?,?,?,?,?,?,?)");
  const now = Date.now();
  txnStmt.run(genId("txn"), p1, "IN", 100, "Vhong", sup1, 220, new Date(now - 6 * 86400000).toISOString());
  txnStmt.run(genId("txn"), p1, "OUT", 20, "Mika", null, 220, new Date(now - 4 * 86400000).toISOString());
  txnStmt.run(genId("txn"), p2, "IN", 40, "Vhong", sup2, 850, new Date(now - 3 * 86400000).toISOString());
  txnStmt.run(genId("txn"), p2, "OUT", 8, "Jae", null, 850, new Date(now - 1 * 86400000).toISOString());
  txnStmt.run(genId("txn"), p3, "OUT", 6, "Mika", null, 95, new Date(now - 8 * 3600000).toISOString());
  console.log("Seeded starter data.");
}

/* ---------------- App setup ---------------- */
const app = express();
app.use(cors());
app.use(express.json());

function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: "Not authenticated" });
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    // confirm the account still exists (in case an admin removed it since the token was issued)
    const agent = db.prepare("SELECT id, name, role FROM agents WHERE id = ?").get(payload.id);
    if (!agent) return res.status(401).json({ error: "Account no longer exists, log in again" });
    req.agent = agent;
    next();
  } catch {
    return res.status(401).json({ error: "Session expired, log in again" });
  }
}

function requireAdmin(req, res, next) {
  if (req.agent.role !== "admin") return res.status(403).json({ error: "Admins only" });
  next();
}

/* ---------------- Auth ---------------- */
app.post("/api/auth/login", (req, res) => {
  const { name, pin } = req.body || {};
  if (!name || !name.trim()) return res.status(400).json({ error: "Enter your name" });
  if (!pin) return res.status(400).json({ error: "Enter your PIN" });
  const agent = db.prepare("SELECT * FROM agents WHERE LOWER(name) = LOWER(?)").get(name.trim());
  if (!agent || !verifyPin(pin, agent.pin_hash)) {
    return res.status(401).json({ error: "Name or PIN is incorrect" });
  }
  const token = jwt.sign({ id: agent.id }, JWT_SECRET, { expiresIn: "30d" });
  res.json({ token, name: agent.name, role: agent.role });
});

/* ---------------- State (initial load) ---------------- */
app.get("/api/state", requireAuth, (req, res) => {
  const products = db.prepare("SELECT * FROM products ORDER BY name").all();
  const suppliers = db.prepare("SELECT * FROM suppliers ORDER BY name").all();
  const transactions = db.prepare("SELECT * FROM transactions ORDER BY timestamp DESC").all();
  res.json({ products, suppliers, transactions, agent: req.agent.name, role: req.agent.role });
});

/* ---------------- Agents (admin only) ---------------- */
app.get("/api/agents", requireAuth, requireAdmin, (req, res) => {
  res.json(db.prepare("SELECT id, name, role, created_at FROM agents ORDER BY created_at").all());
});

app.post("/api/agents", requireAuth, requireAdmin, (req, res) => {
  const { name, pin, role } = req.body || {};
  if (!name || !name.trim()) return res.status(400).json({ error: "Name is required" });
  if (!pin || String(pin).length < 4) return res.status(400).json({ error: "PIN must be at least 4 digits" });
  if (!["admin", "user"].includes(role)) return res.status(400).json({ error: "Role must be admin or user" });
  const id = genId("agt");
  try {
    db.prepare("INSERT INTO agents (id, name, pin_hash, role, created_at) VALUES (?,?,?,?,?)")
      .run(id, name.trim(), hashPin(pin), role, new Date().toISOString());
  } catch {
    return res.status(400).json({ error: "That name is already taken" });
  }
  res.json(db.prepare("SELECT id, name, role, created_at FROM agents WHERE id = ?").get(id));
});

app.patch("/api/agents/:id/reset-pin", requireAuth, requireAdmin, (req, res) => {
  const { pin } = req.body || {};
  if (!pin || String(pin).length < 4) return res.status(400).json({ error: "PIN must be at least 4 digits" });
  const agent = db.prepare("SELECT * FROM agents WHERE id = ?").get(req.params.id);
  if (!agent) return res.status(404).json({ error: "Agent not found" });
  db.prepare("UPDATE agents SET pin_hash = ? WHERE id = ?").run(hashPin(pin), agent.id);
  res.json({ ok: true });
});

app.delete("/api/agents/:id", requireAuth, requireAdmin, (req, res) => {
  const agent = db.prepare("SELECT * FROM agents WHERE id = ?").get(req.params.id);
  if (!agent) return res.status(404).json({ error: "Agent not found" });
  if (agent.id === req.agent.id) return res.status(400).json({ error: "You can't remove your own account" });
  if (agent.role === "admin") {
    const adminCount = db.prepare("SELECT COUNT(*) AS c FROM agents WHERE role = 'admin'").get().c;
    if (adminCount <= 1) return res.status(400).json({ error: "At least one admin account must remain" });
  }
  db.prepare("DELETE FROM agents WHERE id = ?").run(agent.id);
  res.json({ ok: true });
});

/* ---------------- Suppliers ---------------- */
app.post("/api/suppliers", requireAuth, requireAdmin, (req, res) => {
  const { name, contact, phone } = req.body || {};
  if (!name) return res.status(400).json({ error: "Supplier name is required" });
  const id = genId("sup");
  db.prepare("INSERT INTO suppliers (id, name, contact, phone) VALUES (?,?,?,?)").run(id, name, contact || "", phone || "");
  res.json(db.prepare("SELECT * FROM suppliers WHERE id = ?").get(id));
});

/* ---------------- Products ---------------- */
app.post("/api/products", requireAuth, requireAdmin, (req, res) => {
  const { name, category, stock, barcode, unit, purchasePrice, retailPrice, marketPrice } = req.body || {};
  if (!name || !category || purchasePrice === undefined || retailPrice === undefined) {
    return res.status(400).json({ error: "Name, category, purchase price, and retail price are required" });
  }
  const id = genId("prd");
  const code = (barcode && barcode.trim()) || genBarcode();
  const hasMarket = marketPrice !== undefined && marketPrice !== null && String(marketPrice).trim() !== "";
  try {
    db.prepare("INSERT INTO products (id, barcode, name, category, purchase_price, retail_price, market_price, stock, status, unit) VALUES (?,?,?,?,?,?,?,?,?,?)")
      .run(id, code, name, category, Number(purchasePrice), Number(retailPrice), hasMarket ? Number(marketPrice) : null, Number(stock) || 0, "active", (unit && unit.trim()) || "pcs");
  } catch (e) {
    return res.status(400).json({ error: "That barcode is already in use" });
  }
  res.json(db.prepare("SELECT * FROM products WHERE id = ?").get(id));
});

app.patch("/api/products/:id/toggle", requireAuth, requireAdmin, (req, res) => {
  const product = db.prepare("SELECT * FROM products WHERE id = ?").get(req.params.id);
  if (!product) return res.status(404).json({ error: "Product not found" });
  const next = product.status === "active" ? "stopped" : "active";
  db.prepare("UPDATE products SET status = ? WHERE id = ?").run(next, product.id);
  res.json(db.prepare("SELECT * FROM products WHERE id = ?").get(product.id));
});

/* ---------------- Transactions (product in / out) ---------------- */
app.post("/api/transactions", requireAuth, (req, res) => {
  const { productId, type, qty, staff, supplierId, price, timestamp } = req.body || {};
  if (!productId || !type || !qty || !staff) return res.status(400).json({ error: "Product, quantity, and staff name are required" });
  const product = db.prepare("SELECT * FROM products WHERE id = ?").get(productId);
  if (!product) return res.status(404).json({ error: "Product not found" });
  const quantity = Number(qty);
  if (type === "OUT" && quantity > product.stock) {
    return res.status(400).json({ error: `Not enough stock \u2014 only ${product.stock} left` });
  }
  const id = genId("txn");
  const ts = timestamp ? new Date(timestamp).toISOString() : new Date().toISOString();
  const unitPrice = price !== undefined && price !== "" ? Number(price) : (type === "IN" ? product.purchase_price : product.retail_price);
  db.prepare("INSERT INTO transactions (id, product_id, type, qty, staff, supplier_id, price, timestamp) VALUES (?,?,?,?,?,?,?,?)")
    .run(id, productId, type, quantity, staff, type === "IN" ? (supplierId || null) : null, unitPrice, ts);
  const newStock = type === "IN" ? product.stock + quantity : product.stock - quantity;
  db.prepare("UPDATE products SET stock = ? WHERE id = ?").run(newStock, productId);
  res.json({
    transaction: db.prepare("SELECT * FROM transactions WHERE id = ?").get(id),
    product: db.prepare("SELECT * FROM products WHERE id = ?").get(productId),
  });
});

/* ---------------- Static frontend ---------------- */
app.use(express.static(path.join(__dirname, "dist")));
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "dist", "index.html"));
});

app.listen(PORT, () => {
  console.log(`STOCKLINE server running on port ${PORT}`);
});
