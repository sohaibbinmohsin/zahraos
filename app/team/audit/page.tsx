"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { getBrowserSupabaseClient } from "@/lib/supabase/browserClient";
import { useSelectedOrg } from "@/components/shell/AppShell";
import { useTeamHeader } from "@/components/team/teamHeader";
import { useToast } from "@/components/shell/ToastContext";
import { AuditTable, auditRowsToCsv, type AuditRow } from "@/components/team/AuditTable";
import { StatCard } from "@/components/team/StatCard";

export default function TeamAuditPage() {
  const organizationId = useSelectedOrg();
  const { setAction } = useTeamHeader();
  const { showToast } = useToast();
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!organizationId) return;
    setLoading(true);
    const supabase = getBrowserSupabaseClient();
    const { data } = await supabase
      .from("admin_audit_log")
      .select("id, created_at, actor_name, action, summary, ip, scope_label")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false })
      .limit(500);
    setRows((data ?? []).map((r) => ({
      id: r.id as string,
      createdAt: r.created_at as string,
      actorName: r.actor_name as string,
      action: r.action as string,
      summary: r.summary as string,
      ip: (r.ip as string) ?? null,
      scopeLabel: (r.scope_label as string) ?? null,
    })));
    setLoading(false);
  }, [organizationId]);

  useEffect(() => { load(); }, [load]);

  const exportCsv = useCallback(() => {
    const blob = new Blob([auditRowsToCsv(rows)], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `team-audit-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast("Exported the audit trail (CSV).");
  }, [rows, showToast]);

  useEffect(() => {
    setAction({ label: "Export Audit CSV", onClick: exportCsv, variant: "secondary" });
    return () => setAction(null);
  }, [setAction, exportCsv]);

  const stats = useMemo(() => {
    const today = new Date().toDateString();
    return {
      total: rows.length,
      todayCount: rows.filter((r) => new Date(r.createdAt).toDateString() === today).length,
      actors: new Set(rows.map((r) => r.actorName)).size,
      roleAndAccess: rows.filter((r) => ["Role Created", "Role Modified", "Access Changed"].includes(r.action)).length,
    };
  }, [rows]);

  if (loading) return <p className="p-8 text-center text-[var(--ink-3)]">Loading audit log…</p>;

  return (
    <div className="flex flex-col gap-6">
      <div className="stat-grid">
        <StatCard accent="gold" label="Total Logged Events" value={`${stats.total} Events`} sub="Team & Access administrative record" />
        <StatCard accent="green" label="Actions Today" value={`${stats.todayCount} Actions`} sub="Invites, role changes, access edits" />
        <StatCard accent="dark" label="Authorized Actors" value={`${stats.actors} Admins`} sub="Distinct staff performing changes" />
        <StatCard accent="red" label="Security & Role Updates" value={`${stats.roleAndAccess} Events`} sub="Role and access modifications" />
      </div>
      <AuditTable rows={rows} />
    </div>
  );
}
