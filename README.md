# Future Tech — Full-stack portfolio project

A small full-stack application extending Abdelrahman's existing HTML/CSS/JavaScript website. The UI calls a Node.js HTTP API; SQLite stores accounts, sessions, products, orders and contact messages.

Original frontend: https://github.com/Abdelrahman5752/web-project

## Run locally

Requires Node.js 22.14 or newer with `node:sqlite`. There are no third-party runtime dependencies and no `npm install` step.

```sh
npm start
```

Open **http://localhost:3000**. Do not open the HTML files directly or serve them with a frontend-only live server: the API and session cookie need this backend. On Node 22, an experimental SQLite warning is expected.

Windows users can also double-click `Start-Local.cmd`, then open the URL shown in the terminal. Stop the server with Ctrl+C.

Create an account with a password of at least 12 characters, add a product, place an order, and open **My orders**. The contact form stores submissions in SQLite; it does not send email.

```sh
npm test
```

The integration suite uses an isolated temporary database, cleans it up, and does not modify your local application data.

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
server.js          HTTP routing, validation, authentication and SQLite storage
test/api.test.js   API integration and security regression scenarios
data/              Created on first run; private SQLite data (gitignored)
QA-REPORT.md       What was verified and the limits of that verification
LEARNING-AR.md     Arabic walkthrough
```

## API

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/products` | Public product catalog |
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
- `HOST`: default `127.0.0.1` (local access only).
- `APP_ORIGIN`: exact browser origin for writes; default `http://localhost:<actual-port>`.
- `NODE_ENV=production`: enables Secure cookies; requires HTTPS through the deployment setup.

For a reverse proxy, explicitly set the public HTTPS `APP_ORIGIN`; do not derive it from untrusted forwarded headers. Configure the host/network exposure deliberately. GitHub Pages cannot run this Node.js backend or store SQLite changes.

Database location is `data/future-tech.sqlite`. Keep the full data directory private. Stop the server before making a simple filesystem backup so the SQLite WAL is settled, or use a proper online SQLite backup tool. No demo accounts or customer data are bundled.
