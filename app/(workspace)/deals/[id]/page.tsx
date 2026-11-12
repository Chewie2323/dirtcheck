import { and, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { ReportView, StubView } from "@/components/report-view";
import type { StoredAnalysis } from "@/lib/analyze";
import { db } from "@/lib/db";
import { deal } from "@/lib/db/schema";
import type { DealIntake } from "@/lib/types";
import { requireWorkspace } from "@/lib/workspace";

export const metadata = { title: "Buy box" };

export default async function DealPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const workspace = await requireWorkspace();
  const [row] = await db
    .select()
    .from(deal)
    .where(and(eq(deal.id, id), eq(deal.organizationId, workspace.organization.id)))
    .limit(1);
  if (!row?.reportJson) notFound();
  const intake = JSON.parse(row.intakeJson) as DealIntake;
  const analysis = JSON.parse(row.reportJson) as StoredAnalysis;
  if (analysis.kind === "stub") {
    return <StubView dealId={row.id} intake={intake} analysis={analysis} />;
  }
  return <ReportView dealId={row.id} intake={intake} report={analysis} />;
}
