import { InviteForm } from "@/components/invite-form";
import { Badge, Button } from "@/components/ui";
import { removeMemberAction, revokeInviteAction } from "@/lib/actions";
import { formatDate } from "@/lib/format";
import { listMembers, listPendingInvites } from "@/lib/invites";
import { canManageMember, canManageWorkspace, invitableRoles } from "@/lib/permissions";
import { requireWorkspace } from "@/lib/workspace";

export const metadata = { title: "Team" };

export default async function TeamPage() {
  const workspace = await requireWorkspace();
  const manage = canManageWorkspace(workspace.role);
  const [members, invites] = await Promise.all([
    listMembers(workspace.organization.id),
    manage ? listPendingInvites(workspace.organization.id) : Promise.resolve([]),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">Workspace</p>
        <h1 className="font-serif text-4xl tracking-tight">Team</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
          People in {workspace.organization.name} share its deals and factors. Owners and admins can invite people and
          change the factors. Members can create and run deals, and delete their own.
        </p>
      </div>

      {manage ? (
        <section className="rounded-lg border border-line bg-card p-4">
          <h2 className="font-semibold">Invite someone</h2>
          <p className="mt-1 text-sm text-muted">
            You get a one-time link to send them. It works only for the email you enter and expires in 7 days.
          </p>
          <div className="mt-4">
            <InviteForm roles={invitableRoles(workspace.role)} />
          </div>
        </section>
      ) : null}

      <section>
        <h2 className="mb-2 font-semibold">Members</h2>
        <div className="overflow-hidden rounded-lg border border-line">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-paper-2 text-xs uppercase tracking-[0.12em] text-muted">
              <tr>
                <th className="px-3 py-2 font-medium">Name</th>
                <th className="px-3 py-2 font-medium">Role</th>
                <th className="px-3 py-2 font-medium">Joined</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {members.map((member) => (
                <tr key={member.userId} className="border-t border-line bg-card">
                  <td className="px-3 py-3">
                    <p className="font-medium">{member.name}</p>
                    <p className="text-xs text-muted">{member.email}</p>
                  </td>
                  <td className="px-3 py-3">
                    <Badge tone={member.role === "owner" ? "high" : "neutral"}>{member.role}</Badge>
                  </td>
                  <td className="px-3 py-3 text-muted">{formatDate(member.joinedAt)}</td>
                  <td className="px-3 py-3 text-right">
                    {member.userId !== workspace.user.id && canManageMember(workspace.role, member.role) ? (
                      <form action={removeMemberAction}>
                        <input type="hidden" name="userId" value={member.userId} />
                        <Button type="submit" variant="danger" size="sm">
                          Remove
                        </Button>
                      </form>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {manage && invites.length > 0 ? (
        <section>
          <h2 className="mb-2 font-semibold">Pending invites</h2>
          <div className="overflow-hidden rounded-lg border border-line">
            <table className="min-w-full text-left text-sm">
              <tbody>
                {invites.map((invite) => (
                  <tr key={invite.id} className="border-t border-line bg-card first:border-t-0">
                    <td className="px-3 py-3">
                      <p className="font-medium">{invite.email}</p>
                      <p className="text-xs text-muted">
                        {invite.role} · expires {formatDate(invite.expiresAt)}
                      </p>
                    </td>
                    <td className="px-3 py-3 text-right">
                      <form action={revokeInviteAction}>
                        <input type="hidden" name="inviteId" value={invite.id} />
                        <Button type="submit" variant="outline" size="sm">
                          Revoke
                        </Button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </div>
  );
}
