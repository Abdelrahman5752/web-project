import http from 'node:http';
import { openDatabase } from './database.js';
import { randomBytes, scrypt, timingSafeEqual, createHash } from 'node:crypto';
import { promisify } from 'node:util';
import { readFileSync, existsSync, statSync } from 'node:fs';
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
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 16384) throw new HttpError(413, 'Request too large.');
    chunks.push(chunk);
  }
  try {
    const value = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if (!value || Array.isArray(value) || typeof value !== 'object') throw new Error();
    return value;
  } catch { throw new HttpError(400, 'Invalid JSON body.'); }
}

export async function createApp({ dbPath = path.join(root, 'data', 'future-tech.sqlite'), databaseUrl = process.env.DATABASE_URL, postgresClient, origin = process.env.APP_ORIGIN || process.env.RENDER_EXTERNAL_URL, secureCookies = process.env.NODE_ENV === 'production' } = {}) {
  if (secureCookies && !databaseUrl && !postgresClient) throw new Error('Production requires DATABASE_URL. Local SQLite storage is not persistent on free hosting.');
  const db = await openDatabase({dbPath,databaseUrl,postgresClient});
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
  async function currentUser(req) {
    const value = token(req);
    return value ? await db.prepare('SELECT u.id,u.name,u.email FROM users u JOIN sessions s ON s.user_id=u.id WHERE s.token_hash=? AND s.expires>?').get(digest(value), Date.now()) : undefined;
  }
  async function requireUser(req) {
    const user = await currentUser(req);
    if (!user) throw new HttpError(401, 'Please sign in first.');
    return user;
  }
  function sessionCookie(value, age) { return `session=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${age}${secureCookies ? '; Secure' : ''}`; }
  async function openSession(req, res, userId) {
    const old = token(req);
    if (old) await db.prepare('DELETE FROM sessions WHERE token_hash=?').run(digest(old));
    await db.prepare('DELETE FROM sessions WHERE expires<=?').run(Date.now());
    const value = randomBytes(32).toString('hex');
    await db.prepare('INSERT INTO sessions VALUES(?,?,?)').run(digest(value), userId, Date.now() + sessionAge * 1000);
    res.setHeader('Set-Cookie', sessionCookie(value, sessionAge));
  }
  async function orderView(order) {
    return { ...order, items: await db.prepare('SELECT product_id,name,price_cents,quantity FROM order_items WHERE order_id=?').all(order.id) };
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
        if (route === '/api/health' && req.method === 'GET') { await db.prepare('SELECT 1 AS ok').get(); return send(res,200,{ok:true}); }
        if (route === '/api/products' && req.method === 'GET') return send(res, 200, { products: await db.prepare('SELECT * FROM products ORDER BY id').all() });
        if (route === '/api/me' && req.method === 'GET') return send(res, 200, { user: (await currentUser(req)) || null });
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
          try { result = await db.prepare('INSERT INTO users(name,email,salt,password_hash) VALUES(?,?,?,?)').run(name,email,salt,hash); }
          catch (error) { if ((error.code === '23505' || error.message.includes('UNIQUE'))) throw new HttpError(409, 'This email is already registered.'); throw error; }
          const user = { id: Number(result.lastInsertRowid), name, email };
          await openSession(req, res, user.id);
          return send(res, 201, { user });
        }
        if (route === '/api/login' && req.method === 'POST') {
          throttle(req, 'auth', 20);
          const body = await jsonBody(req);
          const email = field(body, 'email', 3, 254).toLowerCase();
          if (typeof body.password !== 'string' || body.password.length > 128) throw new HttpError(400, 'Invalid password.');
          const user = await db.prepare('SELECT * FROM users WHERE email=?').get(email);
          const hash = await derive(body.password, user?.salt || '00000000000000000000000000000000', 64);
          if (!user || !timingSafeEqual(hash, Buffer.from(user.password_hash, 'hex'))) throw new HttpError(401, 'Invalid email or password.');
          await openSession(req, res, user.id);
          return send(res, 200, { user: { id: user.id, name: user.name, email: user.email } });
        }
        if (route === '/api/logout' && req.method === 'POST') {
          const value = token(req);
          if (value) await db.prepare('DELETE FROM sessions WHERE token_hash=?').run(digest(value));
          res.setHeader('Set-Cookie', sessionCookie('', 0));
          return send(res, 200, { ok: true });
        }
        if (route === '/api/orders' && req.method === 'GET') {
          const user = await requireUser(req);
          const orders = await db.prepare('SELECT id,total_cents,status,created_at FROM orders WHERE user_id=? ORDER BY id DESC LIMIT 100').all(user.id);
          return send(res, 200, { orders: await Promise.all(orders.map(orderView)) });
        }
        if (route === '/api/orders' && req.method === 'POST') {
          const user = await requireUser(req);
          throttle(req, 'orders', 60);
          const body = await jsonBody(req);
          const key = field(body, 'request_key', 16, 80);
          const existing = await db.prepare('SELECT id,total_cents,status,created_at FROM orders WHERE user_id=? AND request_key=?').get(user.id,key);
          if (existing) return send(res, 200, { order: await orderView(existing) });
          if (!Array.isArray(body.items) || body.items.length < 1 || body.items.length > 20) throw new HttpError(400, 'Cart must contain 1–20 products.');
          const seen = new Set();
          const items = await Promise.all(body.items.map(async item => {
            if (!item || !Number.isInteger(item.product_id) || !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 20 || seen.has(item.product_id)) throw new HttpError(400, 'Invalid cart item or quantity.');
            seen.add(item.product_id);
            const product = await db.prepare('SELECT * FROM products WHERE id=?').get(item.product_id);
            if (!product) throw new HttpError(400, 'Product is unavailable.');
            return { ...product, quantity: item.quantity };
          }));
          const total = items.reduce((sum,p) => sum + p.price_cents * p.quantity, 0);
          const saved = await db.transaction(async tx => {
            const inserted = await tx.prepare('INSERT INTO orders(user_id,request_key,total_cents) VALUES(?,?,?) ON CONFLICT(user_id,request_key) DO NOTHING').run(user.id,key,total);
            if (!inserted.lastInsertRowid) {
              const existing = await tx.prepare('SELECT id FROM orders WHERE user_id=? AND request_key=?').get(user.id,key);
              return {id:existing.id,created:false};
            }
            const id = Number(inserted.lastInsertRowid);
            const insert = tx.prepare('INSERT INTO order_items VALUES(?,?,?,?,?)');
            for (const item of items) await insert.run(id,item.id,item.name,item.price_cents,item.quantity);
            return {id,created:true};
          });
          return send(res, saved.created ? 201 : 200, { order: await orderView(await db.prepare('SELECT id,total_cents,status,created_at FROM orders WHERE id=?').get(saved.id)) });
        }
        if (route === '/api/contact' && req.method === 'POST') {
          throttle(req, 'contact', 5);
          const body = await jsonBody(req);
          const name = field(body,'name',2,80), email = field(body,'email',3,254).toLowerCase(), message = field(body,'message',10,5000);
          if (!emailPattern.test(email)) throw new HttpError(400, 'Enter a valid email.');
          const result = await db.prepare('INSERT INTO messages(name,email,message) VALUES(?,?,?)').run(name,email,message);
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
      if (!error.status) console.error('Request failed:', error.code || error.name); // Never log credentials or request bodies.
    }
  });
  return { server, close: () => new Promise((resolve,reject) => server.close(async error => { try { await db.close(); error ? reject(error) : resolve(); } catch (failure) { reject(failure); } })) };
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const app = await createApp();
    const port = Number(process.env.PORT || 3000);
    const host = process.env.HOST || (process.env.NODE_ENV === 'production' ? '0.0.0.0' : '127.0.0.1');
    app.server.on('error', async error => {
      console.error(error.code === 'EADDRINUSE' ? 'This port is already in use. Stop the previous server or choose another PORT.' : 'Unable to start server.');
      try { await app.close(); } catch { /* listen failed before the server started */ }
      process.exitCode = 1;
    });
    app.server.listen(port, host, () => console.log('Future Tech running at ' + (process.env.APP_ORIGIN || process.env.RENDER_EXTERNAL_URL || 'http://localhost:' + port)));
    for (const signal of ['SIGTERM','SIGINT']) process.once(signal, () => app.close().then(() => process.exit(0)));
  } catch {
    console.error('Database initialization failed. Check DATABASE_URL, network access and database availability.');
    process.exitCode = 1;
  }
}
