import test from 'node:test';
import assert from 'node:assert/strict';
import { createNetlifyHandler } from '../netlify-adapter.js';
import { createApp } from '../server.js';

test('Netlify event adapter: routing, cookies, protected checkout and failed configuration',async()=>{
  let app,initializations=0;
  const origin='https://future-tech-example.netlify.app';
  const handler=createNetlifyHandler({
    env:{URL:origin,DATABASE_URL:'test-adapter-only'},
    appFactory:async options=>{
      initializations++;
      assert.equal(options.origin,origin); assert.equal(options.secureCookies,true);
      app=await createApp({dbPath:':memory:',databaseUrl:'',secureCookies:false,origin});
      return app;
    }
  });
  async function request(path,body,cookie='',requestOrigin=origin) {
    const response=await handler({path,httpMethod:body===undefined?'GET':'POST',headers:{origin:requestOrigin,cookie,'content-type':'application/json'},body:body===undefined?null:JSON.stringify(body),isBase64Encoded:false,queryStringParameters:{},requestContext:{identity:{sourceIp:'127.0.0.1'}}},{});
    return {...response,data:response.statusCode===404?null:JSON.parse(response.body)};
  }
  try {
    assert.equal((await request('/api/health')).statusCode,200);
    assert.equal((await request('/.netlify/functions/api/products')).data.products.length,4);
    const account=await request('/api/register',{name:'Netlify User',email:'netlify@example.test',password:'Netlify-demo-password-2026'});
    assert.equal(account.statusCode,201);
    const cookie=(account.multiValueHeaders['set-cookie']?.[0] || account.headers['set-cookie']).split(';')[0];
    assert.equal((await request('/api/me',undefined,cookie)).data.user.name,'Netlify User');
    assert.equal((await request('/api/orders',undefined)).statusCode,401);
    const payload={request_key:'netlify-order-example-001',items:[{product_id:1,quantity:1}]};
    assert.equal((await request('/api/orders',payload,cookie,'https://evil.example')).statusCode,403);
    assert.equal((await request('/.netlify/functions/api/orders',payload,cookie)).data.order.total_cents,4999);
    assert.equal((await request('/api/orders',undefined,cookie)).data.orders.length,1);
    assert.equal((await request('/server.js')).statusCode,404);
    assert.equal(initializations,1);
  } finally { if(app) await app.close(); }
});

test('Netlify initialization failure can recover and never exposes secrets',async()=>{
  const env={URL:'https://example.netlify.app'};
  let app;
  const handler=createNetlifyHandler({env,appFactory:async()=>{
    app=await createApp({dbPath:':memory:',databaseUrl:'',secureCookies:false,origin:env.URL}); return app;
  }});
  const event={path:'/api/health',httpMethod:'GET',headers:{},body:null,requestContext:{identity:{sourceIp:'127.0.0.1'}}};
  assert.equal((await handler(event,{})).statusCode,503);
  env.DATABASE_URL='test-placeholder';
  try {assert.equal((await handler(event,{})).statusCode,200);} finally {if(app) await app.close();}
});
