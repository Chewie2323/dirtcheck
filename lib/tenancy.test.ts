import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, describe, it } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { deleteDeal, getDeal, listDeals } from "./deals";
import * as schema from "./db/schema";
import type { Db } from "./db/types";
import { acceptInvite, createInvite, findInvite, listMembers, removeMember, revokeInvite } from "./invites";
import { canDeleteDeal, canManageMember, invitableRoles } from "./permissions";
import { provisionWorkspace } from "./provision";
import { consumeRateLimit } from "./rate-limit";

let client: PGlite;
let db: Db;

async function addUser(email: string, name = email.split("@")[0]): Promise<string> {
  const id = randomUUID();
  const now = new Date();
  await db.insert(schema.user).values({ id, name, email, emailVerified: false, createdAt: now, updatedAt: now });
  return id;
}

async function addDeal(organizationId: string, createdBy: string, address: string): Promise<string> {
  const id = randomUUID();
  const now = new Date();
  await db.insert(schema.deal).values({
    id,
    organizationId,
    createdBy,
    address,
    apn: "",
    county: "Coshocton",
    state: "OH",
    acres: 5,
    exitStrategy: "wholesale",
    intakeJson: "{}",
    reportJson: "{}",
    status: "ready",
    createdAt: now,
    updatedAt: now,
  });
  return id;
}

describe("multi-tenant behavior on a real Postgres schema", () => {
  before(async () => {
    client = new PGlite();
    db = drizzle(client, { schema }) as unknown as Db;
    await migrate(drizzle(client), { migrationsFolder: "./drizzle" });
  });
  after(async () => {
    await client.close();
  });

  it("keeps one workspace's deals invisible to another", async () => {
    const alice = await addUser("alice@a.test");
    const bob = await addUser("bob@b.test");
    const orgA = await provisionWorkspace(alice, "Alice Land", db);
    const orgB = await provisionWorkspace(bob, "Bob Land", db);
    const dealA = await addDeal(orgA, alice, "1 A Road");
    await addDeal(orgB, bob, "2 B Road");

    assert.deepEqual((await listDeals(orgA, db)).map((d) => d.address), ["1 A Road"]);
    assert.deepEqual((await listDeals(orgB, db)).map((d) => d.address), ["2 B Road"]);
    assert.equal(await getDeal(orgB, dealA, db), null, "B cannot open A's deal by id");
    await deleteDeal(orgB, dealA, db);
    assert.equal((await listDeals(orgA, db)).length, 1, "B cannot delete A's deal");
    assert.ok(await getDeal(orgA, dealA, db));
  });

  it("invites: one-time link, matching email, role limits", async () => {
    const owner = await addUser("owner@x.test");
    const org = await provisionWorkspace(owner, "X Land", db);

    const bad = await createInvite({ organizationId: org, invitedBy: owner, actorRole: "owner", email: "nope", role: "member" }, db);
    assert.equal(bad.ok, false);
    const noOwnerRole = await createInvite({ organizationId: org, invitedBy: owner, actorRole: "owner", email: "p@x.test", role: "owner" }, db);
    assert.equal(noOwnerRole.ok, false, "owner role cannot be handed out");
    const memberInviting = await createInvite({ organizationId: org, invitedBy: owner, actorRole: "member", email: "p@x.test", role: "member" }, db);
    assert.equal(memberInviting.ok, false, "plain members cannot invite");

    const made = await createInvite({ organizationId: org, invitedBy: owner, actorRole: "owner", email: "Pat@X.test", role: "member" }, db);
    assert.ok(made.ok);
    if (!made.ok) return;
    const looked = await findInvite(made.token, db);
    assert.equal(looked.status, "valid");
    assert.equal((await findInvite("not-a-token", db)).status, "missing");

    const pat = await addUser("pat@x.test");
    const mallory = await addUser("mallory@x.test");
    const wrong = await acceptInvite({ token: made.token, userId: mallory, userEmail: "mallory@x.test" }, db);
    assert.deepEqual(wrong, { ok: false, reason: "wrong_email" });

    const first = await acceptInvite({ token: made.token, userId: pat, userEmail: "pat@x.test" }, db);
    assert.deepEqual(first, { ok: true, organizationId: org });
    const second = await acceptInvite({ token: made.token, userId: pat, userEmail: "pat@x.test" }, db);
    assert.deepEqual(second, { ok: false, reason: "unavailable" }, "link works once");
    assert.equal((await findInvite(made.token, db)).status, "accepted");

    const members = await listMembers(org, db);
    assert.deepEqual(members.map((m) => `${m.email}:${m.role}`).sort(), ["owner@x.test:owner", "pat@x.test:member"]);

    const again = await createInvite({ organizationId: org, invitedBy: owner, actorRole: "owner", email: "pat@x.test", role: "member" }, db);
    assert.equal(again.ok, false, "already a member");
  });

  it("two simultaneous accepts cannot both succeed", async () => {
    const owner = await addUser("race-owner@x.test");
    const org = await provisionWorkspace(owner, "Race Land", db);
    const made = await createInvite({ organizationId: org, invitedBy: owner, actorRole: "owner", email: "racer@x.test", role: "member" }, db);
    assert.ok(made.ok);
    if (!made.ok) return;
    const racer = await addUser("racer@x.test");
    const results = await Promise.all([
      acceptInvite({ token: made.token, userId: racer, userEmail: "racer@x.test" }, db),
      acceptInvite({ token: made.token, userId: racer, userEmail: "racer@x.test" }, db),
    ]);
    assert.equal(results.filter((r) => r.ok).length, 1);
    assert.equal((await listMembers(org, db)).filter((m) => m.userId === racer).length, 1);
  });

  it("expired and revoked invites stop working", async () => {
    const owner = await addUser("exp-owner@x.test");
    const org = await provisionWorkspace(owner, "Exp Land", db);
    const longAgo = new Date(Date.now() - 30 * 86_400_000);
    const old = await createInvite({ organizationId: org, invitedBy: owner, actorRole: "owner", email: "old@x.test", role: "member" }, db, longAgo);
    assert.ok(old.ok);
    if (old.ok) assert.equal((await findInvite(old.token, db)).status, "expired");

    const fresh = await createInvite({ organizationId: org, invitedBy: owner, actorRole: "owner", email: "fresh@x.test", role: "member" }, db);
    assert.ok(fresh.ok);
    if (!fresh.ok) return;
    const lookup = await findInvite(fresh.token, db);
    assert.equal(lookup.status, "valid");
    if (lookup.status === "valid") await revokeInvite(org, lookup.id, db);
    assert.equal((await findInvite(fresh.token, db)).status, "missing");
  });

  it("removing members respects roles", async () => {
    const owner = await addUser("rm-owner@x.test");
    const admin = await addUser("rm-admin@x.test");
    const member = await addUser("rm-member@x.test");
    const org = await provisionWorkspace(owner, "Rm Land", db);
    const now = new Date();
    await db.insert(schema.membership).values([
      { id: randomUUID(), organizationId: org, userId: admin, role: "admin", createdAt: now },
      { id: randomUUID(), organizationId: org, userId: member, role: "member", createdAt: now },
    ]);
    assert.equal((await removeMember({ organizationId: org, actorId: admin, actorRole: "admin", targetUserId: owner }, db)).ok, false);
    assert.equal((await removeMember({ organizationId: org, actorId: owner, actorRole: "owner", targetUserId: owner }, db)).ok, false);
    assert.equal((await removeMember({ organizationId: org, actorId: member, actorRole: "member", targetUserId: admin }, db)).ok, false);
    assert.equal((await removeMember({ organizationId: org, actorId: admin, actorRole: "admin", targetUserId: member }, db)).ok, true);
    assert.equal((await removeMember({ organizationId: org, actorId: owner, actorRole: "owner", targetUserId: admin }, db)).ok, true);
    assert.equal((await listMembers(org, db)).length, 1);
  });

  it("rate limit allows the max, blocks the next, and resets after the window", async () => {
    const limit = { max: 3, windowSeconds: 60 };
    const t0 = 1_000_000;
    const outcomes = [];
    for (let i = 0; i < 5; i += 1) outcomes.push((await consumeRateLimit("k1", limit, db, t0 + i)).allowed);
    assert.deepEqual(outcomes, [true, true, true, false, false]);
    const blocked = await consumeRateLimit("k1", limit, db, t0 + 10_000);
    assert.equal(blocked.allowed, false);
    assert.ok(blocked.retryAfterSeconds > 0 && blocked.retryAfterSeconds <= 60);
    assert.equal((await consumeRateLimit("k2", limit, db, t0)).allowed, true, "other keys are independent");
    assert.equal((await consumeRateLimit("k1", limit, db, t0 + 61_000)).allowed, true, "window reset");
  });

  it("a failed workspace creation leaves no partial workspace behind", async () => {
    const before = (await db.select().from(schema.organization)).length;
    await assert.rejects(provisionWorkspace("no-such-user", "Ghost Land", db));
    assert.equal((await db.select().from(schema.organization)).length, before);
  });
});

describe("permissions", () => {
  it("encodes who can do what", () => {
    assert.deepEqual(invitableRoles("owner"), ["admin", "member"]);
    assert.deepEqual(invitableRoles("admin"), ["member"]);
    assert.deepEqual(invitableRoles("member"), []);
    assert.equal(canManageMember("owner", "admin"), true);
    assert.equal(canManageMember("admin", "admin"), false);
    assert.equal(canDeleteDeal("member", "u1", "u1"), true);
    assert.equal(canDeleteDeal("member", "u1", "u2"), false);
    assert.equal(canDeleteDeal("admin", "u1", "u2"), true);
  });
});

describe("safeNext", () => {
  it("only lets invite pages through", async () => {
    const { safeNext } = await import("./next-path");
    const token = "A".repeat(43);
    assert.equal(safeNext(`/invite/${token}`), `/invite/${token}`);
    for (const bad of ["https://evil.test", "//evil.test", "/deals", `/invite/${token}/../x`, "/invite/short", null, undefined]) {
      assert.equal(safeNext(bad as string | null | undefined), null, String(bad));
    }
  });
});
