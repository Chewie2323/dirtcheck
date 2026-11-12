import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "./db";
import type { Db } from "./db/types";
import { membership, orgSettings, organization } from "./db/schema";
import { DEFAULT_SETTINGS } from "./settings";

export function slugify(name: string): string {
  const base =
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 40) || "workspace";
  return `${base}-${randomUUID().slice(0, 6)}`;
}

/**
 * Create a workspace (organization, owner membership, default settings) for a
 * user. If any step fails, the organization row is removed. Its foreign keys
 * cascade, so a partial workspace never lingers.
 */
export async function provisionWorkspace(userId: string, name: string, database: Db = db): Promise<string> {
  const orgId = randomUUID();
  const now = new Date();
  try {
    await database.insert(organization).values({ id: orgId, name, slug: slugify(name), createdAt: now });
    await database.insert(membership).values({
      id: randomUUID(),
      organizationId: orgId,
      userId,
      role: "owner",
      createdAt: now,
    });
    await database.insert(orgSettings).values({
      organizationId: orgId,
      settingsJson: JSON.stringify(DEFAULT_SETTINGS),
      updatedAt: now,
    });
  } catch (error) {
    await database.delete(organization).where(eq(organization.id, orgId)).catch(() => undefined);
    throw error;
  }
  return orgId;
}
