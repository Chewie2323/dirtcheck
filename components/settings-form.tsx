"use client";

import { useActionState } from "react";
import { Badge, Button, Field, Input } from "@/components/ui";
import { resetSettingsAction, saveSettingsAction, type ActionState } from "@/lib/actions";
import type { OrgSettings } from "@/lib/settings";

export function SettingsForm({
  name,
  settings,
  saved,
  reset,
}: {
  name: string;
  settings: OrgSettings;
  saved: boolean;
  reset: boolean;
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(saveSettingsAction, {});

  return (
    <form action={action} className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Badge tone="example">Mixed defaults</Badge>
        <p className="text-sm text-muted">
          Exit factors and minimum profit are the workspace defaults. Due-diligence costs, the size curve, and feature adjustments are still EXAMPLE figures from the Nov 4, 2026 draft.
        </p>
      </div>
      {saved ? <p className="rounded-md bg-moss px-3 py-2 text-sm text-pine">Workspace factors saved. Re-run a deal to apply them.</p> : null}
      {reset ? <p className="rounded-md bg-gold-soft px-3 py-2 text-sm text-gold">Restored the workspace defaults.</p> : null}
      {state.error ? <p className="rounded-md bg-stop-soft px-3 py-2 text-sm text-stop">{state.error}</p> : null}

      <section className="rounded-lg border border-line bg-card p-4">
        <Field label="Workspace name">
          <Input name="workspaceName" defaultValue={name} required />
        </Field>
      </section>

      <Section title="Exit factors" text="Share of adjusted market value the exit can support. Defaults: wholesale 50%, retail flip 60%, seller finance 75%, subdivide 55%.">
        <Num name="exit.wholesale" label="Wholesale" defaultValue={settings.exitFactors.wholesale} step="0.01" />
        <Num name="exit.retail_flip" label="Retail flip" defaultValue={settings.exitFactors.retail_flip} step="0.01" />
        <Num name="exit.seller_finance" label="Seller finance" defaultValue={settings.exitFactors.seller_finance} step="0.01" />
        <Num name="exit.subdivide" label="Subdivide" defaultValue={settings.exitFactors.subdivide} step="0.01" />
      </Section>

      <Section title="Minimum profit" text="Subtracted after costs on every deal. The default is $3,000 for each exit.">
        <Num name="profit.wholesale" label="Wholesale ($)" defaultValue={settings.minProfit.wholesale} step="100" />
        <Num name="profit.retail_flip" label="Retail flip ($)" defaultValue={settings.minProfit.retail_flip} step="100" />
        <Num name="profit.seller_finance" label="Seller finance ($)" defaultValue={settings.minProfit.seller_finance} step="100" />
        <Num name="profit.subdivide" label="Subdivide ($)" defaultValue={settings.minProfit.subdivide} step="100" />
      </Section>

      <Section title="Due diligence costs" text="Closing, title, survey, and holding. Survey drops to $0 when the intake says a survey is on file. EXAMPLE closing $1,500, survey $800, holding $0.">
        <Num name="cost.closingTitle" label="Closing and title ($)" defaultValue={settings.costs.closingTitle} step="50" />
        <Num name="cost.survey" label="Survey ($)" defaultValue={settings.costs.survey} step="50" />
        <Num name="cost.holding" label="Holding ($)" defaultValue={settings.costs.holding} step="50" />
      </Section>

      <Section title="Size curve" text="Adjustment = −(subject acres ÷ average comp acres − 1) × elasticity. EXAMPLE elasticity 0.15 makes 5 acres against a 3-acre set a −10% hit.">
        <Num name="sizeElasticity" label="Elasticity" defaultValue={settings.sizeElasticity} step="0.01" />
        <Num name="sizeClamp.min" label="Clamp min" defaultValue={settings.sizeClamp.min} step="0.01" />
        <Num name="sizeClamp.max" label="Clamp max" defaultValue={settings.sizeClamp.max} step="0.01" />
      </Section>

      <Section title="Feature adjustments" text="Fractions, not percents. −0.10 is minus 10%. They add together. Flood penalty is per share of the tract, so 20% flood × 0.50 = −10%.">
        <Num name="access.paved" label="Paved" defaultValue={settings.accessAdjustments.paved} step="0.01" />
        <Num name="access.dirt" label="Dirt road" defaultValue={settings.accessAdjustments.dirt} step="0.01" />
        <Num name="access.easement" label="Easement" defaultValue={settings.accessAdjustments.easement} step="0.01" />
        <Num name="access.landlocked" label="Landlocked" defaultValue={settings.accessAdjustments.landlocked} step="0.01" />
        <Num name="floodPenaltyPerShare" label="Flood penalty per share" defaultValue={settings.floodPenaltyPerShare} step="0.01" />
        <Num name="utility.full" label="Power, water, sewer/septic" defaultValue={settings.utilityAdjustments.full} step="0.01" />
        <Num name="utility.power_water" label="Power and water" defaultValue={settings.utilityAdjustments.power_water} step="0.01" />
        <Num name="utility.power" label="Power only" defaultValue={settings.utilityAdjustments.power} step="0.01" />
        <Num name="utility.none" label="No power" defaultValue={settings.utilityAdjustments.none} step="0.01" />
        <Num name="hoaAdjustment" label="HOA, if yes" defaultValue={settings.hoaAdjustment} step="0.01" />
        <Num name="unclearTitleAdjustment" label="Title not clear" defaultValue={settings.unclearTitleAdjustment} step="0.01" />
        <Num name="featureClamp.min" label="Feature clamp min" defaultValue={settings.featureClamp.min} step="0.01" />
        <Num name="featureClamp.max" label="Feature clamp max" defaultValue={settings.featureClamp.max} step="0.01" />
      </Section>

      <Section title="Comp screens and opening bid" text="If fewer than 3 comps survive, the search widens distance first, then time up to 36 months, then the acreage band. Each widening step drops confidence one level. Still under 3 means no offer. 1.5×IQR drops price outliers. Target = walk-away × (1 − opening discount).">
        <Field label="Distance bands (miles)" hint="Widest last. The search starts at the first value. Default 5, 15, 30.">
          <Input name="distanceMilesBands" defaultValue={settings.distanceMilesBands.join(", ")} />
        </Field>
        <Field label="Acreage bands" hint="Comma-separated fractions, widest last. EXAMPLE 0.2, 0.35, 0.5">
          <Input name="acreageBands" defaultValue={settings.acreageBands.join(", ")} />
        </Field>
        <Field label="Recency bands (months)" hint="EXAMPLE 12, 24, 36">
          <Input name="recencyMonthsBands" defaultValue={settings.recencyMonthsBands.join(", ")} />
        </Field>
        <Num name="outlierIqrMultiplier" label="IQR multiplier" defaultValue={settings.outlierIqrMultiplier} step="0.1" />
        <Num name="openingDiscount" label="Opening discount" defaultValue={settings.openingDiscount} step="0.01" />
        <Num name="lowConfidenceExtraDiscount" label="Extra shave when confidence is low" defaultValue={settings.lowConfidenceExtraDiscount} step="0.01" />
      </Section>

      <Section title="Confidence thresholds" text="High has to clear every high limit. Otherwise medium, then low. Spread is half the price-per-acre range divided by the median.">
        <Num name="high.minComps" label="High: min comps" defaultValue={settings.confidence.high.minComps} step="1" />
        <Num name="high.maxSpread" label="High: max spread" defaultValue={settings.confidence.high.maxSpread} step="0.01" />
        <Num name="high.maxMiles" label="High: max miles" defaultValue={settings.confidence.high.maxMiles} step="1" />
        <Num name="high.maxMonths" label="High: max months" defaultValue={settings.confidence.high.maxMonths} step="1" />
        <Num name="medium.minComps" label="Medium: min comps" defaultValue={settings.confidence.medium.minComps} step="1" />
        <Num name="medium.maxSpread" label="Medium: max spread" defaultValue={settings.confidence.medium.maxSpread} step="0.01" />
        <Num name="medium.maxMiles" label="Medium: max miles" defaultValue={settings.confidence.medium.maxMiles} step="1" />
        <Num name="medium.maxMonths" label="Medium: max months" defaultValue={settings.confidence.medium.maxMonths} step="1" />
      </Section>

      <div className="flex flex-wrap gap-3">
        <Button type="submit" disabled={pending}>{pending ? "Saving…" : "Save workspace factors"}</Button>
        <button formAction={resetSettingsAction} className="h-10 rounded-md border border-line bg-card px-4 text-sm" type="submit">
          Reset to workspace defaults
        </button>
      </div>
    </form>
  );
}

function Section({ title, text, children }: { title: string; text: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4 rounded-lg border border-line bg-card p-4">
      <div>
        <h2 className="font-semibold">{title}</h2>
        <p className="mt-1 text-sm leading-6 text-muted">{text}</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </section>
  );
}

function Num({ name, label, defaultValue, step }: { name: string; label: string; defaultValue: number; step: string }) {
  return (
    <Field label={label}>
      <Input name={name} type="number" step={step} defaultValue={defaultValue} />
    </Field>
  );
}
