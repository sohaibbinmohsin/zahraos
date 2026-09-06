"use client";

import { useEffect, useMemo } from "react";
import { useTeamAccess } from "@/components/team/TeamAccessProvider";
import { useTeamHeader } from "@/components/team/teamHeader";
import { useTeamDrawers } from "@/components/team/TeamDrawers";
import { MembersTable } from "@/components/team/MembersTable";
import { StatCard } from "@/components/team/StatCard";

const LEAD_ROLES = ["Operations Lead", "Drive Coordinator", "Regional Logistics Lead"];
const REVIEWER_ROLES = ["Application Reviewer", "Auditor"];
const ADMIN_ROLES = ["Super Admin"];

export default function TeamMembersPage() {
  const { members, roles, chapters, loading, error } = useTeamAccess();
  const { setAction } = useTeamHeader();
  const { openInvite, openEditMember } = useTeamDrawers();

  useEffect(() => {
    setAction({ label: "Invite Team Member", onClick: openInvite, variant: "primary" });
    return () => setAction(null);
  }, [setAction, openInvite]);

  const stats = useMemo(() => {
    const active = members.filter((m) => m.status === "active");
    const invited = members.filter((m) => m.status === "invited");
    const multi = members.filter((m) => m.assignments.length > 1);
    const bucket = (names: string[]) =>
      active.filter((m) => m.assignments.some((a) => names.includes(a.roleName))).length;
    const twoFa = active.length === 0 ? 100 : Math.round((active.filter((m) => m.enforce2fa).length / active.length) * 100);
    return {
      activeCount: active.length,
      activeSub: `${bucket(ADMIN_ROLES)} Admins · ${bucket(LEAD_ROLES)} Leads · ${bucket(REVIEWER_ROLES)} Reviewers`,
      invitedCount: invited.length,
      multiCount: multi.length,
      twoFa,
    };
  }, [members]);

  if (loading) return <p className="p-8 text-center text-[var(--ink-3)]">Loading team directory…</p>;
  if (error) return <div className="panel p-8 text-center"><p className="text-[var(--ink-2)] font-medium">Couldn&apos;t load team data. {error}</p></div>;

  return (
    <div className="flex flex-col gap-6">
      <div className="stat-grid">
        <StatCard accent="gold" label="Active Team" value={`${stats.activeCount} Members`} sub={stats.activeSub} />
        <StatCard accent="dark" label="Pending Invitations" value={`${stats.invitedCount} Sent`} sub="Awaiting account activation" />
        <StatCard accent="green" label="Multi-Role Staff" value={`${stats.multiCount} Members`} sub="Cross-functional chapter assignments" />
        <StatCard accent="red" label="2FA Compliance" value={`${stats.twoFa}%`} sub="Strict security enforcement" />
      </div>
      <MembersTable members={members} roles={roles} chapters={chapters} onEdit={openEditMember} />
    </div>
  );
}
