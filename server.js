import http from 'node:http';
import { DatabaseSync } from 'node:sqlite';
import { randomBytes, scrypt, timingSafeEqual, createHash } from 'node:crypto';
import { promisify } from 'node:util';
import { mkdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const derive = promisify(scrypt);
const digest = value => createHash('sha256').update(value).digest('hex');
const sessionAge = 7 * 24 * 60 * 60;
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const mime = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.mp4': 'video/mp4' };
class HttpError extends Error { constructor(status, message) { super(message); this.status = status; } }
function field(body, key, min, max) {
  const value = body[key];
  if (typeof value !== 'string' || value.trim().length < min || value.length > max) throw new HttpError(400, `Invalid ${key}.`);
  return value.trim();
}
async function jsonBody(req) {
  if (!req.headers['content-type']?.startsWith('application/json')) throw new HttpError(415, 'Use application/json.');
  let text = '';
  for await (const chunk of req) {
    text += chunk.toString();
    if (Buffer.byteLength(text) > 16384) throw new HttpError(413, 'Request too large.');
  }
  try {
    const value = JSON.parse(text);
    if (!value || Array.isArray(value) || typeof value !== 'object') throw new Error();
    return value;
  } catch { throw new HttpError(400, 'Invalid JSON body.'); }
}

export function createApp({ dbPath = path.join(root, 'data', 'future-tech.sqlite'), origin = process.env.APP_ORIGIN, secureCookies = process.env.NODE_ENV === 'production' } = {}) {
  if (dbPath !== ':memory:') mkdirSync(path.dirname(dbPath), { recursive: true });
  const db = new DatabaseSync(dbPath);
  db.exec(`PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY, name TEXT NOT NULL, email TEXT UNIQUE NOT NULL, salt TEXT NOT NULL, password_hash TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id), expires INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS products (id INTEGER PRIMARY KEY, name TEXT NOT NULL, price_cents INTEGER NOT NULL CHECK(price_cents > 0), icon TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS orders (id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id), request_key TEXT NOT NULL, total_cents INTEGER NOT NULL, status TEXT NOT NULL DEFAULT 'pending_payment', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE(user_id, request_key));
    CREATE TABLE IF NOT EXISTS order_items (order_id INTEGER NOT NULL REFERENCES orders(id), product_id INTEGER NOT NULL REFERENCES products(id), name TEXT NOT NULL, price_cents INTEGER NOT NULL, quantity INTEGER NOT NULL CHECK(quantity BETWEEN 1 AND 20));
    CREATE TABLE IF NOT EXISTS messages (id INTEGER PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL, message TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
  `);
  const seed = db.prepare('INSERT OR IGNORE INTO products(id,name,price_cents,icon) VALUES(?,?,?,?)');
  [[1,'AI Starter Kit',4999,'🤖'],[2,'Cloud Storage 1TB',2999,'☁️'],[3,'Security Suite Pro',7999,'🔒'],[4,'Dev Workstation',19999,'💻']].forEach(p => seed.run(...p));
  const limits = new Map();
  function throttle(req, bucket, maximum) {
    const now = Date.now();
    // Trust the direct connection only, not client-supplied forwarding headers.
    for (const [key, value] of limits) if (value.until <= now) limits.delete(key);
    const key = `${bucket}:${req.socket.remoteAddress}`;
    const entry = limits.get(key) || { count: 0, until: now + 15 * 60 * 1000 };
    if (++entry.count > maximum) throw new HttpError(429, 'Too many attempts. Try again in 15 minutes.');
    limits.set(key, entry);
  }
  function token(req) { return /(?:^|;\s*)session=([a-f0-9]{64})(?:;|$)/.exec(req.headers.cookie || '')?.[1]; }
  function currentUser(req) {
    const value = token(req);
    return value ? db.prepare('SELECT u.id,u.name,u.email FROM users u JOIN sessions s ON s.user_id=u.id WHERE s.token_hash=? AND s.expires>?').get(digest(value), Date.now()) : undefined;
  }
  function requireUser(req) {
    const user = currentUser(req);
    if (!user) throw new HttpError(401, 'Please sign in first.');
    return user;
  }
  function sessionCookie(value, age) { return `session=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${age}${secureCookies ? '; Secure' : ''}`; }
  function openSession(req, res, userId) {
    const old = token(req);
    if (old) db.prepare('DELETE FROM sessions WHERE token_hash=?').run(digest(old));
    db.prepare('DELETE FROM sessions WHERE expires<=?').run(Date.now());
    const value = randomBytes(32).toString('hex');
    db.prepare('INSERT INTO sessions VALUES(?,?,?)').run(digest(value), userId, Date.now() + sessionAge * 1000);
    res.setHeader('Set-Cookie', sessionCookie(value, sessionAge));
  }
  function orderView(order) {
    return { ...order, items: db.prepare('SELECT product_id,name,price_cents,quantity FROM order_items WHERE order_id=?').all(order.id) };
  }
  function send(res, status, value) { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(value)); }
  const server = http.createServer(async (req, res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'same-origin');
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; media-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'");
    try {
      const url = new URL(req.url, 'http://localhost');
      const route = url.pathname;
      if (route.startsWith('/api/')) {
        res.setHeader('Cache-Control', 'no-store');
        if (req.method !== 'GET') {
          const expected = origin || `http://localhost:${server.address().port}`;
          if (req.headers.origin !== expected) throw new HttpError(403, 'Request origin is not allowed.');
          if (req.method !== 'POST') throw new HttpError(405, 'Method not allowed.');
        }
        if (route === '/api/products' && req.method === 'GET') return send(res, 200, { products: db.prepare('SELECT * FROM products ORDER BY id').all() });
        if (route === '/api/me' && req.method === 'GET') return send(res, 200, { user: currentUser(req) || null });
        if (route === '/api/register' && req.method === 'POST') {
          throttle(req, 'auth', 20);
          const body = await jsonBody(req);
          const name = field(body, 'name', 2, 80), email = field(body, 'email', 3, 254).toLowerCase();
          if (!emailPattern.test(email)) throw new HttpError(400, 'Enter a valid email.');
          const password = body.password;
          if (typeof password !== 'string' || password.length < 12 || password.length > 128) throw new HttpError(400, 'Password must contain 12–128 characters.');
          const salt = randomBytes(16).toString('hex');
          const hash = (await derive(password, salt, 64)).toString('hex');
          let result;
          try { result = db.prepare('INSERT INTO users(name,email,salt,password_hash) VALUES(?,?,?,?)').run(name,email,salt,hash); }
          catch (error) { if (error.message.includes('UNIQUE')) throw new HttpError(409, 'This email is already registered.'); throw error; }
          const user = { id: Number(result.lastInsertRowid), name, email };
          openSession(req, res, user.id);
          return send(res, 201, { user });
        }
        if (route === '/api/login' && req.method === 'POST') {
          throttle(req, 'auth', 20);
          const body = await jsonBody(req);
          const email = field(body, 'email', 3, 254).toLowerCase();
          if (typeof body.password !== 'string' || body.password.length > 128) throw new HttpError(400, 'Invalid password.');
          const user = db.prepare('SELECT * FROM users WHERE email=?').get(email);
          const hash = await derive(body.password, user?.salt || '00000000000000000000000000000000', 64);
          if (!user || !timingSafeEqual(hash, Buffer.from(user.password_hash, 'hex'))) throw new HttpError(401, 'Invalid email or password.');
          openSession(req, res, user.id);
          return send(res, 200, { user: { id: user.id, name: user.name, email: user.email } });
        }
        if (route === '/api/logout' && req.method === 'POST') {
          const value = token(req);
          if (value) db.prepare('DELETE FROM sessions WHERE token_hash=?').run(digest(value));
          res.setHeader('Set-Cookie', sessionCookie('', 0));
          return send(res, 200, { ok: true });
        }
        if (route === '/api/orders' && req.method === 'GET') {
          const user = requireUser(req);
          const orders = db.prepare('SELECT id,total_cents,status,created_at FROM orders WHERE user_id=? ORDER BY id DESC LIMIT 100').all(user.id);
          return send(res, 200, { orders: orders.map(orderView) });
        }
        if (route === '/api/orders' && req.method === 'POST') {
          const user = requireUser(req);
          throttle(req, 'orders', 60);
          const body = await jsonBody(req);
          const key = field(body, 'request_key', 16, 80);
          const existing = db.prepare('SELECT id,total_cents,status,created_at FROM orders WHERE user_id=? AND request_key=?').get(user.id,key);
          if (existing) return send(res, 200, { order: orderView(existing) });
          if (!Array.isArray(body.items) || body.items.length < 1 || body.items.length > 20) throw new HttpError(400, 'Cart must contain 1–20 products.');
          const seen = new Set();
          const items = body.items.map(item => {
            if (!item || !Number.isInteger(item.product_id) || !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 20 || seen.has(item.product_id)) throw new HttpError(400, 'Invalid cart item or quantity.');
            seen.add(item.product_id);
            const product = db.prepare('SELECT * FROM products WHERE id=?').get(item.product_id);
            if (!product) throw new HttpError(400, 'Product is unavailable.');
            return { ...product, quantity: item.quantity };
          });
          const total = items.reduce((sum,p) => sum + p.price_cents * p.quantity, 0);
          db.exec('BEGIN IMMEDIATE');
          let id;
          try {
            id = Number(db.prepare('INSERT INTO orders(user_id,request_key,total_cents) VALUES(?,?,?)').run(user.id,key,total).lastInsertRowid);
            const insert = db.prepare('INSERT INTO order_items VALUES(?,?,?,?,?)');
            for (const item of items) insert.run(id,item.id,item.name,item.price_cents,item.quantity);
            db.exec('COMMIT');
          } catch (error) { db.exec('ROLLBACK'); throw error; }
          return send(res, 201, { order: orderView(db.prepare('SELECT id,total_cents,status,created_at FROM orders WHERE id=?').get(id)) });
        }
        if (route === '/api/contact' && req.method === 'POST') {
          throttle(req, 'contact', 5);
          const body = await jsonBody(req);
          const name = field(body,'name',2,80), email = field(body,'email',3,254).toLowerCase(), message = field(body,'message',10,5000);
          if (!emailPattern.test(email)) throw new HttpError(400, 'Enter a valid email.');
          const result = db.prepare('INSERT INTO messages(name,email,message) VALUES(?,?,?)').run(name,email,message);
          return send(res, 201, { id: Number(result.lastInsertRowid), message: 'Your message has been saved. Thank you.' });
        }
        throw new HttpError(404, 'API endpoint not found.');
      }
      if (!['GET','HEAD'].includes(req.method)) throw new HttpError(405, 'Method not allowed.');
      const publicRoot = path.join(root, 'public');
      const requested = decodeURIComponent(route === '/' ? '/index.html' : route);
      const file = path.resolve(publicRoot, '.' + requested);
      if (!file.startsWith(publicRoot + path.sep) || !mime[path.extname(file)] || !existsSync(file) || !statSync(file).isFile()) throw new HttpError(404, 'Page not found.');
      res.writeHead(200, { 'Content-Type': mime[path.extname(file)] });
      res.end(req.method === 'HEAD' ? undefined : readFileSync(file));
    } catch (error) {
      if (!res.headersSent) send(res, error.status || 500, { error: error.status ? error.message : 'Something went wrong. Please try again.' });
      else res.end();
      if (!error.status) console.error(error);
    }
  });
  return { server, close: () => new Promise((resolve,reject) => server.close(error => { db.close(); error ? reject(error) : resolve(); })) };
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const app = createApp();
  const port = Number(process.env.PORT || 3000);
  app.server.listen(port, process.env.HOST || '127.0.0.1', () => console.log(`Future Tech running at http://localhost:${port}`));
}
