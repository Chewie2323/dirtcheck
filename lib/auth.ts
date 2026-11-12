import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { db, schema } from "./db";
import { appBaseUrl } from "./url";

const isProduction = process.env.NODE_ENV === "production";
const isBuildPhase = process.env.NEXT_PHASE === "phase-production-build";

/**
 * The session signing secret. A known default would let anyone forge a session
 * cookie, so production refuses to start without a real one. The build phase is
 * exempt because `next build` imports this module before runtime env is used.
 */
function resolveSecret(): string {
  const secret = process.env.BETTER_AUTH_SECRET;
  if (secret && secret.length >= 32) return secret;
  if (isProduction && !isBuildPhase) {
    throw new Error("BETTER_AUTH_SECRET must be set to a random string of at least 32 characters in production.");
  }
  return secret || "dev-only-dirtcheck-secret-change-me-32b";
}

const baseURL = appBaseUrl();

// Local origins are only trusted outside production.
const trustedOrigins = isProduction
  ? [baseURL]
  : [baseURL, "http://127.0.0.1:3847", "http://localhost:3847"];

export const auth = betterAuth({
  secret: resolveSecret(),
  baseURL,
  trustedOrigins,
  database: drizzleAdapter(db, {
    provider: "pg",
    schema,
  }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
  },
  // Counters live in Postgres so limits hold across serverless instances. This
  // covers the public /api/auth routes. The sign-in and sign-up server actions
  // call the auth API directly, so they use lib/rate-limit.ts with the same table.
  rateLimit: {
    enabled: true,
    storage: "database",
    window: 60,
    max: 60,
    customRules: {
      "/sign-in/email": { window: 60, max: 10 },
      "/sign-up/email": { window: 3600, max: 10 },
    },
  },
  advanced: {
    // Vercel sets these two headers itself, replacing anything a client sends.
    ipAddress: { ipAddressHeaders: ["x-real-ip", "x-forwarded-for"] },
  },
  plugins: [nextCookies()],
});

export type Session = typeof auth.$Infer.Session;
