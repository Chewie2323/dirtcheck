export const ROLES = ["owner", "admin", "member"] as const;
export type Role = (typeof ROLES)[number];

export function isRole(value: string): value is Role {
  return (ROLES as readonly string[]).includes(value);
}

/** Workspace settings, the team, and invitations. */
export function canManageWorkspace(role: string): boolean {
  return role === "owner" || role === "admin";
}

/** Owners can manage anyone; admins can manage members only. */
export function canManageMember(actorRole: string, targetRole: string): boolean {
  if (actorRole === "owner") return true;
  return actorRole === "admin" && targetRole === "member";
}

/** Roles an actor is allowed to hand out when inviting. */
export function invitableRoles(actorRole: string): Role[] {
  if (actorRole === "owner") return ["admin", "member"];
  if (actorRole === "admin") return ["member"];
  return [];
}

/** Anyone can delete a deal they created; owners and admins can delete any. */
export function canDeleteDeal(role: string, userId: string, createdBy: string): boolean {
  return canManageWorkspace(role) || userId === createdBy;
}
