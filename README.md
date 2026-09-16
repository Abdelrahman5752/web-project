# Future Tech — Full-stack portfolio project

A small full-stack application extending Abdelrahman's existing HTML/CSS/JavaScript website. The UI calls a Node.js HTTP API; SQLite stores data locally, while PostgreSQL (Neon) stores hosted data when `DATABASE_URL` is set.

**Free hosting instructions:** [Netlify + Neon walkthrough in Arabic](NETLIFY-AR.md). Netlify serves the public pages and runs the API as a function. Configure the Neon connection URL privately in Netlify; never commit it. Hosting setup and live Neon connectivity must be verified in your accounts. The older [Render walkthrough](DEPLOY-AR.md) remains available as an alternative; Render may require card verification.

Original frontend: https://github.com/Abdelrahman5752/web-project

## Run locally

Requires Node.js 22.14 or newer within Node 22. Install dependencies once after downloading or updating:

```sh
npm ci
```

The `pg` package handles hosted PostgreSQL. Local mode still uses Node's built-in SQLite.

```sh
npm start
```

Open **http://localhost:3000**. Do not open the HTML files directly or serve them with a frontend-only live server: the API and session cookie need this backend. On Node 22, an experimental SQLite warning is expected.

Windows users can also double-click `Start-Local.cmd`, then open the URL shown in the terminal. Stop the server with Ctrl+C.

Create an account with a password of at least 12 characters, add a product, place an order, and open **My orders**. The contact form stores submissions in SQLite; it does not send email.

```sh
npm test
```

The integration suite uses isolated temporary SQLite and PGlite (local PostgreSQL) databases. It does not need or connect to Neon. Run tests in a local development environment with DATABASE_URL and NODE_ENV unset, not against a live database.

## Included behavior

- Registration and login, normalized unique email addresses, random per-user salts and scrypt password hashes.
- Opaque server-side sessions: hashed tokens in SQLite, HttpOnly/SameSite cookies, expiry, logout and rotation at login.
- Product catalog loaded from the API. The server calculates totals using database prices in integer cents.
- Cart retained within the browser tab, without storing passwords or session tokens in browser storage.
- Authenticated order creation, order line snapshots, transactions and per-user order history.
- Idempotency key reuse for checkout retries after a lost response.
- Contact message persistence with server-side validation.
- Same-origin validation for writes, parameterized SQL, request size bounds and basic per-IP rate limits.
- Public-file isolation: the server and database are not exposed by the static file handler.
- Narrow-screen layout adjustments and user-facing errors/loading states.

## Scope

This is a portfolio/demo store, with illustrative products inherited from the original frontend. Orders remain `pending_payment`. There is no payment gateway, product provisioning, shipping, email delivery, password reset, email verification or admin dashboard. It does not claim successful payment or fulfillment. Contact submissions are available in the local database, not through a public listing endpoint.

The demo is not a completed production commerce system. Before public use, configure HTTPS, backups, email verification/recovery, operational monitoring, distributed rate limiting where appropriate, and any actual payment/fulfillment requirements. Existing inline UI handlers require `unsafe-inline` in the content-security policy; a stricter policy requires migrating those handlers. The basic in-memory rate limits reset when the process restarts and are scoped to the direct connection IP.

## Structure

```text
public/            Browser pages, styles, scripts and original images
  script.js        Existing visual interactions
  app.js           API-backed accounts, product rendering, cart, orders, contact
  orders.html      Signed-in user's saved orders
server.js          HTTP routing, validation and authentication
database.js        SQLite/PostgreSQL storage adapters and schema
test/api.test.js   API integration and security regression scenarios
test/postgres.test.js PostgreSQL, transaction and hosting configuration checks
render.yaml        Free Render deployment configuration
data/              Created on first run; private SQLite data (gitignored)
QA-REPORT.md       What was verified and the limits of that verification
LEARNING-AR.md     Arabic walkthrough
```

## API

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/products` | Public product catalog |
| GET | `/api/health` | Database health check |
| POST | `/api/register` | Create account and session: name, email, password |
| POST | `/api/login` | Create session: email, password |
| GET | `/api/me` | Current public user data or null |
| POST | `/api/logout` | Revoke current session |
| GET | `/api/orders` | Current user's latest 100 orders |
| POST | `/api/orders` | Save order: request_key, items[{product_id, quantity}] |
| POST | `/api/contact` | Save message: name, email, message |

Write requests require `Origin: http://localhost:3000` locally and JSON content type. Cookie authentication is used; no API keys or JWTs are needed. Cross-origin requests are intentionally unsupported. Configure `APP_ORIGIN` to your exact trusted origin if changing the address.

## Configuration

- `PORT`: default `3000`.
- `HOST`: default `127.0.0.1` locally, `0.0.0.0` in production.
- `DATABASE_URL`: hosted PostgreSQL connection string. Required in production; absent locally means SQLite.
- `APP_ORIGIN`: exact browser origin for writes; falls back to Render's `RENDER_EXTERNAL_URL`, then `http://localhost:<actual-port>` locally.
- `NODE_ENV=production`: enables Secure cookies; requires HTTPS and DATABASE_URL, refusing ephemeral local storage.

For a reverse proxy, explicitly set the public HTTPS `APP_ORIGIN`; do not derive it from untrusted forwarded headers. Configure the host/network exposure deliberately. GitHub Pages cannot run this Node.js backend or store SQLite changes.

Local database location is `data/future-tech.sqlite`. Keep the full data directory private. Stop the server before making a simple filesystem backup so the SQLite WAL is settled, or use a proper online SQLite backup tool. No demo accounts or customer data are bundled. Local records are not automatically migrated to Neon. Database changes on the hosted service persist in Neon independently of Render's filesystem.
