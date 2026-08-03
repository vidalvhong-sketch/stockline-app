# STOCKLINE

Inventory control app — product in/out logging, suppliers, categories, prices,
daily/weekly/yearly monitoring, and a barcode lookup to stop or reactivate a
product. Built as a small Node/Express + SQLite app so your whole team can use
it from one shared database, not just one browser.

## How agents get in

Every agent has their own account — a name and a PIN — with one of two roles:

- **Admin** — everything a user can do, plus: add products, add suppliers,
  stop/reactivate products, and manage the team from the Agents tab.
- **User** — views the dashboard, products, suppliers, and barcode lookup,
  and logs stock in / stock out. Can't add products or suppliers, stop
  products, or manage other agents.

On first run the app creates one default admin account: name `Admin`, PIN
from `DEFAULT_ADMIN_PIN` in your `.env` (defaults to `1234` if unset — change
this before sharing the app with anyone). Sign in as Admin, then use the
**Agents** tab to add real accounts for your team and remove the default one
if you like.

## Run it locally

Requires Node.js 18+.

```bash
npm install
cp .env.example .env
```

Open `.env` and set:
- `DEFAULT_ADMIN_PIN` — the PIN for the one-time default `Admin` account
- `JWT_SECRET` — any long random string (keeps login sessions secure)

Then build the frontend and start the server:

```bash
npm run build
npm start
```

Visit `http://localhost:8787`. The database file `stockline.db` is created
automatically on first run, seeded with a few sample products so it's not
empty.

### Developing (auto-reload frontend)

In one terminal: `npm run dev:server`
In another: `npm run dev:client` (opens on port 5173, proxies `/api` to 8787)

## Deploying to Railway

1. Push this folder to a GitHub repo.
2. In Railway: **New Project → Deploy from GitHub repo**, select it.
3. Railway auto-detects Node. Set these environment variables in the
   Railway dashboard (Settings → Variables):
   - `DEFAULT_ADMIN_PIN` — PIN for the initial `Admin` account
   - `JWT_SECRET` — a long random string
   - `PORT` — Railway sets this automatically, no need to add it
4. Set the build command to `npm run build` and the start command to
   `npm start` (Railway usually picks these up from `package.json`
   automatically).
5. Once deployed, Railway gives you a public URL — share that with your
   agents along with the access code.

**Note on the database:** SQLite is a single file (`stockline.db`) written to
disk. Railway's default filesystem is ephemeral on redeploys, so for
production use add a **Railway Volume** mounted at the app's working
directory (Settings → Volumes) so `stockline.db` persists across deploys.
Without a volume, the app still works fine day-to-day — the data just won't
survive a fresh deploy.

## Project structure

```
server.js          Express API + SQLite (products, suppliers, transactions)
src/App.jsx         React frontend (dashboard, products, suppliers, movement log, barcode control)
src/api.js           Frontend fetch helper + session storage
vite.config.js       Build config — bundles src/ into dist/, which server.js serves
```

## API summary

All routes except `/api/auth/login` require `Authorization: Bearer <token>`.
Routes marked **admin** also require the signed-in agent to have the admin role.

| Method | Route | Purpose |
|---|---|---|
| POST | `/api/auth/login` | `{ name, pin }` → `{ token, name, role }` |
| GET | `/api/state` | Full snapshot: products, suppliers, transactions |
| GET | `/api/agents` | List agents — **admin** |
| POST | `/api/agents` | Add an agent `{ name, pin, role }` — **admin** |
| PATCH | `/api/agents/:id/reset-pin` | Reset an agent's PIN — **admin** |
| DELETE | `/api/agents/:id` | Remove an agent — **admin** |
| POST | `/api/products` | Add a product — **admin** |
| PATCH | `/api/products/:id/toggle` | Stop / reactivate a product — **admin** |
| POST | `/api/suppliers` | Add a supplier — **admin** |
| POST | `/api/transactions` | Log stock in or stock out (updates product stock) — any signed-in agent |
