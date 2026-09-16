import test from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { createApp } from '../server.js';
import { openDatabase } from '../database.js';

// Real PostgreSQL engine in WASM; no live Neon account or secrets needed.
// This adapter mirrors pg's query/connect/release API and serializes PGlite's one connection.
async function makePool() {
  const engine = new PGlite();
  await engine.waitReady;
  let queue = Promise.resolve();
  async function acquire() {
    const previous = queue;
    let release;
    queue = new Promise(resolve => { release = resolve; });
    await previous;
    return release;
  }
  async function query(sql, params) {
    if (params === undefined && sql.includes(';')) {
      const results = await engine.exec(sql); return results.at(-1);
    }
    return engine.query(sql,params);
  }
  return {
    async query(sql,params) { const release=await acquire(); try {return await query(sql,params);} finally {release();} },
    async connect() { const release=await acquire(); return {query,release}; },
    async end() {},
    destroy: () => engine.close()
  };
}

test('PostgreSQL backend with a real local PGlite engine', async t => {
  const pool=await makePool();
  let app=await createApp({postgresClient:pool,secureCookies:true,origin:'https://future-tech.example'});
  await new Promise(r=>app.server.listen(0,'127.0.0.1',r));
  let port=app.server.address().port;
  async function request(route,body,cookie='',origin='https://future-tech.example') {
    const res=await fetch(`http://127.0.0.1:${port}/api/${route}`,{
      method:body===undefined?'GET':'POST',
      headers:{'Content-Type':'application/json',Origin:origin,Cookie:cookie},
      body:body===undefined?undefined:JSON.stringify(body)
    });
    return {status:res.status,data:await res.json(),cookie:res.headers.get('set-cookie')?.split(';')[0],headers:res.headers};
  }
  let alice;
  const password='Postgres-demo-password-2026';
  try {
    await t.test('initializes schema, seed and health; secure registration',async()=>{
      assert.equal((await request('health')).status,200);
      assert.equal((await request('products')).data.products.length,4);
      assert.equal((await request('register',{name:'Alice',email:'alice@example.test',password},'','https://evil.example')).status,403);
      const result=await request('register',{name:'Alice',email:'alice@example.test',password});
      assert.equal(result.status,201); alice=result.cookie;
      assert.match(result.headers.get('set-cookie'),/; Secure/);
      assert.equal((await request('register',{name:'Alice',email:'alice@example.test',password})).status,409);
      assert.equal((await request('me',undefined,alice)).data.user.name,'Alice');
    });
    await t.test('concurrent same-key requests save one order with server prices',async()=>{
      const payload={request_key:'postgres-concurrent-key-001',items:[{product_id:2,quantity:2,price_cents:1}]};
      const results=await Promise.all([request('orders',payload,alice),request('orders',payload,alice)]);
      assert.deepEqual(results.map(r=>r.status).sort(),[200,201]);
      assert.equal(results[0].data.order.id,results[1].data.order.id);
      assert.equal(results[0].data.order.total_cents,5998);
      assert.equal((await request('orders',undefined,alice)).data.orders.length,1);
    });
    await t.test('account isolation, invalid cart, login and contact persistence',async()=>{
      const bob=(await request('register',{name:'Bob',email:'bob@example.test',password})).cookie;
      assert.deepEqual((await request('orders',undefined,bob)).data.orders,[]);
      assert.equal((await request('orders',{request_key:'postgres-invalid-cart',items:[{product_id:999,quantity:1}]},alice)).status,400);
      assert.equal((await request('login',{email:'alice@example.test',password:'wrong'})).status,401);
      const login=await request('login',{email:'alice@example.test',password},alice);
      assert.equal(login.status,200); alice=login.cookie;
      assert.equal((await request('contact',{name:'Alice',email:'alice@example.test',message:'Message stored in PostgreSQL.'})).status,201);
      assert.equal((await pool.query('SELECT COUNT(*)::int AS n FROM messages')).rows[0].n,1);
    });
    await t.test('transaction rollback does not leave a partial order',async()=>{
      const db=await openDatabase({postgresClient:pool});
      await assert.rejects(db.transaction(async tx=>{
        const result=await tx.prepare('INSERT INTO orders(user_id,request_key,total_cents) VALUES(?,?,?)').run(1,'rollback-example-001',4999);
        await tx.prepare('INSERT INTO order_items VALUES(?,?,?,?,?)').run(result.lastInsertRowid,999,'Missing',4999,1);
      }));
      assert.equal((await pool.query("SELECT COUNT(*)::int AS n FROM orders WHERE request_key='rollback-example-001'")).rows[0].n,0);
    });
    await t.test('application restart preserves PostgreSQL orders and sessions',async()=>{
      await app.close();
      app=await createApp({postgresClient:pool,secureCookies:true,origin:'https://future-tech.example'});
      await new Promise(r=>app.server.listen(0,'127.0.0.1',r)); port=app.server.address().port;
      assert.equal((await request('products')).data.products.length,4);
      assert.equal((await request('orders',undefined,alice)).data.orders.length,1);
      assert.equal((await request('logout',{},alice)).status,200);
      assert.equal((await request('orders',undefined,alice)).status,401);
    });
  } finally { await app.close(); await pool.destroy(); }
});

test('production refuses ephemeral local storage when DATABASE_URL is missing',async()=>{
  await assert.rejects(createApp({secureCookies:true,databaseUrl:'',dbPath:':memory:'}),/Production requires DATABASE_URL/);
});
