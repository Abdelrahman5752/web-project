# Verification record

## Hosting update — PostgreSQL support

The updated suite passes 19 test nodes: 11 SQLite scenario subtests, 5 PostgreSQL scenario subtests, their 2 parents, and 1 production configuration test.

PostgreSQL scenarios run against a real local PostgreSQL WASM engine (PGlite) through a pg-compatible test adapter. They verify schema initialization, secure cookies, account uniqueness/isolation, server prices, concurrent checkout retry handling, rollback without partial orders, contact storage, and persistence across application restart. Production is tested to refuse local storage when DATABASE_URL is absent.

These checks do **not** verify Neon network connectivity, TLS negotiation through the pg driver, Render deployment, free-plan availability, or any user account configuration. Those require the real deployment. The tests below describe the original SQLite suite and browser walkthrough.

## Automated API regression

Executed with Node.js v22.14.0 and `node --test` on the delivered implementation.

Result: **11 scenario subtests passed**; Node reports 12 passing test nodes including the enclosing parent. No failures.

1. Public file boundaries and product loading.
2. Cross-origin rejection and invalid registration validation.
3. Registration, password hashing and HttpOnly/SameSite session cookies.
4. Wrong password rejection and login session rotation.
5. Authentication requirements and invalid/duplicate cart item rejection.
6. Database prices override submitted prices; retry does not duplicate orders.
7. Order isolation between two users.
8. Contact validation and actual database persistence.
9. Order/session persistence across server restart.
10. Logout revokes the session.
11. Authentication rate limiting.

## Browser verification

Executed locally with headless Microsoft Edge via Playwright, against an isolated in-memory database:

- Register a user through the form.
- Load products, add an item, place an order and verify the displayed order total.
- Open order history, log out, log in again.
- Submit the contact form and verify the saved-message response.
- Check page widths at 390px on all eight HTML pages: no horizontal overflow.
- No uncaught browser JavaScript errors during that journey.
- Visually inspected desktop order history and the mobile home page captures.

## Limits

This was local functional verification, not a penetration test, load test, full accessibility audit or multi-browser certification. No actual payment, email delivery or public deployment was tested; those features are not implemented. Screenshots from browser tests use synthetic test accounts and orders.
