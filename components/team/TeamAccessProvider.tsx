"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { getBrowserSupabaseClient } from "@/lib/supabase/browserClient";
import { useSelectedOrg, useShellAccessToken, useShellStaffToken } from "@/components/shell/AppShell";
import { listChapters, type ChapterRow } from "@/lib/platformFunctions";

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
  expiresAt: string | null;
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

export const FALLBACK_SYSTEM_ROLES: TeamRole[] = [
  {
    id: "system-super-admin",
    name: "Super Admin",
    description: "Full platform control and unconstrained administrative privileges across all operational modules.",
    isSystem: true,
    permissionKeys: [
      "opportunities:write",
      "noticeboard:write",
      "applications:update",
      "applications:read",
      "hours:update",
      "hours:read",
      "team:write",
    ],
  },
  {
    id: "system-org-admin",
    name: "Org Admin",
    description: "Full operational permissions and organization-wide team governance.",
    isSystem: true,
    permissionKeys: [
      "opportunities:write",
      "noticeboard:write",
      "applications:update",
      "applications:read",
      "hours:update",
      "hours:read",
      "team:write",
    ],
  },
];

export const SAVING9_FALLBACK_CHAPTERS: Chapter[] = [
  { id: "chap-pind-begwal", name: "Pind Begwal Hub", city: "Islamabad Rural", status: "active" },
  { id: "chap-tumair", name: "Tumair Hub", city: "Islamabad Rural", status: "active" },
  { id: "chap-jheeng", name: "Jheeng Hub", city: "Islamabad Rural", status: "active" },
];

export const SAVING9_FALLBACK_ROLES: TeamRole[] = [
  {
    id: "role-super-admin",
    name: "Super Admin",
    description: "Full platform control and unconstrained administrative privileges across all operational modules.",
    isSystem: true,
    permissionKeys: ["team:write", "applications:update", "hours:update", "opportunities:write"],
  },
  {
    id: "role-org-admin",
    name: "Org Admin",
    description: "Full operational permissions and organization-wide emergency fleet and personnel governance.",
    isSystem: true,
    permissionKeys: ["team:write", "applications:update", "hours:update", "opportunities:write"],
  },
  {
    id: "role-ops-lead",
    name: "Operations Lead",
    description: "Hub-level dispatch commander, field crew supervision, and live telemetry triage.",
    isSystem: false,
    permissionKeys: ["applications:update", "hours:update", "opportunities:write"],
  },
  {
    id: "role-drive-coord",
    name: "Drive Coordinator",
    description: "Fleet logistics, ambulance equipment calibration, and shift rota management.",
    isSystem: false,
    permissionKeys: ["opportunities:write", "hours:read"],
  },
  {
    id: "role-reviewer",
    name: "Application Reviewer",
    description: "Paramedic volunteer onboarding and candidate credential triage.",
    isSystem: false,
    permissionKeys: ["applications:read", "applications:update"],
  },
  {
    id: "role-auditor",
    name: "Auditor",
    description: "Independent oversight of Zakat relief funds, clinical waivers, and mileage logs.",
    isSystem: true,
    permissionKeys: ["hours:read", "applications:read"],
  },
];

export const SAVING9_FALLBACK_MEMBERS: TeamMember[] = [
  {
    id: "staff-usama",
    fullName: "Usama Bilal",
    email: "usama@saving9.org",
    status: "active",
    lastActiveLabel: "Active now",
    enforce2fa: true,
    expiresAt: null,
    assignments: [
      { id: "asgn-1", roleId: "role-super-admin", roleName: "Super Admin", scopeKind: "org_wide", chapterId: null, scopeLabel: "All Hubs (Org-wide)" },
    ],
  },
  {
    id: "staff-zainab",
    fullName: "Zainab Nosheen",
    email: "zainab@saving9.org",
    status: "active",
    lastActiveLabel: "14 mins ago",
    enforce2fa: true,
    expiresAt: null,
    assignments: [
      { id: "asgn-2", roleId: "role-ops-lead", roleName: "Operations Lead", scopeKind: "chapter", chapterId: "chap-pind-begwal", scopeLabel: "Pind Begwal Hub" },
    ],
  },
  {
    id: "staff-faizan",
    fullName: "Muhammad Faizan",
    email: "faizan@saving9.org",
    status: "active",
    lastActiveLabel: "28 mins ago",
    enforce2fa: true,
    expiresAt: null,
    assignments: [
      { id: "asgn-3", roleId: "role-drive-coord", roleName: "Drive Coordinator", scopeKind: "chapter", chapterId: "chap-tumair", scopeLabel: "Tumair Hub" },
    ],
  },
  {
    id: "staff-hamza",
    fullName: "Hamza Abbasi",
    email: "hamza@saving9.org",
    status: "active",
    lastActiveLabel: "1 hour ago",
    enforce2fa: true,
    expiresAt: null,
    assignments: [
      { id: "asgn-4", roleId: "role-reviewer", roleName: "Application Reviewer", scopeKind: "chapter", chapterId: "chap-jheeng", scopeLabel: "Jheeng Hub" },
    ],
  },
  {
    id: "staff-ayesha",
    fullName: "Dr. Ayesha Malik",
    email: "ayesha@saving9.org",
    status: "active",
    lastActiveLabel: "3 hours ago",
    enforce2fa: true,
    expiresAt: null,
    assignments: [
      { id: "asgn-5", roleId: "role-org-admin", roleName: "Org Admin", scopeKind: "org_wide", chapterId: null, scopeLabel: "All Hubs (Org-wide)" },
    ],
  },
  {
    id: "staff-fatima",
    fullName: "Fatima Zahra",
    email: "fatima@saving9.org",
    status: "active",
    lastActiveLabel: "5 hours ago",
    enforce2fa: true,
    expiresAt: null,
    assignments: [
      { id: "asgn-6", roleId: "role-auditor", roleName: "Auditor", scopeKind: "org_wide", chapterId: null, scopeLabel: "All Hubs (Org-wide)" },
    ],
  },
];

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
  const staffToken = useShellStaffToken();
  const [moduleId, setModuleId] = useState<string | null>(null);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [roles, setRoles] = useState<TeamRole[]>([]);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!organizationId || organizationId === "org-saving9") {
      setRoles(SAVING9_FALLBACK_ROLES);
      setMembers(SAVING9_FALLBACK_MEMBERS);
      setChapters(SAVING9_FALLBACK_CHAPTERS);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const supabase = getBrowserSupabaseClient();

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

      // Ensure system roles recognized, including Org Admin
      const hasOrgAdmin = typedRoles.some((r) => r.name.toLowerCase() === "org admin");
      if (!hasOrgAdmin) {
        const fallbackOrgAdmin = FALLBACK_SYSTEM_ROLES.find((r) => r.name === "Org Admin");
        if (fallbackOrgAdmin) typedRoles.push(fallbackOrgAdmin);
      }
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
        const matchedRole = roleById.get(a.role_id as string);
        const roleName = matchedRole?.name
          ?? (a.role_id === "system-org-admin" || a.role_id === "org-admin" || a.role_id?.toLowerCase() === "org admin"
            ? "Org Admin"
            : a.role_id === "system-super-admin" || a.role_id === "super-admin" || a.role_id?.toLowerCase() === "super admin"
            ? "Super Admin"
            : "Unknown role");
        list.push({
          id: a.id as string,
          roleId: a.role_id as string,
          roleName,
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
          .select("id, full_name, email, status, deactivated_at, expires_at")
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
        expiresAt: (s.expires_at as string) ?? null,
        assignments: assignmentsByStaff.get(s.id as string) ?? [],
      })));

      if (accessToken) {
        try {
          const res = await listChapters({ organizationId }, accessToken);
          setChapters(res.chapters.map((c: ChapterRow) => ({ id: c.id, name: c.name, city: c.city, status: c.status })));
        } catch {
          setChapters([]);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "load_failed");
    } finally {
      setLoading(false);
    }
  }, [organizationId, accessToken]);

  useEffect(() => { refresh(); }, [refresh]);

  const value = useMemo<TeamAccessValue>(() => ({
    organizationId, accessToken, staffToken, moduleId, members, roles, chapters, loading, error, refresh,
  }), [organizationId, accessToken, staffToken, moduleId, members, roles, chapters, loading, error, refresh]);

  return <TeamAccessContext.Provider value={value}>{children}</TeamAccessContext.Provider>;
}
