import type { CompQuery, LandComp, LandPortalStub } from "../types";

/**
 * Stub for Land Portal's public REST API.
 *
 * Documented sequence (not called from this build):
 * 1. Resolve the parcel to a property id and county FIPS.
 *    - GET /search?type=parcelnumb&query=&state= for an APN
 *    - GET /property-data?propertyid=&fips= or ?lat=&lng= for the record
 *    Address geocoding is not a documented Land Portal endpoint, so this
 *    client does not invent one.
 * 2. Queue an async comp report: POST /reports { propertyid, fips } → task_id
 * 3. Read it: GET /reports?propertyid=&fips=
 *
 * Base URL: https://landportal.com/wp-json/lp-rest-api/v1
 * Auth header: Authorization: Bearer <token>
 *
 * No HTTP is sent. No sample JSON from the live API is fabricated.
 */
export class LandPortalStubError extends Error {
  readonly configured: boolean;
  readonly step: string;
  readonly baseUrl: string;
  readonly query: CompQuery;

  constructor(step: string, configured: boolean, baseUrl: string, query: CompQuery) {
    super(
      configured
        ? "LAND_PORTAL_API_KEY is set, but live Land Portal calls are not implemented."
        : "Land Portal is not configured.",
    );
    this.name = "LandPortalStubError";
    this.step = step;
    this.configured = configured;
    this.baseUrl = baseUrl;
    this.query = query;
  }

  toResult(): LandPortalStub {
    const base = this.baseUrl;
    const apn = this.query.apn || "{apn}";
    const state = this.query.state || "{state}";
    return {
      ok: false,
      provider: "land_portal",
      stub: true,
      configured: this.configured,
      message: this.configured
        ? "LAND_PORTAL_API_KEY is present, but this build does not call Land Portal. The stub stopped before any HTTP request and did not invent a comp report. Switch this deal to the demo provider."
        : "Land Portal is not configured. There is no LAND_PORTAL_API_KEY, and this build would not call the API even if the key were set. Use the demo provider for a buy box.",
      plannedCalls: [
        `Step 1 — resolve parcel: GET ${base}/search?type=parcelnumb&query=${encodeURIComponent(apn)}&state=${encodeURIComponent(state)}`,
        `Step 1 — property record: GET ${base}/property-data?propertyid={propertyid}&fips={fips}`,
        `Step 2 — queue comp report: POST ${base}/reports  {"propertyid":"{propertyid}","fips":"{fips}"} → task_id`,
        `Step 2 — read comp report: GET ${base}/reports?propertyid={propertyid}&fips={fips}`,
      ],
    };
  }
}

export class LandPortalCompsProvider {
  readonly id = "land_portal" as const;
  readonly label = "Land Portal";

  private baseUrl(): string {
    return (
      process.env.LAND_PORTAL_BASE_URL || "https://landportal.com/wp-json/lp-rest-api/v1"
    ).replace(/\/$/, "");
  }

  private halt(step: string, query: CompQuery): never {
    throw new LandPortalStubError(
      step,
      Boolean(process.env.LAND_PORTAL_API_KEY),
      this.baseUrl(),
      query,
    );
  }

  /** Resolve an address or APN to a Land Portal property id and county FIPS. */
  async resolveSubject(query: CompQuery): Promise<{ propertyId: string; fips: string; county: string }> {
    this.halt("resolveSubject", query);
  }

  /** Queue the asynchronous comp report. */
  async requestCompReport(
    query: CompQuery,
    propertyId: string,
    fips: string,
  ): Promise<{ taskId: string }> {
    this.halt(`requestCompReport ${propertyId} ${fips}`, query);
  }

  /** Read the comp report after the task finishes. */
  async readCompReport(
    query: CompQuery,
    propertyId: string,
    fips: string,
  ): Promise<LandComp[]> {
    this.halt(`readCompReport ${propertyId} ${fips}`, query);
  }

  async fetch(query: CompQuery): Promise<LandPortalStub> {
    try {
      const resolved = await this.resolveSubject(query);
      await this.requestCompReport(query, resolved.propertyId, resolved.fips);
      await this.readCompReport(query, resolved.propertyId, resolved.fips);
      throw new Error("Land Portal stub returned from a step that should have stopped.");
    } catch (error) {
      if (error instanceof LandPortalStubError) return error.toResult();
      throw error;
    }
  }
}

export const landPortalCompsProvider = new LandPortalCompsProvider();
