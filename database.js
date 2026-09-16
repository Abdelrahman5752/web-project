import { mkdirSync } from 'node:fs';
import path from 'node:path';

// All SQL is authored here/on the server; request values are bound parameters.
function postgresSql(sql) {
  let index = 0;
  return sql.replace(/\?/g, () => `$${++index}`);
}
function statements(query) {
  return {
    prepare(sql) {
      return {
        get: async (...params) => (await query(sql, params)).rows[0],
        all: async (...params) => (await query(sql, params)).rows,
        run: async (...params) => {
          const returning = /^INSERT INTO (users|orders|messages)\b/i.test(sql) && !/RETURNING/i.test(sql);
          const result = await query(sql + (returning ? ' RETURNING id' : ''), params);
          return { lastInsertRowid: result.rows[0]?.id, changes: result.rowCount };
        }
      };
    }
  };
}

export async function openDatabase({ dbPath, databaseUrl, postgresClient } = {}) {
  const postgres = !!databaseUrl || !!postgresClient;
  let database;
  if (postgres) {
    let pool = postgresClient;
    if (!pool) {
      const { Pool } = await import('pg');
      // Use verified TLS, including for Neon URLs containing sslmode=require.
      const url = new URL(databaseUrl);
      const tls = url.hostname.endsWith('.neon.tech') || url.searchParams.get('sslmode') !== 'disable';
      ['sslmode','sslcert','sslkey','sslrootcert'].forEach(key => url.searchParams.delete(key));
      pool = new Pool({ connectionString: url.toString(), ssl: tls ? { rejectUnauthorized: true } : false, max: 5, connectionTimeoutMillis: 15000, idleTimeoutMillis: 30000 });
      pool.on('error', () => console.error('Database connection interrupted. A new connection will be attempted.'));
    }
    database = {
      ...statements((sql, params) => pool.query(postgresSql(sql),params)),
      exec: sql => pool.query(sql),
      async transaction(work) {
        const client = await pool.connect();
        try {
          await client.query('BEGIN');
          const result = await work(statements((sql, params) => client.query(postgresSql(sql),params)));
          await client.query('COMMIT');
          return result;
        } catch (error) { await client.query('ROLLBACK'); throw error; }
        finally { client.release(); }
      },
      close: () => pool.end()
    };
  } else {
    const { DatabaseSync } = await import('node:sqlite');
    if (dbPath !== ':memory:') mkdirSync(path.dirname(dbPath), { recursive: true });
    const sqlite = new DatabaseSync(dbPath);
    sqlite.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;');
    // Serialize local transactions and ordinary queries on the shared SQLite connection.
    let tail = Promise.resolve();
    function exclusive(work) {
      const result = tail.then(work);
      tail = result.catch(() => {});
      return result;
    }
    const direct = statements(async (sql,params) => {
      const stmt = sqlite.prepare(sql);
      if (/^SELECT|RETURNING/i.test(sql) || /\bRETURNING\b/i.test(sql)) return {rows:stmt.all(...params)};
      return {rows:[],rowCount:stmt.run(...params).changes};
    });
    database = {
      prepare(sql) {
        const stmt = direct.prepare(sql);
        return Object.fromEntries(['get','all','run'].map(method => [method,(...params) => exclusive(() => stmt[method](...params))]));
      },
      exec: sql => exclusive(() => sqlite.exec(sql)),
      transaction: work => exclusive(async () => {
        sqlite.exec('BEGIN IMMEDIATE');
        try { const result = await work(direct); sqlite.exec('COMMIT'); return result; }
        catch (error) { sqlite.exec('ROLLBACK'); throw error; }
      }),
      close: () => exclusive(() => sqlite.close())
    };
  }
  try {
    const id = postgres ? 'SERIAL PRIMARY KEY' : 'INTEGER PRIMARY KEY';
    const timestamp = postgres ? "(to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS'))" : 'CURRENT_TIMESTAMP';
    await database.exec(`
      CREATE TABLE IF NOT EXISTS users (id ${id}, name TEXT NOT NULL, email TEXT UNIQUE NOT NULL, salt TEXT NOT NULL, password_hash TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id), expires BIGINT NOT NULL);
      CREATE TABLE IF NOT EXISTS products (id INTEGER PRIMARY KEY, name TEXT NOT NULL, price_cents INTEGER NOT NULL CHECK(price_cents > 0), icon TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS orders (id ${id}, user_id INTEGER NOT NULL REFERENCES users(id), request_key TEXT NOT NULL, total_cents INTEGER NOT NULL, status TEXT NOT NULL DEFAULT 'pending_payment', created_at TEXT NOT NULL DEFAULT ${timestamp}, UNIQUE(user_id, request_key));
      CREATE TABLE IF NOT EXISTS order_items (order_id INTEGER NOT NULL REFERENCES orders(id), product_id INTEGER NOT NULL REFERENCES products(id), name TEXT NOT NULL, price_cents INTEGER NOT NULL, quantity INTEGER NOT NULL CHECK(quantity BETWEEN 1 AND 20));
      CREATE TABLE IF NOT EXISTS messages (id ${id}, name TEXT NOT NULL, email TEXT NOT NULL, message TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT ${timestamp});
      CREATE INDEX IF NOT EXISTS sessions_expiry_idx ON sessions(expires);
      CREATE INDEX IF NOT EXISTS order_items_order_idx ON order_items(order_id);
    `);
    const seed = database.prepare('INSERT INTO products(id,name,price_cents,icon) VALUES(?,?,?,?) ON CONFLICT(id) DO NOTHING');
    for (const product of [[1,'AI Starter Kit',4999,'🤖'],[2,'Cloud Storage 1TB',2999,'☁️'],[3,'Security Suite Pro',7999,'🔒'],[4,'Dev Workstation',19999,'💻']]) await seed.run(...product);
    return database;
  } catch(error) { await database.close(); throw error; }
}
