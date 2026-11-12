import type { OrgSettings } from "../settings";
import { iqrFences, monthsBetween, normCounty } from "../stats";
import type { LandComp, RoadAccess } from "../types";

export interface SubjectFilter {
  county: string;
  state: string;
  acres: number;
  roadAccess: RoadAccess;
}

export interface ReviewedComp extends LandComp {
  pricePerAcre: number;
  ageMonths: number;
  reasons: string[];
}

export interface WideningStep {
  label: string;
  survivors: number;
}

export interface VerifiedSet {
  kept: ReviewedComp[];
  rejected: ReviewedComp[];
  notes: string[];
  wideningSteps: WideningStep[];
  insufficient: boolean;
  band: { acreagePct: number; months: number; maxMiles: number; crossedCounty: boolean } | null;
  fence: { low: number; high: number } | null;
}

interface SearchWindow {
  maxMiles: number;
  maxMonths: number;
  acreagePct: number;
}

function prelimReason(comp: LandComp, subject: SubjectFilter): string | null {
  if (comp.distress || comp.salePrice <= 100 || !comp.armLength) {
    return "Dropped as non-arm's-length or a nominal deed (quitclaim, tax or sheriff sale, or a price of $100 or less).";
  }
  if (comp.hasHouse) {
    return "Dropped because a house sold with the land. Vacant-land comps only.";
  }
  if (comp.bundle) {
    return "Dropped as a multi-parcel bundle.";
  }
  if (subject.state && comp.state && subject.state.toUpperCase() !== comp.state.toUpperCase()) {
    return "Dropped because the sale is in a different state.";
  }
  const subjectLocked = subject.roadAccess === "landlocked";
  const compLocked = comp.roadAccess === "landlocked";
  if (subjectLocked !== compLocked) {
    return "Dropped because landlocked ground is not a comp for road-front ground, or the reverse.";
  }
  return null;
}

function withinAcreage(compAcres: number, subjectAcres: number, band: number): boolean {
  const low = subjectAcres * (1 - band);
  const high = subjectAcres * (1 + band);
  return compAcres >= low - 1e-6 && compAcres <= high + 1e-6;
}

function sameCounty(comp: LandComp, subject: SubjectFilter): boolean {
  const wanted = normCounty(subject.county);
  if (!wanted) return true;
  return normCounty(comp.county) === wanted;
}

export function verifyComps(input: {
  subject: SubjectFilter;
  comps: LandComp[];
  settings: OrgSettings;
  asOf: Date;
}): VerifiedSet {
  const notes: string[] = [];
  const rejected: ReviewedComp[] = [];
  const pool: ReviewedComp[] = [];

  for (const comp of input.comps) {
    const reviewed: ReviewedComp = {
      ...comp,
      pricePerAcre: comp.acres > 0 ? comp.salePrice / comp.acres : 0,
      ageMonths: monthsBetween(comp.saleDate, input.asOf),
      reasons: [],
    };
    const reason = prelimReason(comp, input.subject);
    if (reason) {
      reviewed.reasons = [reason];
      rejected.push(reviewed);
    } else {
      pool.push(reviewed);
    }
  }

  const windows = searchWindows(input.settings);
  const wideningSteps: WideningStep[] = [];
  let chosen: ReviewedComp[] = [];
  let kept: ReviewedComp[] = [];
  let fence: ReturnType<typeof iqrFences> = null;
  let bandUsed: VerifiedSet["band"] = null;
  let stopped = false;

  for (let index = 0; index < windows.length; index += 1) {
    if (stopped) break;
    const window = windows[index];
    const subset = pool.filter((comp) => inWindow(comp, input.subject, window));
    const screened = dropPriceOutliers(subset, input.settings.outlierIqrMultiplier);
    const survivors = screened.kept.length;
    if (index === 0) {
      notes.push(
        `Tight search: within ${window.maxMiles} miles, ${window.maxMonths} months, ±${Math.round(window.acreagePct * 100)}% acreage — ${survivors} verified ${survivors === 1 ? "comp" : "comps"}.`,
      );
    } else {
      const previous = windows[index - 1];
      const label = wideningLabel(previous, window);
      wideningSteps.push({ label, survivors });
      notes.push(`${label} — ${survivors} verified ${survivors === 1 ? "comp" : "comps"}.`);
    }
    chosen = subset;
    kept = screened.kept;
    fence = screened.fence;
    bandUsed = {
      acreagePct: window.acreagePct,
      months: window.maxMonths,
      maxMiles: window.maxMiles,
      crossedCounty: false,
    };
    if (survivors >= 3) stopped = true;
  }

  if (fence) {
    const outliers = chosen.filter(
      (comp) => comp.pricePerAcre < fence!.low || comp.pricePerAcre > fence!.high,
    );
    for (const outlier of outliers) {
      rejected.push({
        ...outlier,
        reasons: [
          `Price per acre sits outside the ${input.settings.outlierIqrMultiplier}×IQR fence (${Math.round(fence.low).toLocaleString("en-US")}–${Math.round(fence.high).toLocaleString("en-US")} $/acre).`,
        ],
      });
    }
    if (outliers.length) {
      notes.push(
        `Removed ${outliers.length} price ${outliers.length === 1 ? "outlier" : "outliers"} outside ${input.settings.outlierIqrMultiplier}×IQR.`,
      );
    }
  } else if (chosen.length > 0 && chosen.length < 4) {
    notes.push("Outlier screen needs at least 4 comps, so it was skipped.");
  }

  const insufficient = kept.length < 3;
  if (insufficient) {
    notes.push("Insufficient comps — needs human review. No offer.");
  }

  const outside = pool.filter((comp) => !chosen.includes(comp));
  for (const comp of outside) {
    rejected.push({
      ...comp,
      reasons: [
        `Outside the search that was used (within ${bandUsed?.maxMiles ?? 30} miles, ${bandUsed?.months ?? 36} months, ±${Math.round((bandUsed?.acreagePct ?? 0.5) * 100)}% acreage, same county).`,
      ],
    });
  }

  kept.sort((a, b) => a.distanceMiles - b.distanceMiles || a.ageMonths - b.ageMonths);
  const capped = kept.slice(0, 6);
  if (kept.length > 6) {
    notes.push(`Kept the 6 closest of ${kept.length} survivors.`);
    for (const extra of kept.slice(6)) {
      rejected.push({
        ...extra,
        reasons: ["Passed the screens but ranked outside the closest 6."],
      });
    }
  }

  const bandLabel = bandUsed
    ? `±${Math.round(bandUsed.acreagePct * 100)}% acreage and ${bandUsed.months} months`
    : "the widest band";
  for (const comp of capped) {
    comp.reasons = [
      "Same county.",
      bandUsed ? `Within ${bandUsed.maxMiles} miles.` : "Distance was not limited.",
      `Acreage is inside ${bandLabel}.`,
      "Arm's-length vacant sale.",
      fence
        ? "Price per acre is inside the IQR fence."
        : "Kept without an IQR screen.",
    ];
  }

  notes.push(`${capped.length} verified ${capped.length === 1 ? "comp" : "comps"} after screens.`);

  return {
    kept: capped,
    rejected,
    notes,
    wideningSteps,
    insufficient,
    band: bandUsed,
    fence: fence ? { low: fence.low, high: fence.high } : null,
  };
}

function searchWindows(settings: OrgSettings): SearchWindow[] {
  const distances = settings.distanceMilesBands.length ? settings.distanceMilesBands : [5];
  const months = settings.recencyMonthsBands.length ? settings.recencyMonthsBands : [36];
  const acres = settings.acreageBands.length ? settings.acreageBands : [0.5];
  const windows: SearchWindow[] = [];
  const push = (distanceIndex: number, monthIndex: number, acreIndex: number) => {
    windows.push({
      maxMiles: distances[distanceIndex],
      maxMonths: months[monthIndex],
      acreagePct: acres[acreIndex],
    });
  };
  let distanceIndex = 0;
  let monthIndex = 0;
  let acreIndex = 0;
  push(distanceIndex, monthIndex, acreIndex);
  while (distanceIndex + 1 < distances.length) {
    distanceIndex += 1;
    push(distanceIndex, monthIndex, acreIndex);
  }
  while (monthIndex + 1 < months.length) {
    monthIndex += 1;
    push(distanceIndex, monthIndex, acreIndex);
  }
  while (acreIndex + 1 < acres.length) {
    acreIndex += 1;
    push(distanceIndex, monthIndex, acreIndex);
  }
  return windows;
}

function inWindow(comp: ReviewedComp, subject: SubjectFilter, window: SearchWindow): boolean {
  return (
    comp.distanceMiles <= window.maxMiles + 1e-6 &&
    comp.ageMonths <= window.maxMonths + 0.05 &&
    comp.ageMonths >= -0.05 &&
    withinAcreage(comp.acres, subject.acres, window.acreagePct) &&
    sameCounty(comp, subject)
  );
}

function dropPriceOutliers(
  chosen: ReviewedComp[],
  multiplier: number,
): { kept: ReviewedComp[]; fence: ReturnType<typeof iqrFences> } {
  const fence = iqrFences(
    chosen.map((comp) => comp.pricePerAcre),
    multiplier,
  );
  if (!fence) return { kept: chosen, fence: null };
  return {
    kept: chosen.filter((comp) => comp.pricePerAcre >= fence.low && comp.pricePerAcre <= fence.high),
    fence,
  };
}

function wideningLabel(previous: SearchWindow, next: SearchWindow): string {
  if (next.maxMiles !== previous.maxMiles) {
    return `Widened distance from ${previous.maxMiles} to ${next.maxMiles} miles`;
  }
  if (next.maxMonths !== previous.maxMonths) {
    return `Widened time from ${previous.maxMonths} to ${next.maxMonths} months`;
  }
  return `Widened acreage band from ±${Math.round(previous.acreagePct * 100)}% to ±${Math.round(next.acreagePct * 100)}%`;
}
