import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { analyzeIntake } from "./analyze";
import { buildBuyBox } from "./buybox/engine";
import { landPortalCompsProvider } from "./comps/land-portal";
import { verifyComps } from "./comps/verify";
import { SAMPLE_PARCELS } from "./samples";
import { EXAMPLE_SETTINGS } from "./settings";
import type { LandComp } from "./types";

const asOf = new Date("2026-11-05T12:00:00Z");

describe("buy box", () => {
  it("reproduces the draft example on the Coshocton fixture", async () => {
    const sample = SAMPLE_PARCELS[0];
    const result = await analyzeIntake(sample.intake, EXAMPLE_SETTINGS, asOf);
    assert.equal(result.kind, "report");
    if (result.kind !== "report") return;
    assert.equal(result.synthetic, false);
    assert.equal(result.kept.length, 4);
    assert.equal(Math.round(result.math.medianPricePerAcre ?? 0), 10750);
    assert.ok(Math.abs(result.math.sizeAdjustment + 0.1) < 0.001);
    assert.ok(Math.abs((result.math.pricePerAcreAfterSize ?? 0) - 9675) < 1);
    assert.ok(Math.abs(result.math.featureAdjustment + 0.2) < 0.001);
    assert.ok(Math.abs((result.math.adjustedPricePerAcre ?? 0) - 7740) < 1);
    assert.equal(result.math.marketValue, 38700);
    assert.equal(result.math.exitValue, 19350);
    assert.equal(result.math.totalCosts, 3500);
    assert.equal(result.math.afterCosts, 15850);
    assert.equal(result.math.walkAway, 12850);
    assert.equal(result.math.target, 10923);
    assert.equal(result.confidence, "low");
    assert.ok(result.verificationNotes.some((note) => note.startsWith("Widened distance")));
    assert.ok(result.verificationNotes.some((note) => note.startsWith("Widened time")));
    assert.ok(result.verificationNotes.some((note) => note.startsWith("Widened acreage")));
    assert.equal(result.withheld, false);
    assert.equal(result.offer.target, 10923);
    assert.equal(result.offer.walkAway, 12850);
    assert.ok(result.rejected.some((comp) => comp.reasons.some((reason) => reason.includes("IQR"))));
    assert.ok(result.rejected.some((comp) => comp.hasHouse));
    assert.ok(result.rejected.some((comp) => comp.distress));
    assert.ok(result.rejected.some((comp) => comp.roadAccess === "landlocked"));
  });

  it("rates the Athens fixture high and the Meigs fixture low", async () => {
    const athens = await analyzeIntake(SAMPLE_PARCELS[1].intake, EXAMPLE_SETTINGS, asOf);
    const meigs = await analyzeIntake(SAMPLE_PARCELS[2].intake, EXAMPLE_SETTINGS, asOf);
    assert.equal(athens.kind, "report");
    assert.equal(meigs.kind, "report");
    if (athens.kind !== "report" || meigs.kind !== "report") return;
    assert.equal(athens.confidence, "high");
    assert.equal(athens.withheld, false);
    assert.ok((athens.offer.walkAway ?? 0) > 0);
    assert.equal(meigs.confidence, "low");
    assert.equal(meigs.withheld, false);
    assert.ok(meigs.flags.some((flag) => flag.text.toLowerCase().includes("estate")));
  });

  it("matches an APN without an address", async () => {
    const intake = { ...SAMPLE_PARCELS[0].intake, address: "" };
    const result = await analyzeIntake(intake, EXAMPLE_SETTINGS, asOf);
    assert.equal(result.kind, "report");
    if (result.kind !== "report") return;
    assert.equal(result.math.marketValue, 38700);
  });

  it("withholds an offer when widening still leaves fewer than 3 comps", () => {
    const comp: LandComp = {
      id: "only",
      address: "1 Far Road, Coshocton, OH",
      county: "Coshocton",
      state: "OH",
      acres: 5,
      salePrice: 50000,
      saleDate: "2026-08-01",
      distanceMiles: 2,
      roadAccess: "dirt",
      floodShare: 0,
      utilitiesNote: "Power",
      source: "demo",
      armLength: true,
      hasHouse: false,
      bundle: false,
      distress: false,
    };
    const verified = verifyComps({
      subject: { county: "Coshocton", state: "OH", acres: 5, roadAccess: "dirt" },
      comps: [comp],
      settings: EXAMPLE_SETTINGS,
      asOf,
    });
    const report = buildBuyBox({
      intake: SAMPLE_PARCELS[0].intake,
      parcel: {
        address: SAMPLE_PARCELS[0].intake.address,
        apn: SAMPLE_PARCELS[0].intake.apn,
        county: "Coshocton",
        state: "OH",
        acres: 5,
        fips: "39031",
        notes: [],
      },
      synthetic: false,
      providerNotes: [],
      verified,
      settings: EXAMPLE_SETTINGS,
      asOf,
    });
    assert.equal(verified.insufficient, true);
    assert.equal(report.withheld, true);
    assert.equal(report.withholdReason, "Insufficient comps — needs human review");
    assert.equal(report.offer.target, null);
    assert.equal(report.offer.walkAway, null);
  });

  it("does not call Land Portal", async () => {
    const previous = process.env.LAND_PORTAL_API_KEY;
    delete process.env.LAND_PORTAL_API_KEY;
    const stub = await landPortalCompsProvider.fetch({
      address: "1 Main St",
      apn: "99-1",
      county: "Coshocton",
      state: "OH",
      acres: 5,
      asOf,
    });
    assert.equal(stub.ok, false);
    assert.equal(stub.stub, true);
    assert.equal(stub.configured, false);
    assert.ok(stub.plannedCalls.some((call) => call.includes("POST") && call.includes("/reports")));
    assert.ok(stub.plannedCalls.some((call) => call.includes("/search?type=parcelnumb")));
    if (previous) process.env.LAND_PORTAL_API_KEY = previous;
  });
});
