"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Button, Field, Input } from "@/components/ui";
import { loginAction, signupAction, type ActionState } from "@/lib/actions";

export function LoginForm({ demoEmail, demoPassword }: { demoEmail?: string; demoPassword?: string }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(loginAction, {});
  return (
    <form action={action} className="space-y-4">
      {state.error ? <p className="rounded-md bg-stop-soft px-3 py-2 text-sm text-stop">{state.error}</p> : null}
      <Field label="Email">
        <Input name="email" type="email" autoComplete="email" required />
      </Field>
      <Field label="Password">
        <Input name="password" type="password" autoComplete="current-password" required />
      </Field>
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Signing in…" : "Sign in"}
      </Button>
      {demoEmail && demoPassword ? (
        <p className="rounded-md bg-paper-2 px-3 py-2 text-xs leading-5 text-muted">
          Local demo workspace: {demoEmail} / {demoPassword}. It already has three Ohio sample deals. Change this password before anyone else can reach the machine.
        </p>
      ) : null}
      <p className="text-sm text-muted">
        New company? <Link className="font-medium text-pine" href="/signup">Create a workspace</Link>
      </p>
    </form>
  );
}

export function SignupForm() {
  const [state, action, pending] = useActionState<ActionState, FormData>(signupAction, {});
  return (
    <form action={action} className="space-y-4">
      {state.error ? <p className="rounded-md bg-stop-soft px-3 py-2 text-sm text-stop">{state.error}</p> : null}
      <Field label="Your name">
        <Input name="name" autoComplete="name" required />
      </Field>
      <Field label="Email">
        <Input name="email" type="email" autoComplete="email" required />
      </Field>
      <Field label="Password" hint="At least 8 characters.">
        <Input name="password" type="password" autoComplete="new-password" minLength={8} required />
      </Field>
      <Field label="Workspace name" hint="The company or team that will own these deals. Each workspace has its own factors and files.">
        <Input name="workspaceName" autoComplete="organization" placeholder="Albright Land Co." required />
      </Field>
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Creating workspace…" : "Create workspace"}
      </Button>
      <p className="text-sm text-muted">
        Already have a login? <Link className="font-medium text-pine" href="/login">Sign in</Link>
      </p>
    </form>
  );
}
