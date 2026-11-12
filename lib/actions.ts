"use server";

import { and, eq } from "drizzle-orm";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { analysisStatus, analyzeIntake, type StoredAnalysis } from "./analyze";
import { auth } from "./auth";
import { db } from "./db";
import { deal, membership, orgSettings, organization, user } from "./db/schema";
import { intakeFromFormData } from "./intake";
import { EXAMPLE_SETTINGS } from "./settings";
import { settingsFromFormData } from "./settings-form";
import { requireWorkspace } from "./workspace";

export interface ActionState {
  error?: string;
}

const ORG_COOKIE = "dirtcheck_org";

function slugify(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40) || "workspace";
  return `${base}-${crypto.randomUUID().slice(0, 6)}`;
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
  if (name.length < 2) return { error: "Enter your name." };
  if (!email.includes("@") || email.length > 160) return { error: "Enter a valid email." };
  if (password.length < 8) return { error: "Use at least 8 characters for the password." };
  if (workspaceName.length < 2) return { error: "Name the workspace. This is the company or team that owns the deals." };

  try {
    await auth.api.signUpEmail({
      body: { name, email, password },
      headers: await headers(),
    });
  } catch (error) {
    return { error: safeAuthMessage(error, "Could not create that account.") };
  }

  const [created] = await db.select().from(user).where(eq(user.email, email)).limit(1);
  if (!created) return { error: "The account was created, but the workspace could not be attached. Try signing in." };

  const orgId = crypto.randomUUID();
  const now = new Date();
  await db.insert(organization).values({
    id: orgId,
    name: workspaceName,
    slug: slugify(workspaceName),
    createdAt: now,
  });
  await db.insert(membership).values({
    id: crypto.randomUUID(),
    organizationId: orgId,
    userId: created.id,
    role: "owner",
    createdAt: now,
  });
  await db.insert(orgSettings).values({
    organizationId: orgId,
    settingsJson: JSON.stringify(EXAMPLE_SETTINGS),
    updatedAt: now,
  });
  await rememberOrg(orgId);
  redirect("/deals");
}

export async function loginAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "");
  if (!email || !password) return { error: "Enter your email and password." };

  try {
    await auth.api.signInEmail({
      body: { email, password },
      headers: await headers(),
    });
  } catch (error) {
    return { error: safeAuthMessage(error, "Email or password is wrong.") };
  }

  const [found] = await db.select().from(user).where(eq(user.email, email)).limit(1);
  if (!found) return { error: "Email or password is wrong." };
  const [member] = await db.select().from(membership).where(eq(membership.userId, found.id)).limit(1);
  if (member) await rememberOrg(member.organizationId);
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
  await db.delete(deal).where(and(eq(deal.id, id), eq(deal.organizationId, workspace.organization.id)));
  redirect("/deals");
}

export async function saveSettingsAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const workspace = await requireWorkspace();
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
  await db
    .update(orgSettings)
    .set({ settingsJson: JSON.stringify(EXAMPLE_SETTINGS), updatedAt: new Date() })
    .where(eq(orgSettings.organizationId, workspace.organization.id));
  redirect("/settings?reset=1");
}
