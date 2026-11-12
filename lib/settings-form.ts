import type { OrgSettings } from "./settings";

export type SettingsParse = { ok: true; name: string; settings: OrgSettings } | { ok: false; error: string };

function raw(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function requiredNumber(
  formData: FormData,
  key: string,
  label: string,
  min: number,
  max: number,
): number {
  const value = Number(raw(formData, key));
  if (!Number.isFinite(value) || value < min || value > max) {
    throw new Error(`${label} needs to be between ${min} and ${max}.`);
  }
  return value;
}

function numberList(formData: FormData, key: string, label: string, min: number, max: number): number[] {
  const parts = raw(formData, key)
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length < 1 || parts.length > 5) {
    throw new Error(`${label} needs 1 to 5 comma-separated numbers.`);
  }
  return parts.map((part) => {
    const value = Number(part);
    if (!Number.isFinite(value) || value < min || value > max) {
      throw new Error(`${label} values need to be between ${min} and ${max}.`);
    }
    return value;
  });
}

export function settingsFromFormData(formData: FormData): SettingsParse {
  const name = raw(formData, "workspaceName");
  if (name.length < 2 || name.length > 80) {
    return { ok: false, error: "Workspace name needs 2 to 80 characters." };
  }
  try {
    const settings: OrgSettings = {
      exitFactors: {
        wholesale: requiredNumber(formData, "exit.wholesale", "Wholesale factor", 0.05, 1.25),
        retail_flip: requiredNumber(formData, "exit.retail_flip", "Retail flip factor", 0.05, 1.25),
        seller_finance: requiredNumber(formData, "exit.seller_finance", "Seller-finance factor", 0.05, 1.25),
        subdivide: requiredNumber(formData, "exit.subdivide", "Subdivide factor", 0.05, 1.25),
      },
      minProfit: {
        wholesale: requiredNumber(formData, "profit.wholesale", "Wholesale minimum profit", 0, 5_000_000),
        retail_flip: requiredNumber(formData, "profit.retail_flip", "Retail flip minimum profit", 0, 5_000_000),
        seller_finance: requiredNumber(formData, "profit.seller_finance", "Seller-finance minimum profit", 0, 5_000_000),
        subdivide: requiredNumber(formData, "profit.subdivide", "Subdivide minimum profit", 0, 5_000_000),
      },
      costs: {
        closingTitle: requiredNumber(formData, "cost.closingTitle", "Closing and title", 0, 1_000_000),
        survey: requiredNumber(formData, "cost.survey", "Survey", 0, 1_000_000),
        holding: requiredNumber(formData, "cost.holding", "Holding", 0, 1_000_000),
      },
      sizeElasticity: requiredNumber(formData, "sizeElasticity", "Size elasticity", 0, 1),
      sizeClamp: {
        min: requiredNumber(formData, "sizeClamp.min", "Size clamp min", -0.9, 0),
        max: requiredNumber(formData, "sizeClamp.max", "Size clamp max", 0, 0.9),
      },
      featureClamp: {
        min: requiredNumber(formData, "featureClamp.min", "Feature clamp min", -0.95, 0),
        max: requiredNumber(formData, "featureClamp.max", "Feature clamp max", 0, 0.9),
      },
      accessAdjustments: {
        paved: requiredNumber(formData, "access.paved", "Paved adjustment", -0.9, 0.5),
        dirt: requiredNumber(formData, "access.dirt", "Dirt-road adjustment", -0.9, 0.5),
        easement: requiredNumber(formData, "access.easement", "Easement adjustment", -0.9, 0.5),
        landlocked: requiredNumber(formData, "access.landlocked", "Landlocked adjustment", -0.9, 0.5),
      },
      floodPenaltyPerShare: requiredNumber(formData, "floodPenaltyPerShare", "Flood penalty", 0, 2),
      utilityAdjustments: {
        none: requiredNumber(formData, "utility.none", "No-power adjustment", -0.9, 0.5),
        power: requiredNumber(formData, "utility.power", "Power-only adjustment", -0.9, 0.5),
        power_water: requiredNumber(formData, "utility.power_water", "Power and water adjustment", -0.9, 0.5),
        full: requiredNumber(formData, "utility.full", "Full utilities adjustment", -0.9, 0.5),
      },
      hoaAdjustment: requiredNumber(formData, "hoaAdjustment", "HOA adjustment", -0.9, 0.5),
      unclearTitleAdjustment: requiredNumber(formData, "unclearTitleAdjustment", "Unclear title adjustment", -0.9, 0.5),
      outlierIqrMultiplier: requiredNumber(formData, "outlierIqrMultiplier", "IQR multiplier", 0.5, 5),
      distanceMilesBands: numberList(formData, "distanceMilesBands", "Distance bands", 0.1, 200),
      acreageBands: numberList(formData, "acreageBands", "Acreage bands", 0.05, 1),
      recencyMonthsBands: numberList(formData, "recencyMonthsBands", "Recency bands", 1, 120),
      openingDiscount: requiredNumber(formData, "openingDiscount", "Opening discount", 0, 0.8),
      lowConfidenceExtraDiscount: requiredNumber(
        formData,
        "lowConfidenceExtraDiscount",
        "Low-confidence haircut",
        0,
        0.5,
      ),
      confidence: {
        high: {
          minComps: requiredNumber(formData, "high.minComps", "High comp count", 1, 20),
          maxSpread: requiredNumber(formData, "high.maxSpread", "High spread", 0.01, 1),
          maxMiles: requiredNumber(formData, "high.maxMiles", "High miles", 0.1, 100),
          maxMonths: requiredNumber(formData, "high.maxMonths", "High months", 1, 120),
        },
        medium: {
          minComps: requiredNumber(formData, "medium.minComps", "Medium comp count", 1, 20),
          maxSpread: requiredNumber(formData, "medium.maxSpread", "Medium spread", 0.01, 1.5),
          maxMiles: requiredNumber(formData, "medium.maxMiles", "Medium miles", 0.1, 200),
          maxMonths: requiredNumber(formData, "medium.maxMonths", "Medium months", 1, 120),
        },
      },
    };
    if (settings.sizeClamp.min > settings.sizeClamp.max || settings.featureClamp.min > settings.featureClamp.max) {
      return { ok: false, error: "Clamp minimums have to sit below the maximums." };
    }
    return { ok: true, name, settings };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Those settings could not be read." };
  }
}
