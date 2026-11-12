import { SettingsForm } from "@/components/settings-form";
import { requireWorkspace } from "@/lib/workspace";

export const metadata = { title: "Settings" };

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; reset?: string }>;
}) {
  const workspace = await requireWorkspace();
  const params = await searchParams;
  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">Workspace</p>
        <h1 className="font-serif text-4xl tracking-tight">Factors</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
          Exit factors, minimum profit, and due-diligence costs live here, not in the buy-box code.
          Saved deals keep the factors they were run with until you re-run them.
        </p>
      </div>
      <SettingsForm
        key={workspace.settingsUpdatedAt.toISOString()}
        name={workspace.organization.name}
        settings={workspace.settings}
        saved={params.saved === "1"}
        reset={params.reset === "1"}
      />
    </div>
  );
}
