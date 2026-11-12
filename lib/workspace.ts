import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "./auth";
import { db } from "./db";
import { membership, orgSettings, organization } from "./db/schema";
import { resolveSettings, type OrgSettings } from "./settings";

export interface Workspace {
  user: { id: string; name: string; email: string };
  organization: { id: string; name: string; slug: string };
  role: string;
  settings: OrgSettings;
  settingsUpdatedAt: Date;
}

export async function currentSession() {
  return auth.api.getSession({ headers: await headers() });
}

export async function loadWorkspace(): Promise<Workspace | null> {
  const session = await currentSession();
  if (!session) return null;
  const memberships = await db
    .select()
    .from(membership)
    .where(eq(membership.userId, session.user.id));
  if (memberships.length === 0) return null;
  const { cookies } = await import("next/headers");
  const preferred = (await cookies()).get("dirtcheck_org")?.value;
  const chosen = memberships.find((row) => row.organizationId === preferred) ?? memberships[0];
  const [org] = await db.select().from(organization).where(eq(organization.id, chosen.organizationId)).limit(1);
  const [settingsRow] = await db
    .select()
    .from(orgSettings)
    .where(eq(orgSettings.organizationId, chosen.organizationId))
    .limit(1);
  if (!org || !settingsRow) return null;
  return {
    user: { id: session.user.id, name: session.user.name, email: session.user.email },
    organization: { id: org.id, name: org.name, slug: org.slug },
    role: chosen.role,
    settings: resolveSettings(JSON.parse(settingsRow.settingsJson)),
    settingsUpdatedAt: settingsRow.updatedAt,
  };
}

export async function requireWorkspace(): Promise<Workspace> {
  const workspace = await loadWorkspace();
  if (!workspace) redirect("/login");
  return workspace;
}
