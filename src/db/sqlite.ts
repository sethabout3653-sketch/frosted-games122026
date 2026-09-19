import { createClient } from "@libsql/client";
import fs from "fs";
import path from "path";

let client: any = null;

export function getLibSQLClient() {
  if (!client) {
    const storeDir = path.join(process.cwd(), "uploads");
    try {
      if (!fs.existsSync(storeDir)) {
        fs.mkdirSync(storeDir, { recursive: true });
      }
    } catch (e) {}

    const url =
      process.env.LIBSQL_URL ||
      process.env.TURSO_DATABASE_URL ||
      process.env.SQLITE_URL ||
      `file:${path.join(storeDir, "app.db")}`;

    const authToken =
      process.env.LIBSQL_AUTH_TOKEN ||
      process.env.TURSO_AUTH_TOKEN ||
      undefined;

    client = createClient({
      url,
      authToken,
    });
  }
  return client;
}

let isInitialized = false;

export async function initSQLite() {
  if (isInitialized) return;
  try {
    const cli = getLibSQLClient();
    await cli.execute(`
      CREATE TABLE IF NOT EXISTS records (
        collection TEXT NOT NULL,
        id TEXT NOT NULL,
        data TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        PRIMARY KEY (collection, id)
      )
    `);
    await cli.execute(`
      CREATE TABLE IF NOT EXISTS webrtc_signals (
        id TEXT PRIMARY KEY,
        sender_uid TEXT NOT NULL,
        target_uid TEXT NOT NULL,
        signal_type TEXT NOT NULL,
        data TEXT NOT NULL,
        timestamp INTEGER NOT NULL
      )
    `);
    isInitialized = true;
  } catch (err) {
    console.warn("[SQLite] Init warning:", err);
  }
}

export async function sqliteGetRecord(collection: string, id: string) {
  await initSQLite();
  const cli = getLibSQLClient();
  const res = await cli.execute({
    sql: "SELECT * FROM records WHERE collection = ? AND id = ?",
    args: [collection, id],
  });
  if (res.rows.length === 0) return null;
  const row = res.rows[0];
  try {
    return JSON.parse(row.data as string);
  } catch {
    return row.data;
  }
}

export async function sqliteGetCollection(collection: string) {
  await initSQLite();
  const cli = getLibSQLClient();
  const res = await cli.execute({
    sql: "SELECT * FROM records WHERE collection = ?",
    args: [collection],
  });
  const map: Record<string, any> = {};
  res.rows.forEach((row: any) => {
    try {
      map[row.id as string] = JSON.parse(row.data as string);
    } catch {
      map[row.id as string] = row.data;
    }
  });
  return map;
}

export async function sqliteSetRecord(collection: string, id: string, data: any, timestamp = Date.now()) {
  await initSQLite();
  const cli = getLibSQLClient();
  const serialized = typeof data === "string" ? data : JSON.stringify(data);
  await cli.execute({
    sql: "INSERT OR REPLACE INTO records (collection, id, data, timestamp) VALUES (?, ?, ?, ?)",
    args: [collection, id, serialized, timestamp],
  });
}

export async function sqliteDeleteRecord(collection: string, id: string) {
  await initSQLite();
  const cli = getLibSQLClient();
  await cli.execute({
    sql: "DELETE FROM records WHERE collection = ? AND id = ?",
    args: [collection, id],
  });
}
