import { drizzle } from 'drizzle-orm/libsql';
import { getLibSQLClient } from './sqlite';
import * as schema from './schema';

export const createPool = () => {
  return {
    query: async () => ({ rows: [] }),
    on: () => {},
  } as any;
};

export const db = drizzle(getLibSQLClient(), { schema });
