import Link from "next/link";
import { ComplianceNote } from "@/components/compliance-note";
import { PlatMap } from "@/components/plat-map";
import { Badge } from "@/components/ui";
import { deleteDealAction, rerunDealAction } from "@/lib/actions";
import type { BuyBoxReport } from "@/lib/buybox/engine";
import { acresLabel, dealTitle, formatDate, money, ppa } from "@/lib/format";
import { ACCESS_LABELS, EXIT_LABELS, type DealIntake } from "@/lib/types";
import type { StubAnalysis } from "@/lib/analyze";

export function ReportView({
  dealId,
  intake,
  report,
}: {
  dealId: string;
  intake: DealIntake;
  report: BuyBoxReport;
}) {
  const title = dealTitle(intake.address, intake.apn);
  const confidenceTone = report.confidence;
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">Buy box</p>
          <h1 className="max-w-3xl font-serif text-3xl tracking-tight sm:text-4xl">{title}</h1>
          <p className="text-sm text-muted">
            {[intake.county ? `${intake.county} County` : null, intake.state, acresLabel(intake.acres), EXIT_LABELS[intake.exitStrategy], ACCESS_LABELS[intake.roadAccess]]
              .filter(Boolean)
              .join(" · ")}
          </p>
          <p className="text-sm text-muted">Analyzed {formatDate(report.analyzedAt)} · demo comps provider</p>
        </div>
        <Badge tone={confidenceTone}>{report.confidence} confidence</Badge>
      </div>

      <ComplianceNote />

      {report.withheld ? (
        <div className="rounded-lg border border-stop/30 bg-stop-soft px-4 py-3 text-sm leading-6 text-stop">
          <p className="font-semibold">No offer on this file.</p>
          <p>{report.withholdReason}</p>
        </div>
      ) : null}

      <section className="grid gap-3 md:grid-cols-3">
        <NumberCard label="Target opening" value={money(report.offer.target)} hint="Where a conversation can start" />
        <NumberCard label="Walk-away" value={money(report.offer.walkAway)} hint="Max after costs and minimum profit" />
        <NumberCard label="Market value" value={money(report.offer.marketValue)} hint="Comp-indicated retail, not an offer" />
      </section>

      <section className="grid gap-3 sm:grid-cols-3">
        <Mini label="Adjusted $/acre" value={ppa(report.math.adjustedPricePerAcre)} />
        <Mini label="Exit factor" value={`${Math.round(report.math.exitFactor * 100)}%`} />
        <Mini label="Verified comps" value={String(report.kept.length)} />
      </section>

      {report.flags.length ? (
        <ul className="grid gap-2">
          {report.flags.map((flag) => (
            <li
              key={flag.text}
              className={
                flag.severity === "stop"
                  ? "rounded-md border border-stop/30 bg-stop-soft px-3 py-2 text-sm text-stop"
                  : flag.severity === "watch"
                    ? "rounded-md border border-gold/30 bg-gold-soft px-3 py-2 text-sm text-gold"
                    : "rounded-md border border-line bg-card px-3 py-2 text-sm text-muted"
              }
            >
              <span className="mr-2 text-[10px] font-semibold uppercase tracking-[0.14em]">{flag.severity}</span>
              {flag.text}
            </li>
          ))}
        </ul>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="space-y-3">
          <h2 className="text-lg font-semibold tracking-tight">How the number was built</h2>
          <ol className="space-y-3">
            {report.steps.map((step) => (
              <li key={step.step} className="rounded-lg border border-line bg-card p-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">Step {step.step}</p>
                  <p className="font-serif text-xl tracking-tight">{step.result}</p>
                </div>
                <h3 className="mt-1 font-medium">{step.title}</h3>
                <p className="mt-2 text-sm leading-6 text-muted">{step.detail}</p>
              </li>
            ))}
          </ol>
        </section>
        <div className="space-y-4">
          <PlatMap
            subject={title}
            comps={[
              ...report.kept.map((comp) => ({
                id: comp.id,
                label: comp.address,
                distanceMiles: comp.distanceMiles,
                pricePerAcre: comp.pricePerAcre,
                kept: true,
              })),
              ...report.rejected.slice(0, 4).map((comp) => ({
                id: comp.id,
                label: comp.address,
                distanceMiles: comp.distanceMiles,
                pricePerAcre: comp.pricePerAcre,
                kept: false,
              })),
            ]}
          />
          <div className="rounded-lg border border-line bg-card p-4 text-sm leading-6 text-muted">
            {report.parcelNotes.map((note) => (
              <p key={note}>{note}</p>
            ))}
            {report.verificationNotes.map((note) => (
              <p key={note} className="mt-2">{note}</p>
            ))}
          </div>
        </div>
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold tracking-tight">Verified comps</h2>
        <CompTable rows={report.kept} empty="No comps survived the screens." />
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold tracking-tight">Rejected</h2>
        <div className="overflow-x-auto rounded-lg border border-line">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-paper-2 text-xs uppercase tracking-[0.12em] text-muted">
              <tr>
                <th className="px-3 py-2 font-medium">Address</th>
                <th className="px-3 py-2 font-medium">$/acre</th>
                <th className="px-3 py-2 font-medium">Why it left</th>
              </tr>
            </thead>
            <tbody>
              {report.rejected.length === 0 ? (
                <tr>
                  <td className="px-3 py-4 text-muted" colSpan={3}>Nothing was rejected.</td>
                </tr>
              ) : (
                report.rejected.map((comp) => (
                  <tr key={comp.id} className="border-t border-line bg-card align-top">
                    <td className="px-3 py-3">{comp.address}</td>
                    <td className="px-3 py-3 tabular-nums">{ppa(comp.pricePerAcre)}</td>
                    <td className="px-3 py-3 text-muted">{comp.reasons.join(" ")}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <div className="flex flex-wrap gap-3">
        <form action={rerunDealAction}>
          <input type="hidden" name="dealId" value={dealId} />
          <button className="h-10 rounded-md bg-pine px-4 text-sm font-medium text-paper" type="submit">
            Re-run with current settings
          </button>
        </form>
        <form action={deleteDealAction}>
          <input type="hidden" name="dealId" value={dealId} />
          <button className="h-10 rounded-md border border-stop/30 bg-stop-soft px-4 text-sm font-medium text-stop" type="submit">
            Delete deal
          </button>
        </form>
        <Link href="/deals" className="inline-flex h-10 items-center px-2 text-sm text-muted hover:text-ink">
          Back to deals
        </Link>
      </div>
    </div>
  );
}

function CompTable({ rows, empty }: { rows: BuyBoxReport["kept"]; empty: string }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-line">
      <table className="min-w-full text-left text-sm">
        <thead className="bg-paper-2 text-xs uppercase tracking-[0.12em] text-muted">
          <tr>
            <th className="px-3 py-2 font-medium">Address</th>
            <th className="px-3 py-2 font-medium">Acres</th>
            <th className="px-3 py-2 font-medium">Sale</th>
            <th className="px-3 py-2 font-medium">$/acre</th>
            <th className="px-3 py-2 font-medium">Sold</th>
            <th className="px-3 py-2 font-medium">Miles</th>
            <th className="px-3 py-2 font-medium">Access</th>
            <th className="px-3 py-2 font-medium">Why kept</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td className="px-3 py-4 text-muted" colSpan={8}>{empty}</td>
            </tr>
          ) : (
            rows.map((comp) => (
              <tr key={comp.id} className="border-t border-line bg-card align-top">
                <td className="px-3 py-3">{comp.address}</td>
                <td className="px-3 py-3 tabular-nums">{comp.acres}</td>
                <td className="px-3 py-3 tabular-nums">{money(comp.salePrice)}</td>
                <td className="px-3 py-3 tabular-nums">{ppa(comp.pricePerAcre)}</td>
                <td className="px-3 py-3">{formatDate(comp.saleDate)}</td>
                <td className="px-3 py-3 tabular-nums">{comp.distanceMiles.toFixed(1)}</td>
                <td className="px-3 py-3">{comp.roadAccess}</td>
                <td className="px-3 py-3 text-muted">{comp.reasons.join(" ")}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

function NumberCard({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <article className="rounded-lg border border-line bg-card p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">{label}</p>
      <p className="mt-2 font-serif text-4xl tracking-tight">{value}</p>
      <p className="mt-2 text-sm text-muted">{hint}</p>
    </article>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-line bg-card px-4 py-3">
      <p className="text-xs uppercase tracking-[0.14em] text-muted">{label}</p>
      <p className="mt-1 text-lg font-medium tabular-nums">{value}</p>
    </div>
  );
}

export function StubView({ dealId, intake, analysis }: { dealId: string; intake: DealIntake; analysis: StubAnalysis }) {
  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">Buy box</p>
        <h1 className="mt-2 font-serif text-3xl tracking-tight">{dealTitle(intake.address, intake.apn)}</h1>
      </div>
      <ComplianceNote />
      <section className="rounded-lg border border-gold/30 bg-gold-soft p-5">
        <Badge tone="example">Stub</Badge>
        <h2 className="mt-3 text-xl font-semibold">Land Portal was not called</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6">{analysis.stub.message}</p>
        <ol className="mt-4 space-y-2 text-sm">
          {analysis.stub.plannedCalls.map((call) => (
            <li key={call} className="rounded-md bg-card px-3 py-2 font-mono text-xs leading-5">
              {call}
            </li>
          ))}
        </ol>
      </section>
      <div className="flex gap-3">
        <form action={deleteDealAction}>
          <input type="hidden" name="dealId" value={dealId} />
          <button className="h-10 rounded-md border border-stop/30 bg-stop-soft px-4 text-sm text-stop" type="submit">
            Delete deal
          </button>
        </form>
        <Link href="/deals/new" className="inline-flex h-10 items-center text-sm font-medium text-pine">
          Run a demo address instead
        </Link>
      </div>
    </div>
  );
}
