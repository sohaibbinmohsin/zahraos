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

  const value = useMemo<TeamDrawersValue>(() => ({
    openInvite: () => setState({ invite: true, editMemberId: null, role: null }),
    openEditMember: (memberId) => setState({ invite: false, editMemberId: memberId, role: null }),
    openCreateRole: () => setState({ invite: false, editMemberId: null, role: { mode: "create", roleId: null } }),
    openEditRole: (roleId, readOnly) =>
      setState({ invite: false, editMemberId: null, role: { mode: readOnly ? "view" : "edit", roleId } }),
    openCloneRole: (roleId) =>
      setState({ invite: false, editMemberId: null, role: { mode: "clone", roleId } }),
    close,
    state,
  }), [state, close]);

  return (
    <TeamDrawersContext.Provider value={value}>
      {children}
      <InviteMemberDrawer open={state.invite} onClose={close} />
      <EditMemberDrawer memberId={state.editMemberId} onClose={close} />
      <RoleDrawer request={state.role} onClose={close} />
    </TeamDrawersContext.Provider>
  );
}
