import { randomUUID } from "node:crypto";
import { lt, sql } from "drizzle-orm";
import { db } from "./db";
import { rateLimit } from "./db/schema";
import type { Db } from "./db/types";

export interface Limit {
  /** Max hits allowed per window. */
  max: number;
  windowSeconds: number;
}

export interface LimitResult {
  allowed: boolean;
  count: number;
  retryAfterSeconds: number;
}

/**
 * Count one hit against `key` and say whether it is still within the limit.
 * One atomic upsert, so concurrent requests on different serverless instances
 * cannot race. Fixed window: the first hit opens it, and it resets once
 * `windowSeconds` have passed.
 *
 * If the counter table cannot be reached the hit is allowed. Sign-in needs the
 * same database, so a limiter outage must not become a second outage.
 */
export async function consumeRateLimit(
  key: string,
  limit: Limit,
  database: Db = db,
  now: number = Date.now(),
): Promise<LimitResult> {
  const windowMs = limit.windowSeconds * 1000;
  const cutoff = now - windowMs;
  try {
    const [row] = await database
      .insert(rateLimit)
      .values({ id: randomUUID(), key, count: 1, lastRequest: now })
      .onConflictDoUpdate({
        target: rateLimit.key,
        set: {
          count: sql`CASE WHEN ${rateLimit.lastRequest} < ${cutoff} THEN 1 ELSE ${rateLimit.count} + 1 END`,
          lastRequest: sql`CASE WHEN ${rateLimit.lastRequest} < ${cutoff} THEN ${now} ELSE ${rateLimit.lastRequest} END`,
        },
      })
      .returning({ count: rateLimit.count, windowStart: rateLimit.lastRequest });
    // Occasionally clear windows that ended long ago so the table stays small.
    if (Math.random() < 0.01) {
      await database.delete(rateLimit).where(lt(rateLimit.lastRequest, now - 24 * 3600 * 1000)).catch(() => undefined);
    }
    const allowed = row.count <= limit.max;
    const retryAfterSeconds = allowed ? 0 : Math.max(1, Math.ceil((row.windowStart + windowMs - now) / 1000));
    return { allowed, count: row.count, retryAfterSeconds };
  } catch (error) {
    console.error("rate limit check failed", error);
    return { allowed: true, count: 0, retryAfterSeconds: 0 };
  }
}

function wait(seconds: number): string {
  const minutes = Math.ceil(seconds / 60);
  return minutes <= 1 ? "a minute" : `${minutes} minutes`;
}

export function limitMessage(result: LimitResult): string {
  return `Too many attempts. Try again in ${wait(result.retryAfterSeconds)}.`;
}

export const LIMITS = {
  loginPerIp: { max: 20, windowSeconds: 600 },
  loginPerEmail: { max: 8, windowSeconds: 600 },
  signupPerIp: { max: 5, windowSeconds: 3600 },
  inviteAcceptPerIp: { max: 30, windowSeconds: 600 },
} satisfies Record<string, Limit>;
