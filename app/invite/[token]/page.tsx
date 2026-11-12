import Link from "next/link";
import { Button } from "@/components/ui";
import { acceptInviteAction, logoutAction } from "@/lib/actions";
import { findInvite } from "@/lib/invites";
import { currentSession } from "@/lib/workspace";
import { AuthFrame } from "../../login/page";

export const metadata = { title: "Join a workspace" };

const errors: Record<string, string> = {
  unavailable: "This invite is no longer valid. Ask for a new link.",
  wrong_email: "This invite was sent to a different email address.",
  rate: "Too many attempts. Try again in a few minutes.",
};

export default async function InvitePage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { token } = await params;
  const { error } = await searchParams;
  const [invite, session] = await Promise.all([findInvite(token), currentSession()]);

  if (invite.status !== "valid") {
    const text =
      invite.status === "expired"
        ? "This invite has expired. Ask for a new link."
        : invite.status === "accepted"
          ? "This invite has already been used."
          : "This invite link is not valid.";
    return (
      <AuthFrame title="Invite unavailable" lede={text}>
        <Link className="text-sm font-medium text-pine" href="/login">
          Go to sign in
        </Link>
      </AuthFrame>
    );
  }

  const here = `/invite/${token}`;
  const lede = `You were invited to ${invite.organizationName} as ${invite.role}.`;
  const message = error ? errors[error] : null;

  if (!session) {
    return (
      <AuthFrame title="Join a workspace" lede={lede}>
        <div className="space-y-3 text-sm">
          <p className="text-muted">
            The invite is for <span className="font-medium text-ink">{invite.email}</span>. Sign in or create an account with that email.
          </p>
          <div className="flex gap-2">
            <Link
              href={`/signup?next=${encodeURIComponent(here)}&email=${encodeURIComponent(invite.email)}`}
              className="inline-flex h-10 items-center rounded-md bg-pine px-4 text-paper"
            >
              Create account
            </Link>
            <Link
              href={`/login?next=${encodeURIComponent(here)}`}
              className="inline-flex h-10 items-center rounded-md border border-line bg-card px-4"
            >
              Sign in
            </Link>
          </div>
        </div>
      </AuthFrame>
    );
  }

  const matches = session.user.email.toLowerCase() === invite.email;
  return (
    <AuthFrame title="Join a workspace" lede={lede}>
      {message ? <p className="mb-4 rounded-md bg-stop-soft px-3 py-2 text-sm text-stop">{message}</p> : null}
      {matches ? (
        <form action={acceptInviteAction}>
          <input type="hidden" name="token" value={token} />
          <Button type="submit" className="w-full">
            Join {invite.organizationName}
          </Button>
        </form>
      ) : (
        <div className="space-y-3 text-sm">
          <p className="text-muted">
            You are signed in as <span className="font-medium text-ink">{session.user.email}</span>, but this invite is for{" "}
            <span className="font-medium text-ink">{invite.email}</span>.
          </p>
          <form action={logoutAction}>
            <Button type="submit" variant="outline">
              Sign out
            </Button>
          </form>
        </div>
      )}
    </AuthFrame>
  );
}
