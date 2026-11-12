export const EXIT_STRATEGIES = [
  "wholesale",
  "retail_flip",
  "seller_finance",
  "subdivide",
] as const;

export type ExitStrategy = (typeof EXIT_STRATEGIES)[number];

export const ROAD_ACCESS = ["paved", "dirt", "easement", "landlocked"] as const;
export type RoadAccess = (typeof ROAD_ACCESS)[number];

export const FLOOD_CONDITIONS = ["none", "creek", "partial", "mostly"] as const;
export type FloodCondition = (typeof FLOOD_CONDITIONS)[number];

export const TRI_STATES = ["yes", "no", "unknown"] as const;
export type TriState = (typeof TRI_STATES)[number];

export const OWNER_TYPES = ["person", "estate", "trust", "company"] as const;
export type OwnerType = (typeof OWNER_TYPES)[number];

export const PROVIDERS = ["demo", "land_portal"] as const;
export type CompProviderId = (typeof PROVIDERS)[number];

export type Confidence = "high" | "medium" | "low";

export interface DealIntake {
  address: string;
  apn: string;
  county: string;
  state: string;
  acres: number;
  exitStrategy: ExitStrategy;
  roadAccess: RoadAccess;
  power: boolean;
  water: boolean;
  sewer: boolean;
  flood: FloodCondition;
  floodPct: number;
  zoning: string;
  hoa: TriState;
  backTaxes: number;
  liens: number;
  mortgage: number;
  askingPrice: number | null;
  timeline: string;
  whySelling: string;
  ownerType: OwnerType;
  survey: TriState;
  clearTitle: TriState;
  provider: CompProviderId;
}

export interface LandComp {
  id: string;
  address: string;
  county: string;
  state: string;
  acres: number;
  salePrice: number;
  saleDate: string;
  distanceMiles: number;
  roadAccess: RoadAccess;
  floodShare: number;
  utilitiesNote: string;
  source: "county" | "mls" | "demo" | "demo-synthetic";
  armLength: boolean;
  hasHouse: boolean;
  bundle: boolean;
  distress: boolean;
  notes?: string;
}

export interface ParcelHint {
  address: string;
  apn: string;
  county: string;
  state: string;
  acres: number | null;
  fips?: string;
  notes: string[];
}

export interface CompQuery {
  address: string;
  apn: string;
  county: string;
  state: string;
  acres: number;
  asOf: Date;
}

export interface DemoFetch {
  ok: true;
  provider: CompProviderId;
  synthetic: boolean;
  parcel: ParcelHint;
  comps: LandComp[];
  notes: string[];
}

/**
 * A comps provider that could not return comps. Stored as the "stub" analysis
 * kind (name kept so older saved deals still load).
 * status: not_configured | pending (report queued, run again shortly) | error
 */
export interface LandPortalStub {
  ok: false;
  provider: "land_portal";
  stub: boolean;
  status?: "not_configured" | "pending" | "error";
  configured: boolean;
  message: string;
  plannedCalls: string[];
}

export type CompFetchResult = DemoFetch | LandPortalStub;

export const EXIT_LABELS: Record<ExitStrategy, string> = {
  wholesale: "Wholesale",
  retail_flip: "Retail flip",
  seller_finance: "Seller finance",
  subdivide: "Subdivide",
};

export const ACCESS_LABELS: Record<RoadAccess, string> = {
  paved: "Paved road frontage",
  dirt: "Dirt road",
  easement: "Easement",
  landlocked: "Landlocked",
};

export const FLOOD_LABELS: Record<FloodCondition, string> = {
  none: "No flooding known",
  creek: "Creek or seasonal water",
  partial: "Partial floodplain",
  mostly: "Mostly flood or standing water",
};

export const OWNER_LABELS: Record<OwnerType, string> = {
  person: "Person",
  estate: "Estate",
  trust: "Trust",
  company: "Company",
};
