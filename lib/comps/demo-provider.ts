import { SAMPLE_PARCELS, type SampleParcel } from "../samples";
import { monthsAgo, normKey } from "../stats";
import { demoMode } from "../features";
import type { CompQuery, DemoFetch, LandComp, LandPortalStub, RoadAccess } from "../types";

interface CompDraft {
  address: string;
  acres: number;
  pricePerAcre: number;
  salePrice?: number;
  monthsAgo: number;
  distanceMiles: number;
  roadAccess: RoadAccess;
  floodShare: number;
  utilitiesNote: string;
  source?: LandComp["source"];
  armLength?: boolean;
  hasHouse?: boolean;
  bundle?: boolean;
  distress?: boolean;
  notes?: string;
}

function materialize(drafts: CompDraft[], asOf: Date, county: string, state: string): LandComp[] {
  return drafts.map((draft, index) => ({
    id: `demo-${normKey(draft.address)}-${index}`,
    address: draft.address,
    county,
    state,
    acres: draft.acres,
    salePrice: draft.salePrice ?? Math.round(draft.pricePerAcre * draft.acres),
    saleDate: monthsAgo(asOf, draft.monthsAgo),
    distanceMiles: draft.distanceMiles,
    roadAccess: draft.roadAccess,
    floodShare: draft.floodShare,
    utilitiesNote: draft.utilitiesNote,
    source: draft.source ?? "demo",
    armLength: draft.armLength ?? true,
    hasHouse: draft.hasHouse ?? false,
    bundle: draft.bundle ?? false,
    distress: draft.distress ?? false,
    notes: draft.notes,
  }));
}

function coshoctonComps(asOf: Date): LandComp[] {
  return materialize(
    [
      {
        address: "1800 Township Road 214, Coshocton, OH",
        acres: 2.6,
        pricePerAcre: 9000,
        salePrice: 23400,
        monthsAgo: 5,
        distanceMiles: 1.1,
        roadAccess: "dirt",
        floodShare: 0.05,
        utilitiesNote: "Power at the road",
      },
      {
        address: "90 County Road 16, Fresno, OH",
        acres: 2.9,
        pricePerAcre: 10500,
        salePrice: 30450,
        monthsAgo: 9,
        distanceMiles: 1.8,
        roadAccess: "dirt",
        floodShare: 0.1,
        utilitiesNote: "Power at the road",
      },
      {
        address: "55 Mill Street Road, Coshocton, OH",
        acres: 3.1,
        pricePerAcre: 11000,
        salePrice: 34100,
        monthsAgo: 13,
        distanceMiles: 2.4,
        roadAccess: "paved",
        floodShare: 0,
        utilitiesNote: "Power and well nearby",
      },
      {
        address: "2400 Township Road 206, Warsaw, OH",
        acres: 3.4,
        pricePerAcre: 12000,
        salePrice: 40800,
        monthsAgo: 16,
        distanceMiles: 2.9,
        roadAccess: "dirt",
        floodShare: 0.08,
        utilitiesNote: "Power at the road",
      },
      {
        address: "12 Ridgeview Lane, Coshocton, OH",
        acres: 3,
        pricePerAcre: 25000,
        salePrice: 75000,
        monthsAgo: 7,
        distanceMiles: 2.2,
        roadAccess: "paved",
        floodShare: 0,
        utilitiesNote: "Edge of the village",
        notes: "Small recreational lot. Included so the IQR screen can drop it.",
      },
      {
        address: "400 Family Farm Road, Coshocton, OH",
        acres: 4,
        pricePerAcre: 25,
        monthsAgo: 4,
        distanceMiles: 1.4,
        roadAccess: "dirt",
        floodShare: 0,
        utilitiesNote: "Unknown",
        distress: true,
        armLength: false,
        notes: "Quitclaim between relatives for $100.",
      },
      {
        address: "22 Orchard House Lane, Coshocton, OH",
        acres: 3.2,
        pricePerAcre: 45000,
        monthsAgo: 8,
        distanceMiles: 2.6,
        roadAccess: "paved",
        floodShare: 0,
        utilitiesNote: "House served by public water",
        hasHouse: true,
        notes: "Improved sale. Not a vacant-land comp.",
      },
      {
        address: "Rear of Township Road 215, Coshocton, OH",
        acres: 4.4,
        pricePerAcre: 4000,
        monthsAgo: 11,
        distanceMiles: 0.6,
        roadAccess: "landlocked",
        floodShare: 0.2,
        utilitiesNote: "None",
        notes: "No legal frontage.",
      },
    ],
    asOf,
    "Coshocton",
    "OH",
  );
}

function athensComps(asOf: Date): LandComp[] {
  return materialize(
    [
      { address: "10200 State Route 56, Athens, OH", acres: 7.1, pricePerAcre: 14200, monthsAgo: 3, distanceMiles: 1.4, roadAccess: "paved", floodShare: 0, utilitiesNote: "Power, water, septic" },
      { address: "640 Happy Hollow Road, Athens, OH", acres: 7.6, pricePerAcre: 14600, monthsAgo: 4, distanceMiles: 2.1, roadAccess: "paved", floodShare: 0, utilitiesNote: "Power and water" },
      { address: "15 Peach Ridge Road, Athens, OH", acres: 8, pricePerAcre: 14900, monthsAgo: 6, distanceMiles: 2.6, roadAccess: "paved", floodShare: 0.02, utilitiesNote: "Power, water, septic" },
      { address: "4300 US Route 33, Athens, OH", acres: 8.4, pricePerAcre: 15100, monthsAgo: 7, distanceMiles: 3.1, roadAccess: "paved", floodShare: 0, utilitiesNote: "Power and city water nearby" },
      { address: "88 Long Run Road, Athens, OH", acres: 8.9, pricePerAcre: 15300, monthsAgo: 8, distanceMiles: 3.4, roadAccess: "paved", floodShare: 0, utilitiesNote: "Power, water, septic" },
      { address: "210 Dowler Road, Athens, OH", acres: 9.4, pricePerAcre: 15600, monthsAgo: 5, distanceMiles: 3.8, roadAccess: "paved", floodShare: 0.04, utilitiesNote: "Power at the road" },
    ],
    asOf,
    "Athens",
    "OH",
  );
}

function meigsComps(asOf: Date): LandComp[] {
  return materialize(
    [
      { address: "400 Laurel Ridge Road, Pomeroy, OH", acres: 15, pricePerAcre: 4500, monthsAgo: 18, distanceMiles: 8, roadAccess: "easement", floodShare: 0.15, utilitiesNote: "Power only" },
      { address: "12 Shade Hollow, Racine, OH", acres: 19, pricePerAcre: 8000, monthsAgo: 27, distanceMiles: 13, roadAccess: "dirt", floodShare: 0.22, utilitiesNote: "None confirmed" },
      { address: "900 Leading Creek Road, Middleport, OH", acres: 28, pricePerAcre: 13000, monthsAgo: 33, distanceMiles: 19, roadAccess: "easement", floodShare: 0.4, utilitiesNote: "Power at the county road" },
    ],
    asOf,
    "Meigs",
    "OH",
  );
}

const BUILDERS: Record<SampleParcel["id"], (asOf: Date) => LandComp[]> = {
  coshocton: coshoctonComps,
  athens: athensComps,
  meigs: meigsComps,
};

function matchSample(query: CompQuery): SampleParcel | undefined {
  const apn = normKey(query.apn);
  if (apn) {
    const byApn = SAMPLE_PARCELS.find((sample) => normKey(sample.intake.apn) === apn);
    if (byApn) return byApn;
  }
  const address = normKey(query.address);
  if (!address) return undefined;
  return SAMPLE_PARCELS.find((sample) =>
    sample.matchKeys.some((key) => address.includes(normKey(key))),
  );
}

function hashString(value: string): number {
  let hash = 2166136261;
  for (const char of value) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function unit(seed: number): () => number {
  let state = seed || 1;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function syntheticComps(query: CompQuery): LandComp[] {
  const rand = unit(hashString(`${query.address}|${query.apn}|${query.acres}`));
  const base = 7000 + Math.round(rand() * 8000);
  const county = query.county.trim() || "Unverified demo county";
  const state = (query.state || "").toUpperCase();
  const access: RoadAccess = "dirt";
  const drafts: CompDraft[] = [0, 1, 2, 3].map((index) => {
    const acres = Math.round(query.acres * (0.75 + rand() * 0.4) * 100) / 100;
    const pricePerAcre = Math.round(base * (0.85 + rand() * 0.3));
    return {
      address: `Synthetic tract ${index + 1} near ${query.address || query.apn || "the subject"}`,
      acres: Math.max(acres, 0.2),
      pricePerAcre,
      monthsAgo: 4 + Math.round(rand() * 14),
      distanceMiles: Math.round((1 + rand() * 7) * 10) / 10,
      roadAccess: access,
      floodShare: Math.round(rand() * 20) / 100,
      utilitiesNote: "Not researched",
      source: "demo-synthetic",
    };
  });
  drafts.push({
    address: `Synthetic outlier near ${query.address || "the subject"}`,
    acres: Math.max(query.acres * 0.9, 0.2),
    pricePerAcre: base * 3,
    monthsAgo: 6,
    distanceMiles: 4,
    roadAccess: access,
    floodShare: 0,
    utilitiesNote: "Not researched",
    source: "demo-synthetic",
    notes: "Generated high price so the outlier screen has something to catch.",
  });
  return materialize(drafts, query.asOf, county, state);
}

export class DemoCompsProvider {
  readonly id = "demo" as const;
  readonly label = "Demo comps";

  async fetch(query: CompQuery): Promise<DemoFetch | LandPortalStub> {
    const sample = matchSample(query);
    if (!sample && !demoMode()) {
      return {
        ok: false,
        provider: "demo",
        stub: false,
        status: "error",
        configured: true,
        message:
          "Demo comps are turned off in this workspace and no real comps provider was used. Switch this deal to Land Portal.",
        plannedCalls: [],
      };
    }
    if (!sample) {
      const county = query.county.trim() || "Unverified demo county";
      const state = (query.state || "").toUpperCase();
      return {
        ok: true,
        provider: "demo",
        synthetic: true,
        parcel: {
          address: query.address,
          apn: query.apn,
          county,
          state,
          acres: query.acres,
          notes: [
            "This address is not one of the bundled sample parcels. The comps below are synthetic demo sales so the worksheet still runs. They are not a market opinion.",
          ],
        },
        comps: syntheticComps(query),
        notes: [
          "Demo fallback. Do not quote these numbers. Add the parcel to a real comps provider when you leave the fixture set.",
        ],
      };
    }

    return {
      ok: true,
      provider: "demo",
      synthetic: false,
      parcel: {
        address: sample.intake.address,
        apn: sample.intake.apn,
        county: sample.intake.county,
        state: sample.intake.state,
        acres: sample.intake.acres,
        fips: sample.fips,
        notes: fixtureNotes(sample.id),
      },
      comps: BUILDERS[sample.id](query.asOf),
      notes: fixtureNotes(sample.id),
    };
  }
}

function fixtureNotes(id: SampleParcel["id"]): string[] {
  if (id === "coshocton") {
    return [
      "Fixture parcel in Coshocton County (FIPS 39031). Verified comps are $9,000, $10,500, $11,000, and $12,000 per acre after the $25,000 outlier drops.",
    ];
  }
  if (id === "athens") {
    return ["Fixture parcel with recent paved sales inside a tight acreage band."];
  }
  return ["Fixture parcel in a thin market: fewer, older, and more scattered sales."];
}

export const demoCompsProvider = new DemoCompsProvider();
