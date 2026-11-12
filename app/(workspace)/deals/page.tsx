import Link from "next/link";
import { Badge } from "@/components/ui";
import { listDeals } from "@/lib/deals";
import { acresLabel, dealTitle, formatDate, money } from "@/lib/format";
import { demoMode } from "@/lib/features";
import { SAMPLE_PARCELS } from "@/lib/samples";
import { EXIT_LABELS, type ExitStrategy } from "@/lib/types";
import { requireWorkspace } from "@/lib/workspace";

export const metadata = { title: "Deals" };

const statusTone = {
  ready: "high",
  review: "medium",
  withheld: "low",
  stub: "neutral",
} as const;

const statusLabel = {
  ready: "Ready",
  review: "Review",
  withheld: "No offer",
  stub: "Not run",
} as const;

export default async function DealsPage() {
  const workspace = await requireWorkspace();
  const rows = await listDeals(workspace.organization.id);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">Workspace</p>
          <h1 className="font-serif text-4xl tracking-tight">Deals</h1>
          <p className="mt-2 max-w-xl text-sm leading-6 text-muted">
            Saved buy boxes for {workspace.organization.name}. Open one to see the comps, the offer math, and the flags.
          </p>
        </div>
        <Link href="/deals/new" className="inline-flex h-10 items-center rounded-md bg-pine px-4 text-sm font-medium text-paper">
          New deal
        </Link>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-line bg-card p-6">
          <h2 className="font-semibold">No deals in this workspace yet</h2>
          <p className="mt-2 max-w-xl text-sm leading-6 text-muted">
            Add a parcel by APN and state. Dirt Check pulls sold comps for that county and builds the offer range.
          </p>
          <Link href="/deals/new" className="mt-4 inline-flex h-10 items-center rounded-md bg-pine px-4 text-sm font-medium text-paper">
            Add your first deal
          </Link>
          {demoMode() ? (
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {SAMPLE_PARCELS.map((sample) => (
              <Link key={sample.id} href={`/deals/new?sample=${sample.id}`} className="rounded-lg border border-line p-4 hover:border-pine">
                <p className="font-medium">{sample.title}</p>
                <p className="mt-1 text-sm text-muted">{sample.intake.address}</p>
                <p className="mt-2 text-xs text-muted">{sample.blurb}</p>
              </Link>
            ))}
          </div>
          ) : null}
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-line">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-paper-2 text-xs uppercase tracking-[0.12em] text-muted">
              <tr>
                <th className="px-3 py-2 font-medium">Parcel</th>
                <th className="px-3 py-2 font-medium">Exit</th>
                <th className="px-3 py-2 font-medium">Target</th>
                <th className="px-3 py-2 font-medium">Walk-away</th>
                <th className="px-3 py-2 font-medium">Confidence</th>
                <th className="px-3 py-2 font-medium">Updated</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const tone = statusTone[row.status as keyof typeof statusTone] ?? "neutral";
                return (
                  <tr key={row.id} className="border-t border-line bg-card">
                    <td className="px-3 py-3">
                      <Link href={`/deals/${row.id}`} className="font-medium hover:underline">
                        {dealTitle(row.address, row.apn)}
                      </Link>
                      <p className="text-xs text-muted">
                        {row.county ? `${row.county} County` : "County not set"} · {acresLabel(row.acres)}
                      </p>
                    </td>
                    <td className="px-3 py-3">{EXIT_LABELS[row.exitStrategy as ExitStrategy] ?? row.exitStrategy}</td>
                    <td className="px-3 py-3 tabular-nums">{money(row.targetOffer)}</td>
                    <td className="px-3 py-3 tabular-nums">{money(row.walkAwayOffer)}</td>
                    <td className="px-3 py-3">
                      <Badge tone={tone}>
                        {row.confidence ? row.confidence : statusLabel[row.status as keyof typeof statusLabel] ?? row.status}
                      </Badge>
                    </td>
                    <td className="px-3 py-3 text-muted">{formatDate(row.updatedAt)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
