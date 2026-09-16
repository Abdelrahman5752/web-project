import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { createApp } from '../server.js';

test('authentication, protected orders, validation and persistence', async t => {
  const directory = mkdtempSync(path.join(tmpdir(),'future-tech-test-'));
  const dbPath = path.join(directory,'test.sqlite');
  let app = await createApp({ dbPath, databaseUrl: '', secureCookies: false, origin: '' });
  await new Promise(resolve => app.server.listen(0,'127.0.0.1',resolve));
  let port = app.server.address().port;
  async function request(route, body, cookie = '', customHeaders = {}) {
    const response = await fetch(`http://127.0.0.1:${port}${route}`, {
      method: body === undefined ? 'GET' : 'POST',
      headers: { 'Content-Type':'application/json', Origin:`http://localhost:${port}`, Cookie:cookie, ...customHeaders },
      body: body === undefined ? undefined : JSON.stringify(body)
    });
    const type = response.headers.get('content-type') || '';
    return { status:response.status, cookie:response.headers.get('set-cookie')?.split(';')[0], headers:response.headers, data:type.includes('json') ? await response.json() : await response.text() };
  }
  try {
    const password = 'correct horse battery staple';
    let alice, bob, orderId;
    await t.test('serves only public files and returns products', async () => {
      assert.equal((await request('/')).status,200);
      assert.equal((await request('/server.js')).status,404);
      assert.equal((await request('/data/test.sqlite')).status,404);
      assert.equal((await request('/api/products')).data.products.length,4);
      assert.equal((await request('/api/me')).data.user,null);
    });
    await t.test('rejects cross-origin writes and invalid accounts', async () => {
      assert.equal((await request('/api/register',{},'',{Origin:'https://evil.example'})).status,403);
      assert.equal((await request('/api/register',{name:'Alice',email:'alice@example.test',password:'short'})).status,400);
      assert.equal((await request('/api/register',{name:'Alice',email:'not-an-email',password})).status,400);
    });
    await t.test('registers hashed credentials and starts HttpOnly sessions', async () => {
      const registered = await request('/api/register',{name:'Alice',email:'ALICE@example.test',password});
      assert.equal(registered.status,201); alice = registered.cookie;
      assert.match(registered.headers.get('set-cookie'),/HttpOnly/);
      assert.match(registered.headers.get('set-cookie'),/SameSite=Lax/);
      assert.equal(registered.data.user.email,'alice@example.test');
      assert.equal((await request('/api/me',undefined,alice)).data.user.name,'Alice');
      assert.equal((await request('/api/register',{name:'Alice',email:'alice@example.test',password})).status,409);
      const db = new DatabaseSync(dbPath);
      const user = db.prepare('SELECT * FROM users').get();
      assert.notEqual(user.password_hash,password); assert.equal(user.password_hash.length,128);
      assert.notEqual(db.prepare('SELECT token_hash FROM sessions').get().token_hash,alice.slice(8));
      db.close();
    });
    await t.test('rejects wrong credentials; login rotates session', async () => {
      assert.equal((await request('/api/login',{email:'alice@example.test',password:'incorrect'})).status,401);
      const old = alice;
      const result = await request('/api/login',{email:'alice@example.test',password},alice);
      assert.equal(result.status,200); alice = result.cookie;
      assert.equal((await request('/api/me',undefined,old)).data.user,null);
    });
    await t.test('requires authentication and validates cart', async () => {
      assert.equal((await request('/api/orders')).status,401);
      assert.equal((await request('/api/orders',{request_key:'order-example-001',items:[]})).status,401);
      for (const items of [[],[{product_id:1,quantity:-1}],[{product_id:999,quantity:1}],[{product_id:1,quantity:1},{product_id:1,quantity:1}]]) {
        assert.equal((await request('/api/orders',{request_key:'order-example-001',items},alice)).status,400);
      }
    });
    await t.test('server prices win and retries create only one order', async () => {
      const payload = {request_key:'order-example-001',total_cents:1,items:[{product_id:1,quantity:2,price_cents:1}]};
      const result = await request('/api/orders',payload,alice);
      assert.equal(result.status,201); orderId = result.data.order.id;
      assert.equal(result.data.order.total_cents,9998);
      assert.equal(result.data.order.status,'pending_payment');
      const retry = await request('/api/orders',payload,alice);
      assert.equal(retry.status,200); assert.equal(retry.data.order.id,orderId);
      assert.equal((await request('/api/orders',undefined,alice)).data.orders.length,1);
    });
    await t.test('a second account cannot see the first account orders', async () => {
      bob = (await request('/api/register',{name:'Bob',email:'bob@example.test',password})).cookie;
      assert.deepEqual((await request('/api/orders',undefined,bob)).data.orders,[]);
    });
    await t.test('contact is validated and actually stored', async () => {
      assert.equal((await request('/api/contact',{name:'Alice',email:'alice@example.test',message:'tiny'})).status,400);
      assert.equal((await request('/api/contact',{name:'Alice',email:'alice@example.test',message:'Please explain the demo products.'})).status,201);
      const db = new DatabaseSync(dbPath);
      assert.equal(db.prepare('SELECT count(*) AS n FROM messages').get().n,1); db.close();
    });
    await t.test('data and active sessions survive restart', async () => {
      await app.close(); app = await createApp({dbPath, databaseUrl: '', secureCookies: false, origin: ''});
      await new Promise(resolve => app.server.listen(0,'127.0.0.1',resolve)); port = app.server.address().port;
      assert.equal((await request('/api/orders',undefined,alice)).data.orders[0].id,orderId);
    });
    await t.test('logout invalidates server session', async () => {
      assert.equal((await request('/api/logout',{},alice)).status,200);
      assert.equal((await request('/api/orders',undefined,alice)).status,401);
    });
    await t.test('repeated authentication attempts are throttled', async () => {
      let last;
      for(let i=0;i<21;i++) last = await request('/api/login',{email:'missing@example.test',password:'incorrect'});
      assert.equal(last.status,429);
    });
  } finally { await app.close(); rmSync(directory,{recursive:true,force:true}); }
});

