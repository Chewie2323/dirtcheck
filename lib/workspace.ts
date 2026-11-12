import { asc, eq } from "drizzle-orm";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { auth } from "./auth";
import { db } from "./db";
import { membership, orgSettings, organization } from "./db/schema";
import { resolveSettings, type OrgSettings } from "./settings";

export const ORG_COOKIE = "dirtcheck_org";

export interface Workspace {
  user: { id: string; name: string; email: string };
  organization: { id: string; name: string; slug: string };
  role: string;
  settings: OrgSettings;
  settingsUpdatedAt: Date;
}

/** One session lookup per request, however many components ask for it. */
export const currentSession = cache(async () => {
  return auth.api.getSession({ headers: await headers() });
});

function parseSettings(json: string): OrgSettings {
  try {
    return resolveSettings(JSON.parse(json));
  } catch {
    return resolveSettings(null);
  }
}

/**
 * The signed-in user's active workspace. Cached per request, so the layout and
 * the page share one result instead of each running their own queries.
 * Membership, organization, and settings load in a single joined query.
 */
export const loadWorkspace = cache(async (): Promise<Workspace | null> => {
  const session = await currentSession();
  if (!session) return null;

  const rows = await db
    .select({
      role: membership.role,
      orgId: organization.id,
      orgName: organization.name,
      orgSlug: organization.slug,
      settingsJson: orgSettings.settingsJson,
      settingsUpdatedAt: orgSettings.updatedAt,
    })
    .from(membership)
    .innerJoin(organization, eq(organization.id, membership.organizationId))
    .innerJoin(orgSettings, eq(orgSettings.organizationId, membership.organizationId))
    .where(eq(membership.userId, session.user.id))
    .orderBy(asc(membership.createdAt));
  if (rows.length === 0) return null;

  const preferred = (await cookies()).get(ORG_COOKIE)?.value;
  const chosen = rows.find((row) => row.orgId === preferred) ?? rows[0];
  return {
    user: { id: session.user.id, name: session.user.name, email: session.user.email },
    organization: { id: chosen.orgId, name: chosen.orgName, slug: chosen.orgSlug },
    role: chosen.role,
    settings: parseSettings(chosen.settingsJson),
    settingsUpdatedAt: chosen.settingsUpdatedAt,
  };
});

export async function requireWorkspace(): Promise<Workspace> {
  const workspace = await loadWorkspace();
  if (!workspace) redirect("/login");
  return workspace;
}
