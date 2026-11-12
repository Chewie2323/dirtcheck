import type { CompProviderId } from "./types";

/**
 * Demo mode exposes the bundled sample parcels, the demo comps provider, and
 * synthetic filler comps. It is on in local development and off in production
 * unless ALLOW_DEMO_DATA=1 is set on purpose (for example on a sales-demo deploy).
 */
export function demoMode(): boolean {
  return process.env.NODE_ENV !== "production" || process.env.ALLOW_DEMO_DATA === "1";
}

export function landPortalConfigured(): boolean {
  return Boolean((process.env.LAND_PORTAL_API_KEY || "").trim());
}

/** Provider a new deal starts on: live comps whenever possible. */
export function defaultProvider(): CompProviderId {
  if (landPortalConfigured() || !demoMode()) return "land_portal";
  return "demo";
}
