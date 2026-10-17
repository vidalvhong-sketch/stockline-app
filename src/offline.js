/* ---------------------------------------------------------------
   OFFLINE SUPPORT
   - A copy of the last loaded data (products, suppliers, movement log)
     is kept in IndexedDB so the app can open with no internet.
   - Sales, stock-ins, discards and scanner batches made while offline go
     into an "outbox" queue (also in IndexedDB, so it survives closing the
     browser or the phone restarting) and are sent to the server, oldest
     first, as soon as the connection is back.
   - Every movement gets its ID on the device. The server ignores an ID it
     has already saved, so a retry after a dropped connection can never
     record the same sale twice.
--------------------------------------------------------------- */
const DB_NAME = "stockline-offline";
const STORE = "kv";

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbGet(key) {
  try {
    const db = await openDb();
    return await new Promise((resolve, reject) => {
      const r = db.transaction(STORE, "readonly").objectStore(STORE).get(key);
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });
  } catch {
    return undefined;
  }
}

async function idbSet(key, value) {
  try {
    const db = await openDb();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put(value, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // Storage full or blocked (e.g. private browsing) — the app still
    // works online; it just can't open offline.
  }
}

/* ---- cached data ---- */
export const loadCachedState = () => idbGet("state");
export const saveCachedState = (state) => idbSet("state", { ...state, savedAt: new Date().toISOString() });

/* ---- outbox ---- */
// Writes are chained so two quick sales can't overwrite each other's queue.
let chain = Promise.resolve();
function withOutbox(fn) {
  chain = chain.then(async () => {
    const box = (await idbGet("outbox")) || [];
    const next = await fn(box);
    if (next) await idbSet("outbox", next);
    return next || box;
  });
  return chain;
}
export const getOutbox = async () => (await idbGet("outbox")) || [];
export const addToOutbox = (entry) => withOutbox((box) => [...box, entry]);
export const removeFromOutbox = (id) => withOutbox((box) => box.filter((e) => e.id !== id));

/* ---- entries the server refused when syncing ---- */
export const getSyncFailures = async () => (await idbGet("syncFailures")) || [];
export async function addSyncFailure(entry, error) {
  const list = await getSyncFailures();
  await idbSet("syncFailures", [...list, { ...entry, error, failedAt: new Date().toISOString() }]);
}
export const clearSyncFailures = () => idbSet("syncFailures", []);

export function newTxnId() {
  return `txn_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 9)}`;
}

/* Puts entries still waiting in the outbox on top of data from the server,
   so stock and the movement log already include them on screen. */
export function applyPending(state, outbox) {
  if (!outbox.length) return state;
  const known = new Set(state.transactions.map((t) => t.id));
  const pending = outbox.filter((e) => !known.has(e.id));
  const products = state.products.map((p) => {
    const delta = pending
      .filter((e) => e.productId === p.id)
      .reduce((s, e) => s + (e.type === "IN" ? e.qty : -e.qty), 0);
    return delta ? { ...p, stock: Math.round((p.stock + delta) * 1000) / 1000 } : p;
  });
  const transactions = [...state.transactions, ...pending.map(toLocalTxn)]
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  return { ...state, products, transactions };
}

/* What a queued entry looks like in the movement log before it's synced. */
export function toLocalTxn(e) {
  return {
    id: e.id, product_id: e.productId, type: e.type, qty: e.qty, staff: e.staff,
    supplier_id: e.type === "IN" ? e.supplierId || null : null,
    price: e.price, market_price: e.marketPrice ?? null,
    price_type: e.type === "OUT" ? e.priceType || "retail" : null,
    customer_name: e.customerName || null, timestamp: e.timestamp, pending: true,
  };
}
