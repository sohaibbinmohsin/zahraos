"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { getBrowserSupabaseClient } from "@/lib/supabase/browserClient";
import { fetchStaffToken } from "@/lib/staffToken";
import { useSelectedOrg, useShellAccessToken } from "@/components/shell/AppShell";
import { listChapters } from "@/lib/youthRepublicFunctions";

export interface MemberAssignment {
  id: string;
  roleId: string;
  roleName: string;
  scopeKind: "org_wide" | "chapter";
  chapterId: string | null;
  scopeLabel: string;
}
export interface TeamMember {
  id: string;
  fullName: string;
  email: string;
  status: "active" | "invited" | "deactivated";
  lastActiveLabel: string;
  enforce2fa: boolean;
  assignments: MemberAssignment[];
}
export interface TeamRole {
  id: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  permissionKeys: string[];
}
export interface Chapter {
  id: string;
  name: string;
  city: string | null;
  status: string;
}

interface TeamAccessValue {
  organizationId: string | null;
  accessToken: string | null;
  staffToken: string | null;
  moduleId: string | null;
  members: TeamMember[];
  roles: TeamRole[];
  chapters: Chapter[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

const TeamAccessContext = createContext<TeamAccessValue>({
  organizationId: null, accessToken: null, staffToken: null, moduleId: null,
  members: [], roles: [], chapters: [], loading: true, error: null, refresh: async () => {},
});

export function useTeamAccess() {
  return useContext(TeamAccessContext);
}

export function TeamAccessProvider({ children }: { children: React.ReactNode }) {
  const organizationId = useSelectedOrg();
  const accessToken = useShellAccessToken();
  const [staffToken, setStaffToken] = useState<string | null>(null);
  const [moduleId, setModuleId] = useState<string | null>(null);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [roles, setRoles] = useState<TeamRole[]>([]);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!organizationId) return;
    setLoading(true);
    setError(null);
    try {
      const supabase = getBrowserSupabaseClient();
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token ?? null;
      const st = token ? await fetchStaffToken(token) : null;
      setStaffToken(st);

      const { data: moduleRow } = await supabase.from("modules").select("id").eq("key", "youth-republic").single();
      const modId = (moduleRow?.id as string) ?? null;
      setModuleId(modId);

      const { data: roleRows } = await supabase
        .from("roles")
        .select("id, name, description, is_system, role_permissions(permissions(resource, action))")
        .eq("organization_id", organizationId)
        .eq("module_id", modId);
      const typedRoles: TeamRole[] = (roleRows ?? []).map((r) => ({
        id: r.id as string,
        name: r.name as string,
        description: (r.description as string) ?? null,
        isSystem: Boolean(r.is_system),
        permissionKeys: ((r.role_permissions ?? []) as unknown as Array<{ permissions: { resource: string; action: string } }>)
          .map((rp) => `${rp.permissions.resource}:${rp.permissions.action}`),
      }));
      setRoles(typedRoles);
      const roleById = new Map(typedRoles.map((r) => [r.id, r]));

      const { data: assignmentRows } = await supabase
        .from("staff_role_assignments")
        .select("id, staff_id, role_id, scope_kind, chapter_id, scope_label")
        .eq("organization_id", organizationId)
        .eq("module_id", modId);
      const assignmentsByStaff = new Map<string, MemberAssignment[]>();
      for (const a of assignmentRows ?? []) {
        const list = assignmentsByStaff.get(a.staff_id as string) ?? [];
        list.push({
          id: a.id as string,
          roleId: a.role_id as string,
          roleName: roleById.get(a.role_id as string)?.name ?? "Unknown role",
          scopeKind: a.scope_kind as "org_wide" | "chapter",
          chapterId: (a.chapter_id as string) ?? null,
          scopeLabel: a.scope_label as string,
        });
        assignmentsByStaff.set(a.staff_id as string, list);
      }

      const staffIds = [...assignmentsByStaff.keys()];
      let staffRows: Array<Record<string, unknown>> = [];
      if (staffIds.length > 0) {
        const { data } = await supabase
          .from("staff")
          .select("id, full_name, email, status, deactivated_at")
          .in("id", staffIds);
        staffRows = data ?? [];
      }
      const { data: inviteRows } = await supabase
        .from("staff_invitations")
        .select("staff_id, enforce_2fa, status")
        .eq("organization_id", organizationId);
      const enforce2faByStaff = new Map(
        (inviteRows ?? []).map((i) => [i.staff_id as string, Boolean(i.enforce_2fa)]),
      );

      setMembers(staffRows.map((s) => ({
        id: s.id as string,
        fullName: s.full_name as string,
        email: s.email as string,
        status: s.status as "active" | "invited" | "deactivated",
        lastActiveLabel: s.status === "invited" ? "Invited (Pending Sign-in)" : "—",
        enforce2fa: enforce2faByStaff.get(s.id as string) ?? true,
        assignments: assignmentsByStaff.get(s.id as string) ?? [],
      })));

      if (st) {
        try {
          const res = await listChapters({ organizationId }, st);
          setChapters(res.chapters.map((c) => ({ id: c.id, name: c.name, city: c.city, status: c.status })));
        } catch {
          setChapters([]);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "load_failed");
    } finally {
      setLoading(false);
    }
  }, [organizationId]);

  useEffect(() => { refresh(); }, [refresh]);

  const value = useMemo<TeamAccessValue>(() => ({
    organizationId, accessToken, staffToken, moduleId, members, roles, chapters, loading, error, refresh,
  }), [organizationId, accessToken, staffToken, moduleId, members, roles, chapters, loading, error, refresh]);

  return <TeamAccessContext.Provider value={value}>{children}</TeamAccessContext.Provider>;
}
