import type { DealIntake } from "./types";

export interface SampleParcel {
  id: "coshocton" | "athens" | "meigs";
  title: string;
  blurb: string;
  matchKeys: string[];
  fips: string;
  intake: DealIntake;
}

const shared = {
  power: true,
  water: true,
  sewer: true,
  zoning: "",
  hoa: "no",
  liens: 0,
  mortgage: 0,
  survey: "no",
  clearTitle: "yes",
  provider: "demo",
} as const;

export const SAMPLE_PARCELS: SampleParcel[] = [
  {
    id: "coshocton",
    title: "Coshocton dirt road",
    blurb: "5 acres, dirt road, partial flood. Pilot parcel in Coshocton County.",
    matchKeys: ["townshiproad215", "01200034500", "012-000345-00"],
    fips: "39031",
    intake: {
      ...shared,
      address: "4120 Township Road 215, Coshocton, OH 43812",
      apn: "012-000345-00",
      county: "Coshocton",
      state: "OH",
      acres: 5,
      exitStrategy: "wholesale",
      roadAccess: "dirt",
      flood: "partial",
      floodPct: 20,
      backTaxes: 1200,
      askingPrice: 18000,
      timeline: "30–60 days",
      whySelling: "Inherited the tract and does not want to carry it through winter.",
      ownerType: "person",
    },
  },
  {
    id: "athens",
    title: "Athens paved frontage",
    blurb: "8.2 acres with utilities. Expect a tighter comp set.",
    matchKeys: ["stateroute56", "8800stateroute56", "ath-441290"],
    fips: "39009",
    intake: {
      ...shared,
      address: "8800 State Route 56, Athens, OH 45701",
      apn: "ATH-441290",
      county: "Athens",
      state: "OH",
      acres: 8.2,
      exitStrategy: "retail_flip",
      roadAccess: "paved",
      flood: "none",
      floodPct: 0,
      backTaxes: 0,
      askingPrice: 95000,
      timeline: "This season",
      whySelling: "Owner is consolidating and will entertain a clean cash offer.",
      ownerType: "person",
      survey: "yes",
    },
  },
  {
    id: "meigs",
    title: "Meigs thin market",
    blurb: "22 acres, easement, older and wider comps.",
    matchKeys: ["creekbottomlane", "15creekbottom", "mg-22018"],
    fips: "39105",
    intake: {
      ...shared,
      address: "15 Creek Bottom Lane, Pomeroy, OH 45769",
      apn: "MG-22018",
      county: "Meigs",
      state: "OH",
      acres: 22,
      exitStrategy: "wholesale",
      roadAccess: "easement",
      power: true,
      water: false,
      sewer: false,
      flood: "partial",
      floodPct: 35,
      zoning: "",
      hoa: "unknown",
      backTaxes: 2400,
      liens: 0,
      mortgage: 0,
      askingPrice: 70000,
      timeline: "No firm date",
      whySelling: "Estate is clearing ground the family does not use.",
      ownerType: "estate",
      survey: "unknown",
      clearTitle: "unknown",
      provider: "demo",
    },
  },
];

export function sampleById(id: string | undefined): SampleParcel | undefined {
  return SAMPLE_PARCELS.find((sample) => sample.id === id);
}

export const blankIntake: DealIntake = {
  address: "",
  apn: "",
  county: "",
  state: "",
  acres: 5,
  exitStrategy: "wholesale",
  roadAccess: "dirt",
  power: false,
  water: false,
  sewer: false,
  flood: "none",
  floodPct: 0,
  zoning: "",
  hoa: "unknown",
  backTaxes: 0,
  liens: 0,
  mortgage: 0,
  askingPrice: null,
  timeline: "",
  whySelling: "",
  ownerType: "person",
  survey: "unknown",
  clearTitle: "unknown",
  provider: "land_portal",
};
