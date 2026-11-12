import { neon } from "@neondatabase/serverless";
import { drizzle as drizzleNeon } from "drizzle-orm/neon-http";
import { drizzle as drizzlePg, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

export type Database = NodePgDatabase<typeof schema>;

const globalForDb = globalThis as unknown as {
  db?: Database;
  pool?: Pool;
};

function databaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set. Add a Postgres connection string.");
  }
  return url;
}

function isNeonHost(url: string): boolean {
  try {
    return new URL(url).hostname.endsWith(".neon.tech");
  } catch {
    return false;
  }
}

function createDb(): Database {
  const url = databaseUrl();
  if (isNeonHost(url)) {
    return drizzleNeon(neon(url), { schema }) as unknown as Database;
  }
  const pool = globalForDb.pool ?? new Pool({ connectionString: url });
  globalForDb.pool = pool;
  return drizzlePg(pool, { schema });
}

export function getDb(): Database {
  if (!globalForDb.db) globalForDb.db = createDb();
  return globalForDb.db;
}

/**
 * Lazy handle. Importing this module does not read DATABASE_URL or open a
 * connection, so `next build` can load the module before env is applied.
 * Neon hosts (*.neon.tech) use @neondatabase/serverless over HTTP. Any other
 * Postgres URL, including local, uses node-postgres.
 */
export const db: Database = new Proxy({} as Database, {
  get(_target, property, receiver) {
    const real = getDb();
    const value = Reflect.get(real, property, receiver);
    return typeof value === "function" ? value.bind(real) : value;
  },
});

export { schema };
