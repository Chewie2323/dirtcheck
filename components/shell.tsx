import Link from "next/link";
import { WorkspaceSwitcher } from "@/components/workspace-switcher";
import { logoutAction } from "@/lib/actions";
import type { Workspace } from "@/lib/workspace";

export function Shell({ workspace, children }: { workspace: Workspace; children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <header className="border-b border-line bg-card/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-3 px-4 py-3 sm:px-6">
          <Link href="/deals" className="flex items-center gap-2">
            <Mark />
            <span className="text-base font-semibold tracking-tight">Dirt Check</span>
          </Link>
          {workspace.workspaces.length > 1 ? (
            <WorkspaceSwitcher workspaces={workspace.workspaces} currentId={workspace.organization.id} />
          ) : (
            <p className="text-sm text-muted">{workspace.organization.name}</p>
          )}
          <nav className="flex items-center gap-1 text-sm sm:ml-auto">
            <Link className="rounded-md px-3 py-2 hover:bg-paper-2" href="/deals">
              Deals
            </Link>
            <Link className="rounded-md px-3 py-2 hover:bg-paper-2" href="/deals/new">
              New deal
            </Link>
            <Link className="rounded-md px-3 py-2 hover:bg-paper-2" href="/team">
              Team
            </Link>
            <Link className="rounded-md px-3 py-2 hover:bg-paper-2" href="/settings">
              Settings
            </Link>
          </nav>
          <form action={logoutAction} className="flex items-center gap-3">
            <span className="hidden text-sm text-muted sm:inline">{workspace.user.email}</span>
            <button className="rounded-md border border-line bg-card px-3 py-1.5 text-sm hover:bg-paper-2" type="submit">
              Sign out
            </button>
          </form>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">{children}</main>
      <footer className="mx-auto max-w-6xl px-4 pb-10 text-xs leading-5 text-muted sm:px-6">
        Interested-lead underwriting only. Offer prices stay out of cold texts, mailers, and dialer scripts.
      </footer>
    </div>
  );
}

function Mark() {
  return (
    <svg aria-hidden="true" viewBox="0 0 32 32" className="h-8 w-8">
      <rect width="32" height="32" rx="7" fill="#1f4e79" />
      <path d="M9 23V9h9" fill="none" stroke="#f4f6f8" strokeWidth="2.2" />
      <circle cx="21" cy="21" r="2.2" fill="#e2a33b" />
    </svg>
  );
}
