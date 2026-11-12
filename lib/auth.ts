import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { db, schema } from "./db";

const baseURL = process.env.BETTER_AUTH_URL || "http://127.0.0.1:3847";

export const auth = betterAuth({
  secret: process.env.BETTER_AUTH_SECRET || "dev-only-dirtcheck-secret-change-me-32b",
  baseURL,
  trustedOrigins: [baseURL, "http://127.0.0.1:3847", "http://localhost:3847"],
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
