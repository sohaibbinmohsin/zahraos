"use client";

import { createContext, useContext } from "react";

export interface TeamHeaderAction {
  label: string;
  onClick: () => void;
  variant: "primary" | "secondary";
}

export const TeamHeaderContext = createContext<{
  action: TeamHeaderAction | null;
  setAction: (a: TeamHeaderAction | null) => void;
}>({ action: null, setAction: () => {} });

export function useTeamHeader() {
  const { setAction } = useContext(TeamHeaderContext);
  return { setAction };
}
