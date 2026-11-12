/**
 * Public origin of the app. Explicit BETTER_AUTH_URL wins. On Vercel we fall
 * back to the production domain, then the deployment URL, so a first deploy
 * works before anyone has copied the origin into an env var.
 */
export function appBaseUrl(): string {
  if (process.env.BETTER_AUTH_URL) return process.env.BETTER_AUTH_URL.replace(/\/$/, "");
  const vercelHost = process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL;
  if (vercelHost) return `https://${vercelHost}`;
  return "http://127.0.0.1:3847";
}
