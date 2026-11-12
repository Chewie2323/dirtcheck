import {
  EXIT_STRATEGIES,
  FLOOD_CONDITIONS,
  OWNER_TYPES,
  PROVIDERS,
  ROAD_ACCESS,
  TRI_STATES,
  type DealIntake,
} from "./types";

export type IntakeResult = { ok: true; intake: DealIntake } | { ok: false; error: string };

function text(formData: FormData, key: string, max: number): string {
  const value = formData.get(key);
  if (typeof value !== "string") return "";
  return value.trim().slice(0, max);
}

function choice<T extends string>(value: string, allowed: readonly T[]): T | null {
  return (allowed as readonly string[]).includes(value) ? (value as T) : null;
}

function moneyField(formData: FormData, key: string): number | null {
  const raw = text(formData, key, 20).replace(/[$,\s]/g, "");
  if (!raw) return 0;
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0 || value > 100_000_000) return null;
  return value;
}

export function intakeFromFormData(formData: FormData): IntakeResult {
  const address = text(formData, "address", 200);
  const apn = text(formData, "apn", 80);
  if (address.length < 4 && apn.length < 3) {
    return { ok: false, error: "Enter an address or an APN." };
  }

  const acres = Number(text(formData, "acres", 20));
  if (!Number.isFinite(acres) || acres <= 0 || acres > 100000) {
    return { ok: false, error: "Acreage has to be a number greater than zero." };
  }

  const state = text(formData, "state", 2).toUpperCase();
  if (state && !/^[A-Z]{2}$/.test(state)) {
    return { ok: false, error: "State should be a two-letter code, such as TX." };
  }

  if (text(formData, "provider", 40) === "land_portal") {
    if (apn.length < 3) return { ok: false, error: "Land Portal lookups need the parcel APN." };
    if (!state) return { ok: false, error: "Land Portal lookups need the two-letter state." };
  }

  const exitStrategy = choice(text(formData, "exitStrategy", 40), EXIT_STRATEGIES);
  const roadAccess = choice(text(formData, "roadAccess", 40), ROAD_ACCESS);
  const flood = choice(text(formData, "flood", 40), FLOOD_CONDITIONS);
  const hoa = choice(text(formData, "hoa", 20), TRI_STATES);
  const ownerType = choice(text(formData, "ownerType", 20), OWNER_TYPES);
  const survey = choice(text(formData, "survey", 20), TRI_STATES);
  const clearTitle = choice(text(formData, "clearTitle", 20), TRI_STATES);
  const provider = choice(text(formData, "provider", 40), PROVIDERS);
  if (!exitStrategy || !roadAccess || !flood || !hoa || !ownerType || !survey || !clearTitle || !provider) {
    return { ok: false, error: "One of the intake choices was missing. Refresh the form and try again." };
  }

  const floodPctRaw = text(formData, "floodPct", 10);
  const floodPct = floodPctRaw === "" ? 0 : Number(floodPctRaw);
  if (!Number.isFinite(floodPct) || floodPct < 0 || floodPct > 100) {
    return { ok: false, error: "Flood share has to be a percent from 0 to 100." };
  }

  const backTaxes = moneyField(formData, "backTaxes");
  const liens = moneyField(formData, "liens");
  const mortgage = moneyField(formData, "mortgage");
  const askingRaw = text(formData, "askingPrice", 20).replace(/[$,\s]/g, "");
  const askingPrice = askingRaw === "" ? null : Number(askingRaw);
  if (
    backTaxes == null ||
    liens == null ||
    mortgage == null ||
    (askingPrice != null && (!Number.isFinite(askingPrice) || askingPrice < 0))
  ) {
    return { ok: false, error: "Money fields need to be blank or a positive amount." };
  }

  return {
    ok: true,
    intake: {
      address,
      apn,
      county: text(formData, "county", 80),
      state,
      acres,
      exitStrategy,
      roadAccess,
      power: formData.get("power") === "on",
      water: formData.get("water") === "on",
      sewer: formData.get("sewer") === "on",
      flood,
      floodPct,
      zoning: text(formData, "zoning", 120),
      hoa,
      backTaxes,
      liens,
      mortgage,
      askingPrice,
      timeline: text(formData, "timeline", 120),
      whySelling: text(formData, "whySelling", 400),
      ownerType,
      survey,
      clearTitle,
      provider,
    },
  };
}
