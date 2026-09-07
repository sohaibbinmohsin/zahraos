import type { ReactNode } from "react";
import { GovernanceTabs } from "@/components/team/GovernanceTabs";

export default function OrganizationLayout({ children }: { children: ReactNode }) {
  return (
    <div>
      <GovernanceTabs />
      {children}
    </div>
  );
}
