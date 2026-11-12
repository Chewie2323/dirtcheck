import type { CompQuery, DemoFetch, LandComp, LandPortalStub, RoadAccess } from "../types";

/**
 * Live Land Portal REST client.
 *
 * Flow:
 *   1. GET  /search?type=parcelnumb&query=<apn>&state=<ST>   → property id + county FIPS
 *   2. GET  /reports?propertyid=&fips=                        → finished comp report, if any
 *   3. POST /reports {propertyid, fips}                       → queue a report (async)
 *   4. poll GET /reports a few times; if still running, return a "pending" result
 *      so the user can re-run in a minute (re-running reads the finished report
 *      instead of queueing another).
 *
 * Auth: Authorization: Bearer <LAND_PORTAL_API_KEY>.
 * Address-only lookup is not a documented endpoint, so an APN is required.
 *
 * The response mapper is deliberately tolerant about field names and refuses to
 * invent data: anything it cannot read becomes an error result, never a fake comp.
 */

type Json = Record<string, unknown>;

const DEFAULT_BASE = "https://landportal.com/wp-json/lp-rest-api/v1";
const REQUEST_TIMEOUT_MS = 8000;
const POLL_INTERVAL_MS = 1500;
const POLL_BUDGET_MS = 6000;

export class LandPortalError extends Error {
  readonly status: "not_configured" | "pending" | "error";
  constructor(status: "not_configured" | "pending" | "error", message: string) {
    super(message);
    this.name = "LandPortalError";
    this.status = status;
  }
}

function isObj(v: unknown): v is Json {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** Case-insensitive, punctuation-insensitive key lookup, one nesting level deep. */
function pick(obj: Json, ...names: string[]): unknown {
  const norm = (k: string) => k.toLowerCase().replace(/[^a-z0-9]/g, "");
  const wanted = names.map(norm);
  const scan = (o: Json): unknown => {
    for (const [k, v] of Object.entries(o)) {
      if (wanted.includes(norm(k)) && v !== null && v !== undefined && v !== "") return v;
    }
    return undefined;
  };
  const top = scan(obj);
  if (top !== undefined) return top;
  for (const v of Object.values(obj)) {
    if (isObj(v)) {
      const nested = scan(v);
      if (nested !== undefined) return nested;
    }
  }
  return undefined;
}

function num(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number(v.replace(/[$,\s]/g, ""));
    if (v.trim() !== "" && Number.isFinite(n)) return n;
  }
  return null;
}

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : typeof v === "number" ? String(v) : "";
}

function toIsoDate(v: unknown): string | null {
  if (v == null || v === "") return null;
  const d = typeof v === "number" ? new Date(v < 1e12 ? v * 1000 : v) : new Date(String(v));
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

/** First array of objects found under a list of likely keys (or the root itself). */
function findList(payload: unknown, keys: string[], depth = 0): Json[] | null {
  if (Array.isArray(payload)) {
    const objs = payload.filter(isObj);
    return objs.length ? objs : null;
  }
  if (!isObj(payload) || depth > 3) return null;
  for (const key of keys) {
    const hit = pick(payload, key);
    if (hit !== undefined) {
      const found = findList(hit, keys, depth + 1);
      if (found) return found;
    }
  }
  for (const v of Object.values(payload)) {
    if (isObj(v) || Array.isArray(v)) {
      const found = findList(v, keys, depth + 1);
      if (found) return found;
    }
  }
  return null;
}

const COMP_LIST_KEYS = ["comps", "comparables", "comparable_sales", "sales", "properties", "results", "data", "items"];
const SEARCH_LIST_KEYS = ["results", "properties", "parcels", "data", "items"];

function floodShare(v: unknown): number {
  const n = num(v) ?? 0;
  return Math.min(1, Math.max(0, n > 1 ? n / 100 : n));
}

function toRoadAccess(v: unknown): RoadAccess {
  const s = str(v).toLowerCase();
  if (s.includes("landlock") || s.includes("no access")) return "landlocked";
  if (s.includes("easement")) return "easement";
  if (s.includes("dirt") || s.includes("gravel") || s.includes("unpaved")) return "dirt";
  return "paved";
}

/** Maps one Land Portal comp record to LandComp, or null when a required field is missing. */
export function mapLandPortalComp(raw: Json, index: number, fallbackCounty: string, fallbackState: string): LandComp | null {
  const salePrice = num(pick(raw, "sale_price", "saleprice", "price", "sold_price", "last_sale_price", "saleamt", "sale_amount"));
  const acres = num(pick(raw, "acres", "acreage", "lot_acres", "lotsizeacres", "ll_gisacre", "gisacre"));
  const saleDate = toIsoDate(pick(raw, "sale_date", "saledate", "sold_date", "last_sale_date", "date_sold", "saledt"));
  if (salePrice == null || salePrice <= 0 || acres == null || acres <= 0 || !saleDate) return null;

  const distance = num(pick(raw, "distance", "distance_miles", "miles", "dist"));
  const bldgSqft = num(pick(raw, "building_sqft", "bldg_sqft", "structure_sqft", "livingarea", "sqft_building"));
  const improved = pick(raw, "improved", "has_structure", "has_building", "has_house");
  const hasHouse =
    improved === true || (typeof improved === "string" && /^(y|yes|true|improved)$/i.test(improved)) || (bldgSqft ?? 0) > 0;
  const armsRaw = pick(raw, "arms_length", "armslength", "arm_length", "valid_sale");
  const armLength = armsRaw === false || (typeof armsRaw === "string" && /^(n|no|false)$/i.test(armsRaw)) ? false : true;
  const id = str(pick(raw, "propertyid", "property_id", "id", "parcelnumb", "apn")) || `lp-${index}`;

  return {
    id: `lp-${id}`,
    address: str(pick(raw, "address", "site_address", "situs", "street_address", "parcel_address")) || `Parcel ${id}`,
    county: str(pick(raw, "county", "county_name")) || fallbackCounty,
    state: (str(pick(raw, "state", "state_code", "state_abbr", "stateabbr")) || fallbackState).toUpperCase(),
    acres,
    salePrice,
    saleDate,
    distanceMiles: distance ?? 0,
    roadAccess: toRoadAccess(pick(raw, "road_access", "access", "road_type")),
    floodShare: floodShare(pick(raw, "flood_pct", "flood_share", "floodplain_pct")),
    utilitiesNote: str(pick(raw, "utilities", "utilities_note")) || "Not provided by Land Portal",
    source: "county",
    armLength,
    hasHouse,
    bundle: false,
    distress: false,
    notes: distance == null ? "Distance not provided by Land Portal" : undefined,
  };
}

export class LandPortalCompsProvider {
  readonly id = "land_portal" as const;
  readonly label = "Land Portal";

  private baseUrl(): string {
    return (process.env.LAND_PORTAL_BASE_URL || DEFAULT_BASE).replace(/\/$/, "");
  }

  private apiKey(): string {
    return (process.env.LAND_PORTAL_API_KEY || "").trim();
  }

  private async request(method: "GET" | "POST", path: string, body?: Json): Promise<unknown> {
    const key = this.apiKey();
    if (!key) throw new LandPortalError("not_configured", "Land Portal is not configured. Set LAND_PORTAL_API_KEY.");
    let res: Response;
    try {
      res = await fetch(`${this.baseUrl()}${path}`, {
        method,
        headers: {
          Authorization: `Bearer ${key}`,
          Accept: "application/json",
          ...(body ? { "Content-Type": "application/json" } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
        cache: "no-store",
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch (error) {
      const timedOut = error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");
      throw new LandPortalError("error", timedOut ? "Land Portal did not respond in time. Try again." : "Could not reach Land Portal.");
    }
    if (res.status === 401 || res.status === 403) {
      throw new LandPortalError("error", `Land Portal rejected the API key (HTTP ${res.status}). Check LAND_PORTAL_API_KEY and that your plan includes API access.`);
    }
    if (res.status === 404) return null;
    if (res.status === 429) throw new LandPortalError("error", "Land Portal rate limit reached. Wait a minute and retry.");
    if (!res.ok) throw new LandPortalError("error", `Land Portal returned HTTP ${res.status}.`);
    try {
      return await res.json();
    } catch {
      throw new LandPortalError("error", "Land Portal returned a response that was not JSON.");
    }
  }

  /** Resolve an APN + state to a Land Portal property id and county FIPS. */
  async resolveSubject(query: CompQuery): Promise<{ propertyId: string; fips: string; county: string; acres: number | null }> {
    const apn = query.apn.trim();
    const state = query.state.trim();
    if (!apn) {
      throw new LandPortalError("error", "Land Portal lookup needs the parcel APN. Add the APN to this deal and run it again.");
    }
    if (!state) throw new LandPortalError("error", "Land Portal lookup needs the state (two letters).");
    const payload = await this.request("GET", `/search?type=parcelnumb&query=${encodeURIComponent(apn)}&state=${encodeURIComponent(state)}`);
    const list = findList(payload, SEARCH_LIST_KEYS) ?? (isObj(payload) ? [payload] : []);
    for (const row of list) {
      const propertyId = str(pick(row, "propertyid", "property_id", "ll_uuid", "id"));
      const fips = str(pick(row, "fips", "county_fips", "geoid", "countyfips"));
      if (propertyId && fips) {
        return {
          propertyId,
          fips: fips.slice(0, 5),
          county: str(pick(row, "county", "county_name")) || query.county,
          acres: num(pick(row, "acres", "acreage", "ll_gisacre", "gisacre")),
        };
      }
    }
    throw new LandPortalError("error", `Land Portal found no parcel for APN ${apn} in ${state}. Check the APN formatting (match the county's format).`);
  }

  /** Queue the asynchronous comp report. */
  async requestCompReport(propertyId: string, fips: string): Promise<void> {
    await this.request("POST", "/reports", { propertyid: propertyId, fips });
  }

  /** Read a finished comp report. Returns null while none exists yet. */
  async readCompReport(propertyId: string, fips: string, query: CompQuery): Promise<LandComp[] | null> {
    const payload = await this.request("GET", `/reports?propertyid=${encodeURIComponent(propertyId)}&fips=${encodeURIComponent(fips)}`);
    if (payload == null) return null;
    const list = findList(payload, COMP_LIST_KEYS);
    if (!list) {
      const status = isObj(payload) ? str(pick(payload, "status", "state")).toLowerCase() : "";
      if (/pending|queued|processing|running|in.?progress/.test(status)) return null;
      const keys = isObj(payload) ? Object.keys(payload).slice(0, 12).join(", ") : typeof payload;
      throw new LandPortalError("error", `Land Portal returned a report this build could not read (top-level fields: ${keys || "none"}). Send this to support so the field mapping can be added.`);
    }
    const comps = list
      .map((raw, i) => mapLandPortalComp(raw, i, query.county, query.state))
      .filter((c): c is LandComp => c !== null);
    if (comps.length === 0) {
      throw new LandPortalError("error", `Land Portal returned ${list.length} record(s) but none had a usable sale price, acreage, and sale date.`);
    }
    return comps;
  }

  private async fetchComps(query: CompQuery): Promise<DemoFetch> {
    const subject = await this.resolveSubject(query);
    let comps = await this.readCompReport(subject.propertyId, subject.fips, query);
    if (!comps) {
      await this.requestCompReport(subject.propertyId, subject.fips);
      const deadline = Date.now() + POLL_BUDGET_MS;
      while (!comps && Date.now() < deadline) {
        await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
        comps = await this.readCompReport(subject.propertyId, subject.fips, query);
      }
    }
    if (!comps) {
      throw new LandPortalError("pending", "Land Portal is still building the comp report for this parcel. Run the buy box again in a minute — it will pick up the finished report.");
    }
    return {
      ok: true,
      provider: "land_portal",
      synthetic: false,
      parcel: {
        address: query.address,
        apn: query.apn,
        county: query.county.trim() || subject.county,
        state: query.state,
        acres: subject.acres ?? query.acres,
        fips: subject.fips,
        notes: [`Land Portal property ${subject.propertyId}`],
      },
      comps,
      notes: [`${comps.length} comps from the Land Portal report`],
    };
  }

  async fetch(query: CompQuery): Promise<DemoFetch | LandPortalStub> {
    try {
      return await this.fetchComps(query);
    } catch (error) {
      if (!(error instanceof LandPortalError)) throw error;
      return {
        ok: false,
        provider: "land_portal",
        stub: false,
        status: error.status,
        configured: Boolean(this.apiKey()),
        message: error.message,
        plannedCalls: [],
      };
    }
  }
}

export const landPortalCompsProvider = new LandPortalCompsProvider();
