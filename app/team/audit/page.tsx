"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { getBrowserSupabaseClient } from "@/lib/supabase/browserClient";
import { useSelectedOrg, useShellAccessToken } from "@/components/shell/AppShell";
import { useTeamHeader } from "@/components/team/teamHeader";
import { useToast } from "@/components/shell/ToastContext";
import { AuditTable, auditRowsToCsv, type AuditRow } from "@/components/team/AuditTable";
import { StatCard } from "@/components/team/StatCard";
import { StatGridSkeleton, TableSkeleton } from "@/components/ui/skeletons";
import { listAuditLogs } from "@/lib/platformFunctions";

const SAVING9_AUDIT_LOG: AuditRow[] = [
  {
    id: "aud-1",
    createdAt: new Date(Date.now() - 1000 * 60 * 18).toISOString(),
    actorName: "Zainab Nosheen",
    action: "DISPATCH_AUTHORIZED",
    summary: "Dispatched Ambulance LEA 7221 to Dhok Qaziyan (Simly Dam) for STEMI triage",
    ip: "182.180.122.14",
    scopeLabel: "Pind Begwal Hub",
    module: "Maseeha Fleet",
  },
  {
    id: "aud-2",
    createdAt: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
    actorName: "Fatima Zahra",
    action: "ZAKAT_SUBSIDY_APPROVED",
    summary: "Approved 100% Zakat relief subsidy waiver (Rs. 5,000) for Patient Sameer Qazi (#1466)",
    ip: "39.40.82.91",
    scopeLabel: "Org-wide",
    module: "Maseeha Zakat",
  },
  {
    id: "aud-3",
    createdAt: new Date(Date.now() - 1000 * 60 * 110).toISOString(),
    actorName: "Muhammad Faizan",
    action: "EQUIPMENT_MAINTENANCE",
    summary: "Replaced 2x 2,000 PSI medical oxygen cylinders on Ambulance LT-326",
    ip: "182.180.122.25",
    scopeLabel: "Tumair Hub",
    module: "Maseeha Fleet",
  },
  {
    id: "aud-4",
    createdAt: new Date(Date.now() - 1000 * 60 * 240).toISOString(),
    actorName: "Usama Bilal",
    action: "ROLE_PERMISSION_UPDATED",
    summary: "Granted Dr. Ayesha Malik Org Admin governance privileges",
    ip: "119.160.119.5",
    scopeLabel: "Org-wide",
    module: "Team & Governance",
  },
];

export default function TeamAuditPage() {
  const organizationId = useSelectedOrg();
  const accessToken = useShellAccessToken();
  const { setAction } = useTeamHeader();
  const { showToast } = useToast();
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const isSaving9Host =
    typeof window !== "undefined" &&
    (window.location.hostname.startsWith("saving9.") || window.location.hostname.includes("saving9"));
  const isSaving9Demo = organizationId === "org-saving9" || (!organizationId && isSaving9Host);

  const load = useCallback(async () => {
    setLoadError(null);
    if (isSaving9Demo) {
      setRows(SAVING9_AUDIT_LOG);
      setLoading(false);
      return;
    }
    if (!organizationId) {
      setRows([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      // 1. Try unified multi-module endpoint (queries ZahraOS + Youth Republic)
      if (accessToken) {
        try {
          const res = await listAuditLogs({ organizationId }, accessToken);
          if (res?.rows && Array.isArray(res.rows)) {
            setRows(res.rows);
            setLoading(false);
            return;
          }
        } catch {
          // Fall back to direct Supabase client query
        }
      }

      // 2. Direct browser Supabase client fallback
      const supabase = getBrowserSupabaseClient();
      const { data } = await supabase
        .from("admin_audit_log")
        .select("id, created_at, actor_name, action, summary, ip, scope_label, entity_type")
        .eq("organization_id", organizationId)
        .order("created_at", { ascending: false })
        .limit(500);

      setRows((data ?? []).map((r: any) => {
        let mod = "Team & Governance";
        if (["opportunity", "activity_hours", "application", "volunteer"].includes(r.entity_type)) {
          mod = "Youth Republic";
        } else if (["fleet", "zakat", "maseeha"].includes(r.entity_type)) {
          mod = "Maseeha";
        }
        return {
          id: r.id as string,
          createdAt: r.created_at as string,
          actorName: r.actor_name as string,
          action: r.action as string,
          summary: r.summary as string,
          ip: (r.ip as string) ?? null,
          scopeLabel: (r.scope_label as string) ?? null,
          module: mod,
        };
      }));
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "load_failed");
    }
    setLoading(false);
  }, [organizationId, accessToken, isSaving9Demo]);

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
      roleAndAccess: rows.filter((r) =>
        ["Role Created", "Role Modified", "Access Changed", "Member Added", "Member Removed", "Chapter Created", "Chapter Updated"].includes(r.action)
      ).length,
    };
  }, [rows]);

  if (loading) return (
    <div className="flex flex-col gap-6">
      <StatGridSkeleton />
      <TableSkeleton columns={6} rows={8} />
    </div>
  );
  if (loadError) return <div className="panel p-8 text-center"><p className="text-[var(--ink-2)] font-medium">Couldn&apos;t load team data. {loadError}</p></div>;

  return (
    <div className="flex flex-col gap-6">
      <div className="stat-grid">
        <StatCard accent="gold" label="Total Logged Events" value={`${stats.total} Events`} sub="Across all organization modules" />
        <StatCard accent="green" label="Actions Today" value={`${stats.todayCount} Actions`} sub="Operational and administrative actions" />
        <StatCard accent="dark" label="Authorized Actors" value={`${stats.actors} Staff`} sub="Distinct staff performing changes" />
        <StatCard accent="red" label="Security & Governance" value={`${stats.roleAndAccess} Events`} sub="Role, access, and governance changes" />
      </div>
      <AuditTable rows={rows} />
    </div>
  );
}
