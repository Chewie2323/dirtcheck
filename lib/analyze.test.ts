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

  describe("Land Portal client", () => {
    const query = { address: "1 Main St", apn: "99-1", county: "Coshocton", state: "OH", acres: 5, asOf };
    const realFetch = globalThis.fetch;
    const realKey = process.env.LAND_PORTAL_API_KEY;
    const json = (body: unknown, status = 200) =>
      new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
    const restore = () => {
      globalThis.fetch = realFetch;
      if (realKey === undefined) delete process.env.LAND_PORTAL_API_KEY;
      else process.env.LAND_PORTAL_API_KEY = realKey;
    };

    it("reports not configured without a key and sends no request", async () => {
      delete process.env.LAND_PORTAL_API_KEY;
      let calls = 0;
      globalThis.fetch = (async () => { calls++; return json({}); }) as typeof fetch;
      try {
        const out = await landPortalCompsProvider.fetch(query);
        assert.equal(out.ok, false);
        if (!out.ok) assert.equal(out.status, "not_configured");
        assert.equal(calls, 0);
      } finally { restore(); }
    });

    it("requires an APN", async () => {
      process.env.LAND_PORTAL_API_KEY = "test-key";
      try {
        const out = await landPortalCompsProvider.fetch({ ...query, apn: "" });
        assert.equal(out.ok, false);
        if (!out.ok) assert.match(out.message, /APN/);
      } finally { restore(); }
    });

    it("resolves, reads the report, and maps comps with Bearer auth", async () => {
      process.env.LAND_PORTAL_API_KEY = "test-key";
      const seen: { url: string; auth: string | null; method: string }[] = [];
      globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
        const u = String(url);
        seen.push({ url: u, auth: new Headers(init?.headers).get("authorization"), method: init?.method ?? "GET" });
        if (u.includes("/search")) return json({ results: [{ propertyid: "P1", fips: "39031", county: "Coshocton", acres: 5.2 }] });
        return json({ comps: [
          { sale_price: "$25,000", acres: 5, sale_date: "2026-03-01", distance: 3.2, address: "A Rd" },
          { sale_price: 0, acres: 5, sale_date: "2026-03-01" },
        ] });
      }) as typeof fetch;
      try {
        const out = await landPortalCompsProvider.fetch(query);
        assert.equal(out.ok, true);
        if (out.ok) {
          assert.equal(out.comps.length, 1);
          assert.equal(out.comps[0].salePrice, 25000);
          assert.equal(out.comps[0].distanceMiles, 3.2);
          assert.equal(out.parcel.fips, "39031");
        }
        assert.ok(seen.every((r) => r.auth === "Bearer test-key"));
        assert.ok(seen[0].url.includes("type=parcelnumb"));
        assert.ok(!seen.some((r) => r.method === "POST"));
      } finally { restore(); }
    });

    it("never fabricates comps from an unreadable report", async () => {
      process.env.LAND_PORTAL_API_KEY = "test-key";
      globalThis.fetch = (async (url: string | URL | Request) =>
        String(url).includes("/search") ? json([{ propertyid: "P1", fips: "39031" }]) : json({ weird: { shape: true } })) as typeof fetch;
      try {
        const out = await landPortalCompsProvider.fetch(query);
        assert.equal(out.ok, false);
        if (!out.ok) assert.match(out.message, /could not read/);
      } finally { restore(); }
    });

    it("surfaces a rejected key", async () => {
      process.env.LAND_PORTAL_API_KEY = "bad";
      globalThis.fetch = (async () => json({}, 401)) as typeof fetch;
      try {
        const out = await landPortalCompsProvider.fetch(query);
        assert.equal(out.ok, false);
        if (!out.ok) assert.match(out.message, /rejected the API key/);
      } finally { restore(); }
    });
  });
});
