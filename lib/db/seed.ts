import { hashPassword } from "better-auth/crypto";
import { and, eq } from "drizzle-orm";
import { pathToFileURL } from "node:url";
import { analysisStatus, analyzeIntake } from "../analyze";
import { DEMO_EMAIL, DEMO_NAME, DEMO_ORG, DEMO_PASSWORD } from "../demo-account";
import { SAMPLE_PARCELS } from "../samples";
import { DEFAULT_SETTINGS } from "../settings";
import { db } from "./index";
import { account, deal, membership, orgSettings, organization, user } from "./schema";

function slugify(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40) || "workspace";
  return `${base}-${crypto.randomUUID().slice(0, 6)}`;
}

async function writeSampleDeals(organizationId: string, userId: string, now: Date) {
  for (const sample of SAMPLE_PARCELS) {
    await db
      .delete(deal)
      .where(and(eq(deal.organizationId, organizationId), eq(deal.address, sample.intake.address)));
  }
  for (const [index, sample] of SAMPLE_PARCELS.entries()) {
    const analyzedAt = new Date(now.getTime() - (SAMPLE_PARCELS.length - index) * 86_400_000);
    const analysis = await analyzeIntake(sample.intake, DEFAULT_SETTINGS, analyzedAt);
    const offer = analysis.kind === "report" ? analysis.offer : null;
    await db.insert(deal).values({
      id: crypto.randomUUID(),
      organizationId,
      createdBy: userId,
      address: sample.intake.address,
      apn: sample.intake.apn,
      county: sample.intake.county,
      state: sample.intake.state,
      acres: sample.intake.acres,
      exitStrategy: sample.intake.exitStrategy,
      intakeJson: JSON.stringify(sample.intake),
      reportJson: JSON.stringify(analysis),
      targetOffer: offer?.target ?? null,
      walkAwayOffer: offer?.walkAway ?? null,
      confidence: analysis.kind === "report" ? analysis.confidence : null,
      status: analysisStatus(analysis),
      createdAt: analyzedAt,
      updatedAt: analyzedAt,
    });
  }
}

export async function seedDemo(): Promise<void> {
  const now = new Date();
  const existing = await db.select({ id: user.id }).from(user).where(eq(user.email, DEMO_EMAIL)).limit(1);
  if (existing.length > 0) {
    const userId = existing[0].id;
    const [member] = await db.select().from(membership).where(eq(membership.userId, userId)).limit(1);
    if (!member) return;
    await db
      .update(orgSettings)
      .set({ settingsJson: JSON.stringify(DEFAULT_SETTINGS), updatedAt: now })
      .where(eq(orgSettings.organizationId, member.organizationId));
    await writeSampleDeals(member.organizationId, userId, now);
    return;
  }

  const userId = crypto.randomUUID();
  const orgId = crypto.randomUUID();
  const password = await hashPassword(DEMO_PASSWORD);

  await db.insert(user).values({
    id: userId,
    name: DEMO_NAME,
    email: DEMO_EMAIL,
    emailVerified: true,
    image: null,
    createdAt: now,
    updatedAt: now,
  });
  await db.insert(account).values({
    id: crypto.randomUUID(),
    accountId: userId,
    providerId: "credential",
    userId,
    password,
    createdAt: now,
    updatedAt: now,
  });
  await db.insert(organization).values({
    id: orgId,
    name: DEMO_ORG,
    slug: slugify(DEMO_ORG),
    createdAt: now,
  });
  await db.insert(membership).values({
    id: crypto.randomUUID(),
    organizationId: orgId,
    userId,
    role: "owner",
    createdAt: now,
  });
  await db.insert(orgSettings).values({
    organizationId: orgId,
    settingsJson: JSON.stringify(DEFAULT_SETTINGS),
    updatedAt: now,
  });
  await writeSampleDeals(orgId, userId, now);
}

const entry = process.argv[1];
if (entry && import.meta.url === pathToFileURL(entry).href) {
  seedDemo()
    .then(() => {
      console.log(`Seeded ${DEMO_EMAIL} in ${DEMO_ORG}.`);
      process.exit(0);
    })
    .catch((error: unknown) => {
      console.error(error);
      process.exit(1);
    });
}
