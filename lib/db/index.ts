import { neon } from "@neondatabase/serverless";
import { drizzle as drizzleNeon } from "drizzle-orm/neon-http";
import { drizzle as drizzlePg, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool, type PoolConfig } from "pg";
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

function hostOf(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return "";
  }
}

function isNeonHost(url: string): boolean {
  return hostOf(url).endsWith(".neon.tech");
}

function isLocalHost(url: string): boolean {
  const host = hostOf(url);
  return host === "localhost" || host === "127.0.0.1" || host === "::1" || host === "";
}

/**
 * Pool settings for node-postgres (Supabase, local Postgres, any non-Neon host).
 *
 * - Serverless (Vercel) runs many short-lived instances. Each one holds a single
 *   connection so a traffic spike cannot exhaust the database. Point DATABASE_URL
 *   at the pooled endpoint (Supabase: Supavisor, port 6543) for the same reason.
 * - Hosted databases need TLS. `sslmode` is stripped from the URL because recent
 *   `pg` versions read `sslmode=require` as full certificate verification, which
 *   fails against Supabase's private CA chain. TLS stays on; the chain is not
 *   verified. Set DATABASE_SSL_CA to a PEM string to verify it instead.
 */
function poolConfig(url: string): PoolConfig {
  const serverless = Boolean(process.env.VERCEL);
  const config: PoolConfig = {
    max: serverless ? 1 : 10,
    idleTimeoutMillis: serverless ? 5_000 : 30_000,
    connectionTimeoutMillis: 10_000,
  };
  if (isLocalHost(url)) {
    config.connectionString = url;
    return config;
  }
  const parsed = new URL(url);
  parsed.searchParams.delete("sslmode");
  config.connectionString = parsed.toString();
  const ca = process.env.DATABASE_SSL_CA;
  config.ssl = ca ? { ca } : { rejectUnauthorized: false };
  return config;
}

function createDb(): Database {
  const url = databaseUrl();
  if (isNeonHost(url)) {
    return drizzleNeon(neon(url), { schema }) as unknown as Database;
  }
  const pool = globalForDb.pool ?? new Pool(poolConfig(url));
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
 * Postgres URL, including Supabase and local, uses node-postgres.
 */
export const db: Database = new Proxy({} as Database, {
  get(_target, property, receiver) {
    const real = getDb();
    const value = Reflect.get(real, property, receiver);
    return typeof value === "function" ? value.bind(real) : value;
  },
});

export { schema };
