import { SupabaseClient } from "@supabase/supabase-js";

export interface AuditLogEntry {
  organizationId: string;
  actorStaffId: string | null;
  actorName: string;
  action: string;
  entityType: string;
  entityId?: string | null;
  summary: string;
  scopeLabel?: string | null;
  ip?: string | null;
}

// Best-effort: a failed audit write must never roll back or fail the
// mutation it records. Log and move on.
export async function writeAuditLog(supabase: SupabaseClient, entry: AuditLogEntry): Promise<void> {
  const { error } = await supabase.from("admin_audit_log").insert({
    organization_id: entry.organizationId,
    actor_staff_id: entry.actorStaffId,
    actor_name: entry.actorName,
    action: entry.action,
    entity_type: entry.entityType,
    entity_id: entry.entityId ?? null,
    summary: entry.summary,
    scope_label: entry.scopeLabel ?? null,
    ip: entry.ip ?? null,
  });
  if (error) console.error("writeAuditLog failed", error);
}

export async function actorName(supabase: SupabaseClient, staffId: string): Promise<string> {
  const { data } = await supabase.from("staff").select("full_name").eq("id", staffId).single();
  return (data?.full_name as string) ?? "Unknown";
}
