"use client";

import { useActionState } from "react";
import { Button, Field, Input, Select } from "@/components/ui";
import { createInviteAction, type ActionState } from "@/lib/actions";

export function InviteForm({ roles }: { roles: string[] }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(createInviteAction, {});
  return (
    <div className="space-y-3">
      <form action={action} className="flex flex-wrap items-end gap-3">
        <div className="min-w-60 flex-1">
          <Field label="Email">
            <Input name="email" type="email" required placeholder="teammate@company.com" />
          </Field>
        </div>
        <div className="w-40">
          <Field label="Role">
            <Select name="role" defaultValue={roles[roles.length - 1]}>
              {roles.map((role) => (
                <option key={role} value={role}>
                  {role}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <Button type="submit" disabled={pending}>
          {pending ? "Creating…" : "Create invite link"}
        </Button>
      </form>
      {state.error ? <p className="rounded-md bg-stop-soft px-3 py-2 text-sm text-stop">{state.error}</p> : null}
      {state.inviteLink ? (
        <div className="rounded-md bg-moss px-3 py-2 text-sm text-pine">
          <p className="font-medium">Send this link to them. It is shown once.</p>
          <input
            readOnly
            value={state.inviteLink}
            onFocus={(event) => event.currentTarget.select()}
            className="mt-2 w-full rounded border border-line bg-card px-2 py-1.5 font-mono text-xs text-ink"
          />
        </div>
      ) : null}
    </div>
  );
}
