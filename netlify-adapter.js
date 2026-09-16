import serverless from 'serverless-http';
import { createApp } from './server.js';

export function createNetlifyHandler({ appFactory = createApp, env = process.env } = {}) {
  let ready;
  return async (event, context = {}) => {
    context.callbackWaitsForEmptyEventLoop = false;
    try {
      // Reuse the connection pool in a warm function; retry initialization after failures.
      if (!ready) ready = (async () => {
        const origin = env.APP_ORIGIN || env.URL;
        if (!env.DATABASE_URL || !origin || new URL(origin).protocol !== 'https:') throw new Error('Missing hosting configuration');
        const app = await appFactory({databaseUrl:env.DATABASE_URL, origin:new URL(origin).origin, secureCookies:true});
        return serverless(app.server);
      })().catch(error => { ready = undefined; throw error; });
      const handle = await ready;
      // Netlify can supply either the original rewrite path or the function path.
      const pathname = (event.path || '/').replace(/^\/\.netlify\/functions\/api(?=\/|$)/, '/api');
      if (!pathname.startsWith('/api/')) return {statusCode:404,body:'Not found'};
      return await handle({...event,path:pathname},context);
    } catch {
      console.error('API unavailable. Check the private DATABASE_URL and site URL configuration.');
      return {statusCode:503,headers:{'Content-Type':'application/json','Cache-Control':'no-store'},body:JSON.stringify({error:'The service is temporarily unavailable. Please try again shortly.'})};
    }
  };
}
