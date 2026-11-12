"use client";

import { useActionState, useState } from "react";
import { ComplianceNote } from "@/components/compliance-note";
import { Button, Field, Input, Select, Textarea } from "@/components/ui";
import { createDealAction, type ActionState } from "@/lib/actions";
import { PILOT_MARKET, SAMPLE_PARCELS, blankIntake } from "@/lib/samples";
import {
  ACCESS_LABELS,
  EXIT_LABELS,
  FLOOD_LABELS,
  OWNER_LABELS,
  ROAD_ACCESS,
  EXIT_STRATEGIES,
  FLOOD_CONDITIONS,
  OWNER_TYPES,
  type DealIntake,
} from "@/lib/types";

export function DealForm({ initial }: { initial: DealIntake }) {
  const [draft, setDraft] = useState<DealIntake>(initial);
  const [state, action, pending] = useActionState<ActionState, FormData>(createDealAction, {});

  function set<K extends keyof DealIntake>(key: K, value: DealIntake[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  return (
    <form action={action} className="space-y-6">
      <div className="flex flex-wrap gap-2">
        {SAMPLE_PARCELS.map((sample) => (
          <button
            key={sample.id}
            type="button"
            onClick={() => setDraft(sample.intake)}
            className="rounded-full border border-line bg-card px-3 py-1.5 text-left text-xs hover:border-pine"
          >
            <span className="font-medium">{sample.title}</span>
            <span className="mt-0.5 block text-muted">{sample.blurb}</span>
          </button>
        ))}
        <button type="button" onClick={() => setDraft(blankIntake)} className="rounded-full border border-line px-3 py-1.5 text-xs text-muted">
          Clear
        </button>
      </div>

      <ComplianceNote />
      {state.error ? <p className="rounded-md bg-stop-soft px-3 py-2 text-sm text-stop">{state.error}</p> : null}

      <section className="grid gap-4 rounded-lg border border-line bg-card p-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <h2 className="font-semibold">Parcel</h2>
          <p className="text-sm text-muted">Address or APN. Acreage is what the offer multiplies.</p>
        </div>
        <Field label="Address" hint="Try a sample above, or any other line for synthetic demo comps.">
          <Input name="address" value={draft.address} onChange={(event) => set("address", event.target.value)} placeholder="4120 Township Road 215, Coshocton, OH 43812" />
        </Field>
        <Field label="APN">
          <Input name="apn" value={draft.apn} onChange={(event) => set("apn", event.target.value)} placeholder="012-000345-00" />
        </Field>
        <Field label="County" hint={`Pilot market: ${PILOT_MARKET.label}.`}>
          <Input name="county" value={draft.county} onChange={(event) => set("county", event.target.value)} />
        </Field>
        <Field label="State">
          <Input name="state" value={draft.state} maxLength={2} onChange={(event) => set("state", event.target.value.toUpperCase())} />
        </Field>
        <Field label="Acreage">
          <Input name="acres" type="number" min="0.01" step="0.01" value={draft.acres} onChange={(event) => set("acres", Number(event.target.value))} required />
        </Field>
        <Field label="Exit">
          <Select name="exitStrategy" value={draft.exitStrategy} onChange={(event) => set("exitStrategy", event.target.value as DealIntake["exitStrategy"])}>
            {EXIT_STRATEGIES.map((exit) => (
              <option key={exit} value={exit}>{EXIT_LABELS[exit]}</option>
            ))}
          </Select>
        </Field>
      </section>

      <section className="grid gap-4 rounded-lg border border-line bg-card p-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <h2 className="font-semibold">Land</h2>
        </div>
        <Field label="Road access">
          <Select name="roadAccess" value={draft.roadAccess} onChange={(event) => set("roadAccess", event.target.value as DealIntake["roadAccess"])}>
            {ROAD_ACCESS.map((access) => (
              <option key={access} value={access}>{ACCESS_LABELS[access]}</option>
            ))}
          </Select>
        </Field>
        <Field label="Flooding">
          <Select name="flood" value={draft.flood} onChange={(event) => set("flood", event.target.value as DealIntake["flood"])}>
            {FLOOD_CONDITIONS.map((flood) => (
              <option key={flood} value={flood}>{FLOOD_LABELS[flood]}</option>
            ))}
          </Select>
        </Field>
        <Field label="Flood or water share (%)" hint="The EXAMPLE Coshocton tract uses 20, which becomes a −10% hit at the default penalty.">
          <Input name="floodPct" type="number" min="0" max="100" step="1" value={draft.floodPct} onChange={(event) => set("floodPct", Number(event.target.value))} />
        </Field>
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">Utilities at the lot</legend>
          <Check name="power" label="Power" checked={draft.power} onChange={(checked) => set("power", checked)} />
          <Check name="water" label="Water" checked={draft.water} onChange={(checked) => set("water", checked)} />
          <Check name="sewer" label="Sewer or septic / perc" checked={draft.sewer} onChange={(checked) => set("sewer", checked)} />
        </fieldset>
        <Field label="Zoning or use, if known">
          <Input name="zoning" value={draft.zoning} onChange={(event) => set("zoning", event.target.value)} placeholder="Leave blank if unknown" />
        </Field>
        <Field label="HOA or restrictions">
          <Select name="hoa" value={draft.hoa} onChange={(event) => set("hoa", event.target.value as DealIntake["hoa"])}>
            <option value="no">No</option>
            <option value="yes">Yes</option>
            <option value="unknown">Unknown</option>
          </Select>
        </Field>
      </section>

      <section className="grid gap-4 rounded-lg border border-line bg-card p-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <h2 className="font-semibold">Money, seller, title</h2>
        </div>
        <Field label="Back taxes ($)">
          <Input name="backTaxes" type="number" min="0" step="1" value={draft.backTaxes} onChange={(event) => set("backTaxes", Number(event.target.value))} />
        </Field>
        <Field label="Liens ($)" hint="Subtracted when you enter them.">
          <Input name="liens" type="number" min="0" step="1" value={draft.liens} onChange={(event) => set("liens", Number(event.target.value))} />
        </Field>
        <Field label="Mortgage owed ($)">
          <Input name="mortgage" type="number" min="0" step="1" value={draft.mortgage} onChange={(event) => set("mortgage", Number(event.target.value))} />
        </Field>
        <Field label="Asking price ($)">
          <Input
            name="askingPrice"
            type="number"
            min="0"
            step="1"
            value={draft.askingPrice ?? ""}
            onChange={(event) => set("askingPrice", event.target.value === "" ? null : Number(event.target.value))}
          />
        </Field>
        <Field label="Timeline">
          <Input name="timeline" value={draft.timeline} onChange={(event) => set("timeline", event.target.value)} />
        </Field>
        <Field label="Owner">
          <Select name="ownerType" value={draft.ownerType} onChange={(event) => set("ownerType", event.target.value as DealIntake["ownerType"])}>
            {OWNER_TYPES.map((owner) => (
              <option key={owner} value={owner}>{OWNER_LABELS[owner]}</option>
            ))}
          </Select>
        </Field>
        <Field label="Why selling" hint="">
          <Textarea name="whySelling" value={draft.whySelling} onChange={(event) => set("whySelling", event.target.value)} />
        </Field>
        <Field label="Survey on file">
          <Select name="survey" value={draft.survey} onChange={(event) => set("survey", event.target.value as DealIntake["survey"])}>
            <option value="yes">Yes</option>
            <option value="no">No</option>
            <option value="unknown">Unknown</option>
          </Select>
        </Field>
        <Field label="Clear title">
          <Select name="clearTitle" value={draft.clearTitle} onChange={(event) => set("clearTitle", event.target.value as DealIntake["clearTitle"])}>
            <option value="yes">Yes</option>
            <option value="no">No</option>
            <option value="unknown">Unknown</option>
          </Select>
        </Field>
      </section>

      <section className="rounded-lg border border-line bg-card p-4">
        <h2 className="font-semibold">Comps provider</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="flex gap-3 rounded-md border border-line p-3">
            <input type="radio" name="provider" value="demo" checked={draft.provider === "demo"} onChange={() => set("provider", "demo")} />
            <span>
              <span className="block text-sm font-medium">Demo fixtures</span>
              <span className="block text-xs leading-5 text-muted">Ohio sample sales, or synthetic filler if the address is not in the set. No API key.</span>
            </span>
          </label>
          <label className="flex gap-3 rounded-md border border-line p-3">
            <input type="radio" name="provider" value="land_portal" checked={draft.provider === "land_portal"} onChange={() => set("provider", "land_portal")} />
            <span>
              <span className="block text-sm font-medium">Land Portal (live)</span>
              <span className="block text-xs leading-5 text-muted">Real sold comps by APN + state. Needs LAND_PORTAL_API_KEY; the report builds asynchronously, so a first run may say pending.</span>
            </span>
          </label>
        </div>
      </section>

      <Button type="submit" disabled={pending}>
        {pending ? "Running the buy box…" : "Run buy box"}
      </Button>
    </form>
  );
}

function Check({
  name,
  label,
  checked,
  onChange,
}: {
  name: string;
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <input
        type="checkbox"
        name={name}
        value="on"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="h-4 w-4 accent-pine"
      />
      {label}
    </label>
  );
}
