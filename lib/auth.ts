import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { db, schema } from "./db";

const isProduction = process.env.NODE_ENV === "production";
const isBuildPhase = process.env.NEXT_PHASE === "phase-production-build";

/**
 * Public origin of the app. Explicit BETTER_AUTH_URL wins. On Vercel we fall
 * back to the production domain, then the deployment URL, so a first deploy
 * works before anyone has copied the origin into an env var.
 */
function resolveBaseURL(): string {
  if (process.env.BETTER_AUTH_URL) return process.env.BETTER_AUTH_URL.replace(/\/$/, "");
  const vercelHost = process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL;
  if (vercelHost) return `https://${vercelHost}`;
  return "http://127.0.0.1:3847";
}

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

const baseURL = resolveBaseURL();

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
  plugins: [nextCookies()],
});

export type Session = typeof auth.$Infer.Session;
