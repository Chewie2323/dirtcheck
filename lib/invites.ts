import { createHash, randomBytes, randomUUID } from "node:crypto";
import { and, asc, eq, gt, isNull, ne } from "drizzle-orm";
import { db } from "./db";
import { invitation, membership, organization, user } from "./db/schema";
import type { Db } from "./db/types";
import { canManageMember, invitableRoles, isRole, type Role } from "./permissions";

export const INVITE_DAYS = 7;

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export type CreateInviteResult =
  | { ok: true; token: string; expiresAt: Date }
  | { ok: false; error: string };

export async function createInvite(
  input: { organizationId: string; invitedBy: string; actorRole: string; email: string; role: string },
  database: Db = db,
  now: Date = new Date(),
): Promise<CreateInviteResult> {
  const email = normalizeEmail(input.email);
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || email.length > 160) {
    return { ok: false, error: "Enter a valid email address." };
  }
  if (!isRole(input.role) || !invitableRoles(input.actorRole).includes(input.role)) {
    return { ok: false, error: "You cannot invite someone with that role." };
  }

  const [existing] = await database
    .select({ id: membership.id })
    .from(membership)
    .innerJoin(user, eq(user.id, membership.userId))
    .where(and(eq(membership.organizationId, input.organizationId), eq(user.email, email)))
    .limit(1);
  if (existing) return { ok: false, error: "That person is already in this workspace." };

  // One live invite per address: a new one replaces the old link.
  await database
    .delete(invitation)
    .where(
      and(
        eq(invitation.organizationId, input.organizationId),
        eq(invitation.email, email),
        isNull(invitation.acceptedAt),
      ),
    );

  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(now.getTime() + INVITE_DAYS * 86_400_000);
  await database.insert(invitation).values({
    id: randomUUID(),
    organizationId: input.organizationId,
    email,
    role: input.role,
    tokenHash: hashToken(token),
    invitedBy: input.invitedBy,
    expiresAt,
    createdAt: now,
  });
  return { ok: true, token, expiresAt };
}

export type InviteLookup =
  | {
      status: "valid";
      id: string;
      email: string;
      role: Role;
      organizationId: string;
      organizationName: string;
    }
  | { status: "expired" | "accepted" | "missing" };

export async function findInvite(token: string, database: Db = db, now: Date = new Date()): Promise<InviteLookup> {
  if (!token || token.length > 200) return { status: "missing" };
  const [row] = await database
    .select({
      id: invitation.id,
      email: invitation.email,
      role: invitation.role,
      organizationId: invitation.organizationId,
      organizationName: organization.name,
      expiresAt: invitation.expiresAt,
      acceptedAt: invitation.acceptedAt,
    })
    .from(invitation)
    .innerJoin(organization, eq(organization.id, invitation.organizationId))
    .where(eq(invitation.tokenHash, hashToken(token)))
    .limit(1);
  if (!row) return { status: "missing" };
  if (row.acceptedAt) return { status: "accepted" };
  if (row.expiresAt.getTime() <= now.getTime()) return { status: "expired" };
  return {
    status: "valid",
    id: row.id,
    email: row.email,
    role: isRole(row.role) ? row.role : "member",
    organizationId: row.organizationId,
    organizationName: row.organizationName,
  };
}

export type AcceptResult =
  | { ok: true; organizationId: string }
  | { ok: false; reason: "unavailable" | "wrong_email" };

/**
 * Join a workspace with an invite link. The signed-in user's email has to match
 * the address that was invited, and the link works once: the claim is a single
 * conditional UPDATE, so two simultaneous clicks cannot both succeed.
 */
export async function acceptInvite(
  input: { token: string; userId: string; userEmail: string },
  database: Db = db,
  now: Date = new Date(),
): Promise<AcceptResult> {
  const found = await findInvite(input.token, database, now);
  if (found.status !== "valid") return { ok: false, reason: "unavailable" };
  if (found.email !== normalizeEmail(input.userEmail)) return { ok: false, reason: "wrong_email" };

  const claimed = await database
    .update(invitation)
    .set({ acceptedAt: now })
    .where(and(eq(invitation.id, found.id), isNull(invitation.acceptedAt), gt(invitation.expiresAt, now)))
    .returning({ id: invitation.id });
  if (claimed.length === 0) return { ok: false, reason: "unavailable" };

  await database
    .insert(membership)
    .values({
      id: randomUUID(),
      organizationId: found.organizationId,
      userId: input.userId,
      role: found.role,
      createdAt: now,
    })
    .onConflictDoNothing();
  return { ok: true, organizationId: found.organizationId };
}

export async function listPendingInvites(organizationId: string, database: Db = db, now: Date = new Date()) {
  return database
    .select({
      id: invitation.id,
      email: invitation.email,
      role: invitation.role,
      expiresAt: invitation.expiresAt,
    })
    .from(invitation)
    .where(
      and(
        eq(invitation.organizationId, organizationId),
        isNull(invitation.acceptedAt),
        gt(invitation.expiresAt, now),
      ),
    )
    .orderBy(asc(invitation.createdAt));
}

export async function revokeInvite(organizationId: string, id: string, database: Db = db) {
  await database
    .delete(invitation)
    .where(and(eq(invitation.id, id), eq(invitation.organizationId, organizationId), isNull(invitation.acceptedAt)));
}

export async function listMembers(organizationId: string, database: Db = db) {
  return database
    .select({
      userId: user.id,
      name: user.name,
      email: user.email,
      role: membership.role,
      joinedAt: membership.createdAt,
    })
    .from(membership)
    .innerJoin(user, eq(user.id, membership.userId))
    .where(eq(membership.organizationId, organizationId))
    .orderBy(asc(membership.createdAt));
}

export type RemoveResult = { ok: true } | { ok: false; error: string };

export async function removeMember(
  input: { organizationId: string; actorId: string; actorRole: string; targetUserId: string },
  database: Db = db,
): Promise<RemoveResult> {
  if (input.actorId === input.targetUserId) {
    return { ok: false, error: "You cannot remove yourself from the workspace." };
  }
  const [target] = await database
    .select({ role: membership.role })
    .from(membership)
    .where(and(eq(membership.organizationId, input.organizationId), eq(membership.userId, input.targetUserId)))
    .limit(1);
  if (!target) return { ok: false, error: "That person is not in this workspace." };
  if (target.role === "owner" || !canManageMember(input.actorRole, target.role)) {
    return { ok: false, error: "You do not have permission to remove that person." };
  }
  await database
    .delete(membership)
    .where(
      and(
        eq(membership.organizationId, input.organizationId),
        eq(membership.userId, input.targetUserId),
        ne(membership.role, "owner"),
      ),
    );
  return { ok: true };
}
