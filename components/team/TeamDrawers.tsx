"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { InviteMemberDrawer } from "./InviteMemberDrawer";
import { EditMemberDrawer } from "./EditMemberDrawer";
import { RoleDrawer } from "./RoleDrawer";

interface DrawerState {
  invite: boolean;
  editMemberId: string | null;
  role: { mode: "create" | "edit" | "view" | "clone"; roleId: string | null } | null;
}

interface TeamDrawersValue {
  openInvite: () => void;
  openEditMember: (memberId: string) => void;
  openCreateRole: () => void;
  openEditRole: (roleId: string, readOnly: boolean) => void;
  openCloneRole: (roleId: string) => void;
  close: () => void;
  state: DrawerState;
}

const TeamDrawersContext = createContext<TeamDrawersValue | null>(null);

export function useTeamDrawers() {
  const ctx = useContext(TeamDrawersContext);
  if (!ctx) throw new Error("useTeamDrawers must be used inside TeamDrawersProvider");
  return ctx;
}

export function TeamDrawersProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<DrawerState>({ invite: false, editMemberId: null, role: null });
  const close = useCallback(() => setState({ invite: false, editMemberId: null, role: null }), []);
  const openInvite = useCallback(() => setState({ invite: true, editMemberId: null, role: null }), []);
  const openEditMember = useCallback(
    (memberId: string) => setState({ invite: false, editMemberId: memberId, role: null }),
    [],
  );
  const openCreateRole = useCallback(
    () => setState({ invite: false, editMemberId: null, role: { mode: "create", roleId: null } }),
    [],
  );
  const openEditRole = useCallback(
    (roleId: string, readOnly: boolean) =>
      setState({ invite: false, editMemberId: null, role: { mode: readOnly ? "view" : "edit", roleId } }),
    [],
  );
  const openCloneRole = useCallback(
    (roleId: string) => setState({ invite: false, editMemberId: null, role: { mode: "clone", roleId } }),
    [],
  );

  const value = useMemo<TeamDrawersValue>(() => ({
    openInvite,
    openEditMember,
    openCreateRole,
    openEditRole,
    openCloneRole,
    close,
    state,
  }), [state, openInvite, openEditMember, openCreateRole, openEditRole, openCloneRole, close]);

  return (
    <TeamDrawersContext.Provider value={value}>
      {children}
      <InviteMemberDrawer open={state.invite} onClose={close} />
      <EditMemberDrawer memberId={state.editMemberId} onClose={close} />
      <RoleDrawer request={state.role} onClose={close} />
    </TeamDrawersContext.Provider>
  );
}
