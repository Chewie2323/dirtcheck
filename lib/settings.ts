import type { ExitStrategy, RoadAccess } from "./types";

export interface Threshold {
  minComps: number;
  maxSpread: number;
  maxMiles: number;
  maxMonths: number;
}

export interface OrgSettings {
  exitFactors: Record<ExitStrategy, number>;
  minProfit: Record<ExitStrategy, number>;
  costs: {
    closingTitle: number;
    survey: number;
    holding: number;
  };
  sizeElasticity: number;
  sizeClamp: { min: number; max: number };
  featureClamp: { min: number; max: number };
  accessAdjustments: Record<RoadAccess, number>;
  floodPenaltyPerShare: number;
  utilityAdjustments: {
    none: number;
    power: number;
    power_water: number;
    full: number;
  };
  hoaAdjustment: number;
  unclearTitleAdjustment: number;
  outlierIqrMultiplier: number;
  distanceMilesBands: number[];
  acreageBands: number[];
  recencyMonthsBands: number[];
  openingDiscount: number;
  lowConfidenceExtraDiscount: number;
  confidence: {
    high: Threshold;
    medium: Threshold;
  };
}

/**
 * Workspace defaults. Exit factors and minimum profit are Steven's figures.
 * Due-diligence costs, the size curve, and feature adjustments are still EXAMPLE
 * numbers from the Nov 4, 2026 draft.
 * Size elasticity 0.15 turns a 5-acre subject against a 3-acre comp set into −10%.
 */
export const EXAMPLE_SETTINGS: OrgSettings = {
  exitFactors: {
    wholesale: 0.5,
    retail_flip: 0.6,
    seller_finance: 0.75,
    subdivide: 0.55,
  },
  minProfit: {
    wholesale: 3000,
    retail_flip: 3000,
    seller_finance: 3000,
    subdivide: 3000,
  },
  costs: {
    closingTitle: 1500,
    survey: 800,
    holding: 0,
  },
  sizeElasticity: 0.15,
  sizeClamp: { min: -0.4, max: 0.25 },
  featureClamp: { min: -0.6, max: 0.15 },
  accessAdjustments: {
    paved: 0,
    dirt: -0.1,
    easement: -0.18,
    landlocked: -0.45,
  },
  floodPenaltyPerShare: 0.5,
  utilityAdjustments: {
    none: -0.12,
    power: -0.05,
    power_water: -0.02,
    full: 0,
  },
  hoaAdjustment: -0.04,
  unclearTitleAdjustment: -0.05,
  outlierIqrMultiplier: 1.5,
  distanceMilesBands: [5, 15, 30],
  acreageBands: [0.2, 0.35, 0.5],
  recencyMonthsBands: [12, 24, 36],
  openingDiscount: 0.15,
  lowConfidenceExtraDiscount: 0,
  confidence: {
    high: { minComps: 5, maxSpread: 0.15, maxMiles: 5, maxMonths: 12 },
    medium: { minComps: 3, maxSpread: 0.3, maxMiles: 15, maxMonths: 24 },
  },
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function num(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function numList(value: unknown, fallback: number[]): number[] {
  if (!Array.isArray(value) || value.length === 0) return [...fallback];
  const next = value.filter((item): item is number => typeof item === "number" && Number.isFinite(item));
  return next.length ? next : [...fallback];
}

export function resolveSettings(raw: unknown): OrgSettings {
  const base = structuredClone(EXAMPLE_SETTINGS);
  if (!isRecord(raw)) return base;
  const exit = isRecord(raw.exitFactors) ? raw.exitFactors : {};
  const profit = isRecord(raw.minProfit) ? raw.minProfit : {};
  const costs = isRecord(raw.costs) ? raw.costs : {};
  const sizeClamp = isRecord(raw.sizeClamp) ? raw.sizeClamp : {};
  const featureClamp = isRecord(raw.featureClamp) ? raw.featureClamp : {};
  const access = isRecord(raw.accessAdjustments) ? raw.accessAdjustments : {};
  const utilities = isRecord(raw.utilityAdjustments) ? raw.utilityAdjustments : {};
  const confidence = isRecord(raw.confidence) ? raw.confidence : {};
  const high = isRecord(confidence.high) ? confidence.high : {};
  const medium = isRecord(confidence.medium) ? confidence.medium : {};

  return {
    exitFactors: {
      wholesale: num(exit.wholesale, base.exitFactors.wholesale),
      retail_flip: num(exit.retail_flip, base.exitFactors.retail_flip),
      seller_finance: num(exit.seller_finance, base.exitFactors.seller_finance),
      subdivide: num(exit.subdivide, base.exitFactors.subdivide),
    },
    minProfit: {
      wholesale: num(profit.wholesale, base.minProfit.wholesale),
      retail_flip: num(profit.retail_flip, base.minProfit.retail_flip),
      seller_finance: num(profit.seller_finance, base.minProfit.seller_finance),
      subdivide: num(profit.subdivide, base.minProfit.subdivide),
    },
    costs: {
      closingTitle: num(costs.closingTitle, base.costs.closingTitle),
      survey: num(costs.survey, base.costs.survey),
      holding: num(costs.holding, base.costs.holding),
    },
    sizeElasticity: num(raw.sizeElasticity, base.sizeElasticity),
    sizeClamp: {
      min: num(sizeClamp.min, base.sizeClamp.min),
      max: num(sizeClamp.max, base.sizeClamp.max),
    },
    featureClamp: {
      min: num(featureClamp.min, base.featureClamp.min),
      max: num(featureClamp.max, base.featureClamp.max),
    },
    accessAdjustments: {
      paved: num(access.paved, base.accessAdjustments.paved),
      dirt: num(access.dirt, base.accessAdjustments.dirt),
      easement: num(access.easement, base.accessAdjustments.easement),
      landlocked: num(access.landlocked, base.accessAdjustments.landlocked),
    },
    floodPenaltyPerShare: num(raw.floodPenaltyPerShare, base.floodPenaltyPerShare),
    utilityAdjustments: {
      none: num(utilities.none, base.utilityAdjustments.none),
      power: num(utilities.power, base.utilityAdjustments.power),
      power_water: num(utilities.power_water, base.utilityAdjustments.power_water),
      full: num(utilities.full, base.utilityAdjustments.full),
    },
    hoaAdjustment: num(raw.hoaAdjustment, base.hoaAdjustment),
    unclearTitleAdjustment: num(raw.unclearTitleAdjustment, base.unclearTitleAdjustment),
    outlierIqrMultiplier: num(raw.outlierIqrMultiplier, base.outlierIqrMultiplier),
    distanceMilesBands: numList(raw.distanceMilesBands, base.distanceMilesBands),
    acreageBands: numList(raw.acreageBands, base.acreageBands),
    recencyMonthsBands: numList(raw.recencyMonthsBands, base.recencyMonthsBands),
    openingDiscount: num(raw.openingDiscount, base.openingDiscount),
    lowConfidenceExtraDiscount: num(
      raw.lowConfidenceExtraDiscount,
      base.lowConfidenceExtraDiscount,
    ),
    confidence: {
      high: {
        minComps: num(high.minComps, base.confidence.high.minComps),
        maxSpread: num(high.maxSpread, base.confidence.high.maxSpread),
        maxMiles: num(high.maxMiles, base.confidence.high.maxMiles),
        maxMonths: num(high.maxMonths, base.confidence.high.maxMonths),
      },
      medium: {
        minComps: num(medium.minComps, base.confidence.medium.minComps),
        maxSpread: num(medium.maxSpread, base.confidence.medium.maxSpread),
        maxMiles: num(medium.maxMiles, base.confidence.medium.maxMiles),
        maxMonths: num(medium.maxMonths, base.confidence.medium.maxMonths),
      },
    },
  };
}
