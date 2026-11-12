"use server";

import { and, eq } from "drizzle-orm";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { analysisStatus, analyzeIntake, type StoredAnalysis } from "./analyze";
import { auth } from "./auth";
import { db } from "./db";
import { deal, membership, orgSettings, organization, user } from "./db/schema";
import { deleteDeal, getDeal } from "./deals";
import { intakeFromFormData } from "./intake";
import { safeNext } from "./next-path";
import { acceptInvite, createInvite, removeMember, revokeInvite } from "./invites";
import { canDeleteDeal, canManageWorkspace } from "./permissions";
import { provisionWorkspace } from "./provision";
import { clientIp } from "./request";
import { LIMITS, consumeRateLimit, limitMessage } from "./rate-limit";
import { DEFAULT_SETTINGS } from "./settings";
import { settingsFromFormData } from "./settings-form";
import { appBaseUrl } from "./url";
import { ORG_COOKIE, currentSession, requireWorkspace } from "./workspace";

export interface ActionState {
  error?: string;
  /** A one-time invite link, shown to the person who created it. */
  inviteLink?: string;
}

async function rememberOrg(organizationId: string) {
  const jar = await cookies();
  jar.set(ORG_COOKIE, organizationId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 400,
  });
}

function safeAuthMessage(error: unknown, fallback: string): string {
  console.error(error);
  const message = error instanceof Error ? error.message : "";
  if (/exist|already/i.test(message)) return "An account with that email already exists.";
  if (/password/i.test(message) && /short|8|character/i.test(message)) {
    return "Use at least 8 characters for the password.";
  }
  return fallback;
}

export async function signupAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const name = String(formData.get("name") || "").trim();
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "");
  const workspaceName = String(formData.get("workspaceName") || "").trim();
  const next = safeNext(formData.get("next"));
  if (name.length < 2) return { error: "Enter your name." };
  if (!email.includes("@") || email.length > 160) return { error: "Enter a valid email." };
  if (password.length < 8) return { error: "Use at least 8 characters for the password." };
  // Someone joining through an invite does not need a workspace of their own.
  if (!next && workspaceName.length < 2) {
    return { error: "Name the workspace. This is the company or team that owns the deals." };
  }

  const limited = await consumeRateLimit(`action:signup:ip:${await clientIp()}`, LIMITS.signupPerIp);
  if (!limited.allowed) return { error: limitMessage(limited) };

  try {
    await auth.api.signUpEmail({
      body: { name, email, password },
      headers: await headers(),
    });
  } catch (error) {
    return { error: safeAuthMessage(error, "Could not create that account.") };
  }

  if (next) redirect(next);

  const [created] = await db.select().from(user).where(eq(user.email, email)).limit(1);
  if (!created) return { error: "The account was created, but the workspace could not be attached. Try signing in." };

  let orgId: string;
  try {
    orgId = await provisionWorkspace(created.id, workspaceName);
  } catch (error) {
    console.error(error);
    // The account exists, so signing in later creates the workspace.
    return { error: "Your account was created, but the workspace could not be set up. Sign in to finish." };
  }
  await rememberOrg(orgId);
  redirect("/deals");
}

export async function loginAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "");
  const next = safeNext(formData.get("next"));
  if (!email || !password) return { error: "Enter your email and password." };

  const ipLimit = await consumeRateLimit(`action:login:ip:${await clientIp()}`, LIMITS.loginPerIp);
  if (!ipLimit.allowed) return { error: limitMessage(ipLimit) };
  const emailLimit = await consumeRateLimit(`action:login:email:${email}`, LIMITS.loginPerEmail);
  if (!emailLimit.allowed) return { error: limitMessage(emailLimit) };

  try {
    await auth.api.signInEmail({
      body: { email, password },
      headers: await headers(),
    });
  } catch (error) {
    return { error: safeAuthMessage(error, "Email or password is wrong.") };
  }

  if (next) redirect(next);

  const [found] = await db
    .select({ id: user.id, name: user.name, organizationId: membership.organizationId })
    .from(user)
    .leftJoin(membership, eq(membership.userId, user.id))
    .where(eq(user.email, email))
    .limit(1);
  if (!found) return { error: "Email or password is wrong." };

  let organizationId = found.organizationId;
  if (!organizationId) {
    // A signup that was interrupted after the account was created. Finish it.
    try {
      organizationId = await provisionWorkspace(found.id, `${found.name}'s workspace`);
    } catch (error) {
      console.error(error);
      return { error: "Signed in, but the workspace could not be set up. Try again." };
    }
  }
  await rememberOrg(organizationId);
  redirect("/deals");
}

export async function logoutAction(): Promise<void> {
  await auth.api.signOut({ headers: await headers() });
  const jar = await cookies();
  jar.delete(ORG_COOKIE);
  redirect("/login");
}

async function saveDeal(input: {
  organizationId: string;
  userId: string;
  intake: ReturnType<typeof intakeFromFormData> & { ok: true };
  analysis: StoredAnalysis;
  dealId?: string;
}) {
  const intake = input.intake.intake;
  const now = new Date();
  const offer = input.analysis.kind === "report" ? input.analysis.offer : null;
  const values = {
    address: intake.address,
    apn: intake.apn,
    county: intake.county,
    state: intake.state,
    acres: intake.acres,
    exitStrategy: intake.exitStrategy,
    intakeJson: JSON.stringify(intake),
    reportJson: JSON.stringify(input.analysis),
    targetOffer: offer?.target ?? null,
    walkAwayOffer: offer?.walkAway ?? null,
    confidence: input.analysis.kind === "report" ? input.analysis.confidence : null,
    status: analysisStatus(input.analysis),
    updatedAt: now,
  };
  if (input.dealId) {
    await db.update(deal).set(values).where(and(eq(deal.id, input.dealId), eq(deal.organizationId, input.organizationId)));
    return input.dealId;
  }
  const id = crypto.randomUUID();
  await db.insert(deal).values({
    id,
    organizationId: input.organizationId,
    createdBy: input.userId,
    createdAt: now,
    ...values,
  });
  return id;
}

export async function createDealAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const workspace = await requireWorkspace();
  const parsed = intakeFromFormData(formData);
  if (!parsed.ok) return { error: parsed.error };
  try {
    const analysis = await analyzeIntake(parsed.intake, workspace.settings, new Date());
    const id = await saveDeal({
      organizationId: workspace.organization.id,
      userId: workspace.user.id,
      intake: parsed,
      analysis,
    });
    redirect(`/deals/${id}`);
  } catch (error) {
    if (typeof error === "object" && error && "digest" in error) throw error;
    console.error(error);
    return { error: "The analysis failed, so the deal was not saved." };
  }
}

export async function rerunDealAction(formData: FormData): Promise<void> {
  const workspace = await requireWorkspace();
  const id = String(formData.get("dealId") || "");
  const [row] = await db
    .select()
    .from(deal)
    .where(and(eq(deal.id, id), eq(deal.organizationId, workspace.organization.id)))
    .limit(1);
  if (!row) redirect("/deals");
  const intake = JSON.parse(row.intakeJson);
  const parsed = intakeFromFormData(formDataFromIntake(intake));
  if (!parsed.ok) redirect(`/deals/${id}`);
  const analysis = await analyzeIntake(parsed.intake, workspace.settings, new Date());
  await saveDeal({
    organizationId: workspace.organization.id,
    userId: workspace.user.id,
    intake: parsed,
    analysis,
    dealId: id,
  });
  redirect(`/deals/${id}`);
}

function formDataFromIntake(intake: Record<string, unknown>): FormData {
  const formData = new FormData();
  for (const [key, value] of Object.entries(intake)) {
    if (typeof value === "boolean") {
      if (value) formData.set(key, "on");
    } else if (value != null) {
      formData.set(key, String(value));
    }
  }
  return formData;
}

export async function deleteDealAction(formData: FormData): Promise<void> {
  const workspace = await requireWorkspace();
  const id = String(formData.get("dealId") || "");
  const row = await getDeal(workspace.organization.id, id);
  if (row && canDeleteDeal(workspace.role, workspace.user.id, row.createdBy)) {
    await deleteDeal(workspace.organization.id, id);
  }
  redirect("/deals");
}

export async function saveSettingsAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const workspace = await requireWorkspace();
  if (!canManageWorkspace(workspace.role)) return { error: "Only an owner or admin can change workspace settings." };
  const parsed = settingsFromFormData(formData);
  if (!parsed.ok) return { error: parsed.error };
  const now = new Date();
  await db.update(organization).set({ name: parsed.name }).where(eq(organization.id, workspace.organization.id));
  await db
    .update(orgSettings)
    .set({ settingsJson: JSON.stringify(parsed.settings), updatedAt: now })
    .where(eq(orgSettings.organizationId, workspace.organization.id));
  redirect("/settings?saved=1");
}

export async function resetSettingsAction(): Promise<void> {
  const workspace = await requireWorkspace();
  if (!canManageWorkspace(workspace.role)) redirect("/settings");
  await db
    .update(orgSettings)
    .set({ settingsJson: JSON.stringify(DEFAULT_SETTINGS), updatedAt: new Date() })
    .where(eq(orgSettings.organizationId, workspace.organization.id));
  redirect("/settings?reset=1");
}

export async function switchWorkspaceAction(formData: FormData): Promise<void> {
  const workspace = await requireWorkspace();
  const target = String(formData.get("organizationId") || "");
  // Only workspaces the user belongs to can be selected.
  if (workspace.workspaces.some((item) => item.id === target)) await rememberOrg(target);
  redirect("/deals");
}

export async function createInviteAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const workspace = await requireWorkspace();
  if (!canManageWorkspace(workspace.role)) return { error: "Only an owner or admin can invite people." };
  const result = await createInvite({
    organizationId: workspace.organization.id,
    invitedBy: workspace.user.id,
    actorRole: workspace.role,
    email: String(formData.get("email") || ""),
    role: String(formData.get("role") || "member"),
  });
  if (!result.ok) return { error: result.error };
  return { inviteLink: `${appBaseUrl()}/invite/${result.token}` };
}

export async function revokeInviteAction(formData: FormData): Promise<void> {
  const workspace = await requireWorkspace();
  if (canManageWorkspace(workspace.role)) {
    await revokeInvite(workspace.organization.id, String(formData.get("inviteId") || ""));
  }
  redirect("/team");
}

export async function removeMemberAction(formData: FormData): Promise<void> {
  const workspace = await requireWorkspace();
  await removeMember({
    organizationId: workspace.organization.id,
    actorId: workspace.user.id,
    actorRole: workspace.role,
    targetUserId: String(formData.get("userId") || ""),
  });
  redirect("/team");
}

export async function acceptInviteAction(formData: FormData): Promise<void> {
  const token = String(formData.get("token") || "");
  const session = await currentSession();
  if (!session) redirect(`/login`);
  const limited = await consumeRateLimit(`action:invite:ip:${await clientIp()}`, LIMITS.inviteAcceptPerIp);
  if (!limited.allowed) redirect(`/invite/${token}?error=rate`);
  const result = await acceptInvite({ token, userId: session.user.id, userEmail: session.user.email });
  if (!result.ok) redirect(`/invite/${token}?error=${result.reason}`);
  await rememberOrg(result.organizationId);
  redirect("/deals");
}
