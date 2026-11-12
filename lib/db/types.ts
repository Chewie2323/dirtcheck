import type { PgDatabase } from "drizzle-orm/pg-core";
import type * as schema from "./schema";

/**
 * Any Drizzle Postgres database over this schema. Modules take one of these as
 * an optional argument, so the app passes its node-postgres handle and the
 * tests pass an in-memory one.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Db = PgDatabase<any, typeof schema>;
