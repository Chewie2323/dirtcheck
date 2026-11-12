import type { OrgSettings } from "../settings";
import { clamp, median, roundDollar } from "../stats";
import type { Confidence, DealIntake, ParcelHint } from "../types";
import type { ReviewedComp, VerifiedSet } from "../comps/verify";

export interface FeatureLine {
  label: string;
  fraction: number;
}

export interface CostLine {
  label: string;
  amount: number;
}

export interface MathStep {
  step: number;
  title: string;
  detail: string;
  result: string;
}

export interface RiskFlag {
  severity: "info" | "watch" | "stop";
  text: string;
}

export interface BuyBoxReport {
  kind: "report";
  provider: "demo";
  synthetic: boolean;
  analyzedAt: string;
  settings: OrgSettings;
  parcelNotes: string[];
  verificationNotes: string[];
  kept: ReviewedComp[];
  rejected: ReviewedComp[];
  band: VerifiedSet["band"];
  steps: MathStep[];
  flags: RiskFlag[];
  confidence: Confidence;
  confidenceReasons: string[];
  humanReview: boolean;
  withheld: boolean;
  withholdReason: string | null;
  offer: {
    target: number | null;
    walkAway: number | null;
    marketValue: number | null;
    adjustedPricePerAcre: number | null;
    calculatedTarget: number | null;
    calculatedWalkAway: number | null;
  };
  math: {
    pricesPerAcre: number[];
    droppedPricesPerAcre: number[];
    medianPricePerAcre: number | null;
    averageCompAcres: number | null;
    sizeAdjustment: number;
    pricePerAcreAfterSize: number | null;
    featureLines: FeatureLine[];
    featureAdjustment: number;
    adjustedPricePerAcre: number | null;
    marketValue: number | null;
    exitFactor: number;
    exitValue: number | null;
    costLines: CostLine[];
    totalCosts: number;
    afterCosts: number | null;
    minProfit: number;
    openingDiscount: number;
    lowConfidenceHaircut: number;
    spread: number | null;
    maxMiles: number | null;
    maxMonths: number | null;
    walkAway: number | null;
    target: number | null;
  };
}

function floodShare(intake: DealIntake): number {
  if (intake.flood === "none") return 0;
  const typed = Math.min(100, Math.max(0, intake.floodPct)) / 100;
  if (intake.flood === "creek") return Math.max(typed, 0.1);
  if (intake.flood === "mostly") return Math.max(typed, 0.6);
  return typed || 0.2;
}

function utilityKey(intake: DealIntake): keyof OrgSettings["utilityAdjustments"] {
  if (intake.power && intake.water && intake.sewer) return "full";
  if (intake.power && intake.water) return "power_water";
  if (intake.power) return "power";
  return "none";
}

function utilityLabel(key: keyof OrgSettings["utilityAdjustments"]): string {
  if (key === "full") return "Power, water, and sewer or septic";
  if (key === "power_water") return "Power and water, no sewer or septic";
  if (key === "power") return "Power only";
  return "No power at the lot";
}

const CONFIDENCE_ORDER: Confidence[] = ["high", "medium", "low"];

function dropConfidence(level: Confidence, steps: number): Confidence {
  const index = Math.min(CONFIDENCE_ORDER.length - 1, CONFIDENCE_ORDER.indexOf(level) + Math.max(0, steps));
  return CONFIDENCE_ORDER[index];
}

function confidenceLabel(level: Confidence): string {
  if (level === "high") return "High";
  if (level === "medium") return "Medium";
  return "Low";
}

function scoreConfidence(
  count: number,
  spread: number | null,
  maxMiles: number | null,
  maxMonths: number | null,
  settings: OrgSettings,
): { level: Confidence; reasons: string[] } {
  const high = settings.confidence.high;
  const medium = settings.confidence.medium;
  if (count < 3) {
    return {
      level: "low",
      reasons: ["Fewer than 3 verified comps. The worksheet stops before an offer."],
    };
  }
  const passes = (rule: OrgSettings["confidence"]["high"]) =>
    count >= rule.minComps &&
    (spread ?? 99) <= rule.maxSpread &&
    (maxMiles ?? 99) <= rule.maxMiles &&
    (maxMonths ?? 99) <= rule.maxMonths;
  const level: Confidence = passes(high) ? "high" : passes(medium) ? "medium" : "low";
  const reasons = [
    `${count} verified comps. High wants at least ${high.minComps}; medium wants ${medium.minComps}.`,
  ];
  if (spread != null) {
    reasons.push(
      `Price spread is ±${Math.round(spread * 100)}% (half the range, divided by the median). High allows ±${Math.round(high.maxSpread * 100)}%; medium allows ±${Math.round(medium.maxSpread * 100)}%.`,
    );
  }
  if (maxMiles != null) {
    reasons.push(
      `Farthest verified comp is ${maxMiles.toFixed(1)} miles. High allows ${high.maxMiles}; medium allows ${medium.maxMiles}.`,
    );
  }
  if (maxMonths != null) {
    reasons.push(
      `Oldest verified sale is ${Math.round(maxMonths)} months. High allows ${high.maxMonths}; medium allows ${medium.maxMonths}.`,
    );
  }
  if (level === "high") {
    reasons.push("High confidence. A person still signs off before anyone quotes a number.");
  } else if (level === "medium") {
    reasons.push("Medium confidence. Review the comps before anyone quotes an offer.");
  } else {
    reasons.push("Low confidence. Treat the range as a discussion point, or pass.");
  }
  return { level, reasons };
}

export function buildBuyBox(input: {
  intake: DealIntake;
  parcel: ParcelHint;
  synthetic: boolean;
  providerNotes: string[];
  verified: VerifiedSet;
  settings: OrgSettings;
  asOf: Date;
}): BuyBoxReport {
  const { intake, settings, verified } = input;
  const kept = verified.kept;
  const prices = kept.map((comp) => comp.pricePerAcre);
  const med = median(prices);
  const averageCompAcres =
    kept.length > 0 ? kept.reduce((sum, comp) => sum + comp.acres, 0) / kept.length : null;
  const droppedPrices = verified.rejected
    .filter((comp) => comp.reasons.some((reason) => reason.includes("IQR")))
    .map((comp) => comp.pricePerAcre);

  const steps: MathStep[] = [];
  const flags: RiskFlag[] = [];

  const priceList = prices.map((price) => `$${Math.round(price).toLocaleString("en-US")}`).join(", ");
  const droppedList = droppedPrices
    .map((price) => `$${Math.round(price).toLocaleString("en-US")}`)
    .join(", ");
  steps.push({
    step: 1,
    title: "Median price per acre",
    detail: med == null
      ? "No verified comps, so there is no median."
      : `Verified prices per acre: ${priceList}.${droppedList ? ` Dropped ${droppedList} as ${droppedPrices.length === 1 ? "an outlier" : "outliers"}.` : " No price outlier was removed."} Median of the survivors.`,
    result: med == null ? "—" : `$${Math.round(med).toLocaleString("en-US")}/ac`,
  });

  let sizeAdjustment = 0;
  let priceAfterSize: number | null = null;
  if (med != null && averageCompAcres && averageCompAcres > 0) {
    const raw = -(intake.acres / averageCompAcres - 1) * settings.sizeElasticity;
    sizeAdjustment = clamp(raw, settings.sizeClamp.min, settings.sizeClamp.max);
    priceAfterSize = med * (1 + sizeAdjustment);
  }
  steps.push({
    step: 2,
    title: "Size adjustment",
    detail:
      med == null || averageCompAcres == null
        ? "Skipped until there is a verified set."
        : `Subject is ${intake.acres} ac. Verified comps average ${averageCompAcres.toFixed(2)} ac. Adjustment = −(subject ÷ average − 1) × elasticity ${settings.sizeElasticity}. Clamped to ${Math.round(settings.sizeClamp.min * 100)}% … ${Math.round(settings.sizeClamp.max * 100)}%. Larger tracts price lower per acre.`,
    result:
      priceAfterSize == null
        ? "—"
        : `${sizeAdjustment >= 0 ? "+" : ""}${(sizeAdjustment * 100).toFixed(1)}% → $${Math.round(priceAfterSize).toLocaleString("en-US")}/ac`,
  });

  const share = floodShare(intake);
  const utilities = utilityKey(intake);
  const featureLines: FeatureLine[] = [
    {
      label: `Road access: ${intake.roadAccess.replaceAll("_", " ")}`,
      fraction: settings.accessAdjustments[intake.roadAccess],
    },
    {
      label: `Flood share ${Math.round(share * 100)}% × penalty ${settings.floodPenaltyPerShare}`,
      fraction: -share * settings.floodPenaltyPerShare,
    },
    {
      label: utilityLabel(utilities),
      fraction: settings.utilityAdjustments[utilities],
    },
  ];
  if (intake.hoa === "yes") {
    featureLines.push({ label: "HOA or recorded restrictions", fraction: settings.hoaAdjustment });
  }
  if (intake.clearTitle === "no") {
    featureLines.push({ label: "Title is not clear", fraction: settings.unclearTitleAdjustment });
  }
  const featureRaw = featureLines.reduce((sum, line) => sum + line.fraction, 0);
  const featureAdjustment = clamp(featureRaw, settings.featureClamp.min, settings.featureClamp.max);
  const adjustedPrice = priceAfterSize == null ? null : priceAfterSize * (1 + featureAdjustment);
  const featureDetail = featureLines
    .map((line) => `${line.label} ${line.fraction >= 0 ? "+" : ""}${(line.fraction * 100).toFixed(1)}%`)
    .join("; ");
  steps.push({
    step: 3,
    title: "Feature adjustments",
    detail: `${featureDetail}. Adjustments add together, then the total is clamped to ${Math.round(settings.featureClamp.min * 100)}% … ${Math.round(settings.featureClamp.max * 100)}%.`,
    result:
      adjustedPrice == null
        ? "—"
        : `${featureAdjustment >= 0 ? "+" : ""}${(featureAdjustment * 100).toFixed(1)}% → $${Math.round(adjustedPrice).toLocaleString("en-US")}/ac`,
  });

  const enough = kept.length >= 3;
  const marketValue =
    enough && adjustedPrice != null ? roundDollar(adjustedPrice * intake.acres) : null;
  steps.push({
    step: 4,
    title: "Market value",
    detail: enough
      ? `Adjusted price per acre × ${intake.acres} subject acres. This is a comp-indicated retail value, not an offer.`
      : "Insufficient comps — needs human review. Distance, then time up to 36 months, then the acreage band were widened, and fewer than 3 comps remain. No offer.",
    result: marketValue == null ? "No value" : `$${marketValue.toLocaleString("en-US")}`,
  });

  const exitFactor = settings.exitFactors[intake.exitStrategy];
  const exitValue = marketValue == null ? null : roundDollar(marketValue * exitFactor);
  steps.push({
    step: 5,
    title: "Exit factor",
    detail: `${intake.exitStrategy.replaceAll("_", " ")} factor ${exitFactor} from this workspace, applied to adjusted market value.`,
    result: exitValue == null ? "—" : `$${exitValue.toLocaleString("en-US")}`,
  });

  const costLines: CostLine[] = [];
  if (intake.backTaxes > 0) costLines.push({ label: "Back taxes", amount: intake.backTaxes });
  if (intake.liens > 0) costLines.push({ label: "Liens entered on the intake", amount: intake.liens });
  if (intake.mortgage > 0) costLines.push({ label: "Mortgage payoff entered on the intake", amount: intake.mortgage });
  costLines.push({ label: "Closing and title (workspace default)", amount: settings.costs.closingTitle });
  if (intake.survey === "yes") {
    costLines.push({ label: "Survey (on file, so $0)", amount: 0 });
  } else {
    costLines.push({ label: "Survey (workspace default)", amount: settings.costs.survey });
  }
  if (settings.costs.holding > 0) {
    costLines.push({ label: "Holding (workspace default)", amount: settings.costs.holding });
  }
  const totalCosts = costLines.reduce((sum, line) => sum + line.amount, 0);
  const afterCosts = exitValue == null ? null : exitValue - totalCosts;
  steps.push({
    step: 6,
    title: "Minus costs",
    detail: costLines.map((line) => `${line.label} $${Math.round(line.amount).toLocaleString("en-US")}`).join(" + ") + `. Exit value minus these costs, before minimum profit.`,
    result: afterCosts == null ? "—" : `$${Math.round(afterCosts).toLocaleString("en-US")}`,
  });

  const minProfit = settings.minProfit[intake.exitStrategy];
  let walkAway = afterCosts == null ? null : roundDollar(afterCosts - minProfit);
  let lowConfidenceHaircut = 0;
  const maxMiles = kept.length ? Math.max(...kept.map((comp) => comp.distanceMiles)) : null;
  const maxMonths = kept.length ? Math.max(...kept.map((comp) => comp.ageMonths)) : null;
  const spread =
    med && med > 0 && prices.length
      ? (Math.max(...prices) - Math.min(...prices)) / 2 / med
      : null;
  let { level, reasons } = scoreConfidence(kept.length, spread, maxMiles, maxMonths, settings);
  const wideningDrops = verified.wideningSteps.length;
  if (wideningDrops > 0) {
    const dropped = dropConfidence(level, wideningDrops);
    reasons.push(
      `Search widened ${wideningDrops} ${wideningDrops === 1 ? "step" : "steps"}: ${verified.wideningSteps.map((step) => step.label).join("; ")}. Confidence dropped one level per step, from ${confidenceLabel(level)} to ${confidenceLabel(dropped)}.`,
    );
    level = dropped;
  }
  if (input.synthetic && level !== "low") {
    level = "low";
    reasons = [
      ...reasons,
      "Forced to low because these comps are synthetic demo filler, not sales.",
    ];
  }
  if (
    level === "low" &&
    walkAway != null &&
    settings.lowConfidenceExtraDiscount > 0 &&
    enough
  ) {
    lowConfidenceHaircut = settings.lowConfidenceExtraDiscount;
    walkAway = roundDollar(walkAway * (1 - lowConfidenceHaircut));
  }
  let target =
    walkAway == null ? null : roundDollar(walkAway * (1 - settings.openingDiscount));
  if (target != null && walkAway != null && target > walkAway) target = walkAway;

  steps.push({
    step: 7,
    title: "Minimum profit and offer range",
    detail: `Minimum profit for this exit is $${Math.round(minProfit).toLocaleString("en-US")}. Walk-away = after costs − minimum profit. Target opening = walk-away × (1 − ${Math.round(settings.openingDiscount * 100)}% opening discount).${lowConfidenceHaircut ? ` Low confidence also shaves the walk-away by ${Math.round(lowConfidenceHaircut * 100)}%.` : ""}`,
    result:
      walkAway == null || target == null
        ? "No offer"
        : `Target $${target.toLocaleString("en-US")} · walk-away $${walkAway.toLocaleString("en-US")}`,
  });

  steps.push({
    step: 8,
    title: "Confidence",
    detail: reasons.join(" "),
    result: level === "high" ? "High" : level === "medium" ? "Medium" : "Low",
  });

  if (intake.roadAccess === "landlocked") {
    flags.push({
      severity: "stop",
      text: "Landlocked. Do not offer until a recorded, buildable access is in the file.",
    });
  } else if (intake.roadAccess === "easement") {
    flags.push({
      severity: "watch",
      text: "Access is an easement. Confirm it is recorded, runs with the land, and is wide enough to build.",
    });
  } else if (intake.roadAccess === "dirt") {
    flags.push({
      severity: "info",
      text: "Dirt-road access is already in the feature adjustment.",
    });
  }

  if (share >= 0.2) {
    flags.push({
      severity: "watch",
      text: `About ${Math.round(share * 100)}% flood or standing water was priced as a feature hit. Confirm FEMA and what actually holds water.`,
    });
  } else if (share > 0) {
    flags.push({
      severity: "info",
      text: "Some water was reported and a small flood adjustment was applied.",
    });
  }

  if (!intake.power) {
    flags.push({ severity: "watch", text: "No power at the lot. Confirm the distance to a pole before you believe the adjustment." });
  }
  if (!intake.zoning.trim()) {
    flags.push({ severity: "watch", text: "Zoning or allowed use was not entered. Confirm it before contract." });
  }
  if (intake.hoa === "yes") {
    flags.push({ severity: "watch", text: "HOA or restrictions were priced. Read the documents." });
  } else if (intake.hoa === "unknown") {
    flags.push({ severity: "info", text: "HOA status is unknown. Ask before you assume there is none." });
  }
  if (intake.backTaxes > 0) {
    flags.push({
      severity: "info",
      text: `Back taxes of $${Math.round(intake.backTaxes).toLocaleString("en-US")} are in the cost stack. Confirm the payoff.`,
    });
  }
  if (intake.liens > 0 || intake.mortgage > 0) {
    flags.push({
      severity: "watch",
      text: "A lien or mortgage was subtracted. The title company has to confirm those payoffs.",
    });
  }
  if (intake.ownerType !== "person") {
    flags.push({
      severity: "stop",
      text: `Owner is ${intake.ownerType === "company" ? "a company" : `an ${intake.ownerType}`}. Confirm who can sign before any offer. This is a compliance hold, not a reason to put a price in a cold message.`,
    });
  }
  if (intake.survey !== "yes") {
    flags.push({
      severity: "info",
      text: intake.survey === "no"
        ? "No survey on file. Survey cost stays in the stack, and acreage is only as good as the intake."
        : "Survey status is unknown. Do not treat acreage as final.",
    });
  }
  if (intake.clearTitle === "no") {
    flags.push({ severity: "stop", text: "Title is not clear. The unclear-title adjustment is not a substitute for a title commitment." });
  } else if (intake.clearTitle === "unknown") {
    flags.push({ severity: "watch", text: "Title was not confirmed." });
  }
  if (input.parcel.acres != null && Math.abs(input.parcel.acres - intake.acres) / intake.acres > 0.05) {
    flags.push({
      severity: "watch",
      text: `You entered ${intake.acres} acres. The demo parcel profile says ${input.parcel.acres}. The offer uses the acres you typed.`,
    });
  }
  if (verified.band?.crossedCounty) {
    flags.push({ severity: "watch", text: "Comps were allowed from outside the subject county." });
  }
  if (input.synthetic) {
    flags.push({
      severity: "stop",
      text: "These comps are synthetic demo data for an address outside the fixture set. Do not use them as a market opinion.",
    });
  }
  if (droppedPrices.length) {
    flags.push({
      severity: "info",
      text: "At least one sale was removed as a price-per-acre outlier. The rejected table shows which one.",
    });
  }

  let withheld = verified.insufficient;
  let withholdReason: string | null = verified.insufficient
    ? "Insufficient comps — needs human review"
    : null;
  if (intake.roadAccess === "landlocked") {
    withheld = true;
    if (!withholdReason) withholdReason = "Landlocked parcels do not get an offer from this worksheet.";
  }
  if (walkAway != null && walkAway <= 0 && enough && intake.roadAccess !== "landlocked") {
    withheld = true;
    withholdReason = "After costs and minimum profit, the walk-away is not positive.";
  }

  if (withheld && withholdReason) {
    flags.unshift({ severity: "stop", text: withholdReason });
  } else if (level !== "high") {
    flags.unshift({
      severity: level === "low" ? "stop" : "watch",
      text: "Human review before this range is quoted to anyone.",
    });
  }

  if (
    !withheld &&
    intake.askingPrice != null &&
    walkAway != null &&
    intake.askingPrice > walkAway
  ) {
    flags.push({
      severity: "watch",
      text: `The seller's ask (${`$${Math.round(intake.askingPrice).toLocaleString("en-US")}`}) is above the walk-away.`,
    });
  }

  const publishedTarget = withheld ? null : target;
  const publishedWalk = withheld ? null : walkAway;

  return {
    kind: "report",
    provider: "demo",
    synthetic: input.synthetic,
    analyzedAt: input.asOf.toISOString(),
    settings,
    parcelNotes: input.providerNotes,
    verificationNotes: verified.notes,
    kept,
    rejected: verified.rejected,
    band: verified.band,
    steps,
    flags,
    confidence: level,
    confidenceReasons: reasons,
    humanReview: level !== "high" || withheld,
    withheld,
    withholdReason,
    offer: {
      target: publishedTarget,
      walkAway: publishedWalk,
      marketValue,
      adjustedPricePerAcre: adjustedPrice,
      calculatedTarget: target,
      calculatedWalkAway: walkAway,
    },
    math: {
      pricesPerAcre: prices,
      droppedPricesPerAcre: droppedPrices,
      medianPricePerAcre: med,
      averageCompAcres,
      sizeAdjustment,
      pricePerAcreAfterSize: priceAfterSize,
      featureLines,
      featureAdjustment,
      adjustedPricePerAcre: adjustedPrice,
      marketValue,
      exitFactor,
      exitValue,
      costLines,
      totalCosts,
      afterCosts,
      minProfit,
      openingDiscount: settings.openingDiscount,
      lowConfidenceHaircut,
      spread,
      maxMiles,
      maxMonths,
      walkAway,
      target,
    },
  };
}
