import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema.ts';

declare global {
  var _postgresPool: Pool | undefined;
}

export const createPool = () => {
  if (!global._postgresPool) {
    if (!process.env.SQL_HOST) {
      return {
        query: async () => ({ rows: [] }),
        on: () => {},
      } as any;
    }

    try {
      global._postgresPool = new Pool({
        host: process.env.SQL_HOST,
        user: process.env.SQL_USER,
        password: process.env.SQL_PASSWORD,
        database: process.env.SQL_DB_NAME,
        max: 10,
        connectionTimeoutMillis: 15000,
      });

      global._postgresPool.on('error', (err) => {
        console.error('Unexpected error on idle SQL pool client:', err);
      });
    } catch (e) {
      console.warn("PostgreSQL Pool creation fallback:", e);
      return {
        query: async () => ({ rows: [] }),
        on: () => {},
      } as any;
    }
  }
  return global._postgresPool;
};

let dbClient: any = null;
try {
  if (process.env.SQL_HOST) {
    const pool = createPool();
    dbClient = drizzle(pool, { schema });
  } else {
    dbClient = new Proxy({}, {
      get: () => () => ({
        where: () => ({ where: () => [], values: () => [] }),
        values: () => ({ returning: () => [] }),
        set: () => ({ where: () => [] }),
        from: () => ({ where: () => [] }),
        execute: async () => [],
        then: (resolve: any) => resolve([]),
      })
    });
  }
} catch (e) {
  console.warn("Drizzle ORM initialization deferred:", e);
  dbClient = new Proxy({}, {
    get: () => () => ({
      where: () => ({ where: () => [], values: () => [] }),
      values: () => ({ returning: () => [] }),
      set: () => ({ where: () => [] }),
      from: () => ({ where: () => [] }),
      execute: async () => [],
      then: (resolve: any) => resolve([]),
    })
  });
}

export const db = dbClient;
