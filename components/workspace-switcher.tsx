"use client";

import { switchWorkspaceAction } from "@/lib/actions";

export function WorkspaceSwitcher({
  workspaces,
  currentId,
}: {
  workspaces: { id: string; name: string }[];
  currentId: string;
}) {
  return (
    <form action={switchWorkspaceAction}>
      <label className="sr-only" htmlFor="workspace-switcher">
        Workspace
      </label>
      <select
        id="workspace-switcher"
        name="organizationId"
        defaultValue={currentId}
        onChange={(event) => event.currentTarget.form?.requestSubmit()}
        className="h-8 rounded-md border border-line bg-card px-2 text-sm"
      >
        {workspaces.map((item) => (
          <option key={item.id} value={item.id}>
            {item.name}
          </option>
        ))}
      </select>
      <noscript>
        <button type="submit" className="ml-2 text-sm">
          Switch
        </button>
      </noscript>
    </form>
  );
}
