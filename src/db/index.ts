import { drizzle } from 'drizzle-orm/libsql';
import { getLibSQLClient } from './sqlite';
import * as schema from './schema';
import pkg from 'pg';
const { Pool } = pkg;

export const createPool = () => {
  const connectionString = process.env.DATABASE_URL;
  
  if (connectionString) {
    return new Pool({
      connectionString,
      ssl: connectionString.includes("localhost") || connectionString.includes("127.0.0.1") ? false : { rejectUnauthorized: false }
    });
  }

  return new Pool({
    host: process.env.SQL_HOST || "localhost",
    user: process.env.SQL_USER || "postgres",
    password: process.env.SQL_PASSWORD || "postgres",
    database: process.env.SQL_DB_NAME || "postgres",
    port: parseInt(process.env.SQL_PORT || "5432"),
    ssl: process.env.SQL_HOST && !process.env.SQL_HOST.includes("localhost") && !process.env.SQL_HOST.includes("127.0.0.1") 
      ? { rejectUnauthorized: false } 
      : false
  });
};

export const db = drizzle(getLibSQLClient(), { schema });
