import { Shell } from "@/components/shell";
import { requireWorkspace } from "@/lib/workspace";

export default async function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  const workspace = await requireWorkspace();
  return <Shell workspace={workspace}>{children}</Shell>;
}
