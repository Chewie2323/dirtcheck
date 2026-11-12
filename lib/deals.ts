import { and, desc, eq } from "drizzle-orm";
import { db } from "./db";
import { deal } from "./db/schema";
import type { Db } from "./db/types";

/**
 * Every deal query takes the organization id and filters on it. This module is
 * the only place deals are read or deleted, so tenant scoping lives in one spot.
 */

export async function listDeals(organizationId: string, database: Db = db) {
  // The list never shows the stored intake or report, so those JSON blobs
  // (the bulk of each row) stay in the database.
  return database
    .select({
      id: deal.id,
      address: deal.address,
      apn: deal.apn,
      county: deal.county,
      acres: deal.acres,
      exitStrategy: deal.exitStrategy,
      targetOffer: deal.targetOffer,
      walkAwayOffer: deal.walkAwayOffer,
      confidence: deal.confidence,
      status: deal.status,
      updatedAt: deal.updatedAt,
    })
    .from(deal)
    .where(eq(deal.organizationId, organizationId))
    .orderBy(desc(deal.updatedAt));
}

export async function getDeal(organizationId: string, id: string, database: Db = db) {
  const [row] = await database
    .select()
    .from(deal)
    .where(and(eq(deal.id, id), eq(deal.organizationId, organizationId)))
    .limit(1);
  return row ?? null;
}

export async function deleteDeal(organizationId: string, id: string, database: Db = db) {
  await database.delete(deal).where(and(eq(deal.id, id), eq(deal.organizationId, organizationId)));
}
