"use client";

import { useEffect, useMemo } from "react";
import { useTeamAccess } from "@/components/team/TeamAccessProvider";
import { useTeamHeader } from "@/components/team/teamHeader";
import { useTeamDrawers } from "@/components/team/TeamDrawers";
import { RolesTable } from "@/components/team/RolesTable";
import { ChaptersPanel } from "@/components/team/ChaptersPanel";
import { StatCard } from "@/components/team/StatCard";
import { useToast } from "@/components/shell/ToastContext";
import { deleteCustomRole } from "@/lib/platformFunctions";

export default function TeamRolesPage() {
  const { roles, members, accessToken, loading, error, refresh } = useTeamAccess();
  const { setAction } = useTeamHeader();
  const { openCreateRole, openEditRole, openCloneRole } = useTeamDrawers();
  const { showToast } = useToast();

  useEffect(() => {
    setAction({ label: "Create Custom Role", onClick: openCreateRole, variant: "primary" });
    return () => setAction(null);
  }, [setAction, openCreateRole]);

  const assignmentCountByRoleId = useMemo(() => {
    const counts = new Map<string, number>();
    for (const m of members) for (const a of m.assignments) counts.set(a.roleId, (counts.get(a.roleId) ?? 0) + 1);
    return counts;
  }, [members]);

  const systemCount = roles.filter((r) => r.isSystem).length;
  const customCount = roles.length - systemCount;
  const totalAssignments = members.reduce((n, m) => n + m.assignments.length, 0);

  async function onDelete(roleId: string) {
    if (!accessToken) return;
    const role = roles.find((r) => r.id === roleId);
    if (!role || !window.confirm(`Permanently delete custom role "${role.name}"?`)) return;
    try {
      await deleteCustomRole({ roleId }, accessToken);
      await refresh();
      showToast(`Deleted custom role "${role.name}".`);
    } catch (err) {
      showToast(err instanceof Error && err.message === "role_in_use"
        ? `Cannot delete "${role.name}" — it is still assigned. Reassign those members first.`
        : "Failed to delete role.");
    }
  }

  if (loading) return <p className="p-8 text-center text-[var(--ink-3)]">Loading roles…</p>;
  if (error) return <div className="panel p-8 text-center"><p className="text-[var(--ink-2)] font-medium">Couldn&apos;t load team data. {error}</p></div>;

  return (
    <div className="flex flex-col gap-6">
      <div className="stat-grid">
        <StatCard accent="gold" label="Total Configured Roles" value={`${roles.length} Roles`} sub={`${systemCount} System Default · ${customCount} Custom Organization`} />
        <StatCard accent="green" label="Active Role Assignments" value={`${totalAssignments} Active`} sub={`Assigned across ${members.length} staff members`} />
        <StatCard accent="dark" label="Custom Roles" value={`${customCount} Roles`} sub="Fully editable and customizable" />
        <StatCard accent="red" label="Governed Modules" value="1 Module" sub="Youth Republic" />
      </div>

      <RolesTable
        roles={roles}
        assignmentCountByRoleId={assignmentCountByRoleId}
        onView={(id) => openEditRole(id, true)}
        onEdit={(id) => openEditRole(id, false)}
        onClone={openCloneRole}
        onDelete={onDelete}
      />

      <ChaptersPanel />
    </div>
  );
}
