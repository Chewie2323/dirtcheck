import { buildBuyBox, type BuyBoxReport } from "./buybox/engine";
import { getProvider } from "./comps";
import { verifyComps } from "./comps/verify";
import type { OrgSettings } from "./settings";
import type { DealIntake, LandPortalStub } from "./types";

export interface StubAnalysis {
  kind: "stub";
  analyzedAt: string;
  settings: OrgSettings;
  stub: LandPortalStub;
}

export type StoredAnalysis = BuyBoxReport | StubAnalysis;

export function analysisStatus(analysis: StoredAnalysis): "ready" | "review" | "withheld" | "stub" {
  if (analysis.kind === "stub") return "stub";
  if (analysis.withheld || analysis.offer.walkAway == null) return "withheld";
  if (analysis.humanReview) return "review";
  return "ready";
}

export async function analyzeIntake(
  intake: DealIntake,
  settings: OrgSettings,
  asOf = new Date(),
): Promise<StoredAnalysis> {
  const fetched = await getProvider(intake.provider).fetch({
    address: intake.address,
    apn: intake.apn,
    county: intake.county,
    state: intake.state,
    acres: intake.acres,
    asOf,
  });

  if (!fetched.ok) {
    return {
      kind: "stub",
      analyzedAt: asOf.toISOString(),
      settings,
      stub: fetched,
    };
  }

  const county = intake.county.trim() || fetched.parcel.county;
  const state = intake.state.trim() || fetched.parcel.state;
  const verified = verifyComps({
    subject: {
      county,
      state,
      acres: intake.acres,
      roadAccess: intake.roadAccess,
    },
    comps: fetched.comps,
    settings,
    asOf,
  });

  return buildBuyBox({
    intake,
    parcel: fetched.parcel,
    synthetic: fetched.synthetic,
    providerNotes: fetched.notes,
    verified,
    settings,
    asOf,
  });
}
