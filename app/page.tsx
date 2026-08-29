"use client";

import { useSelectedOrg, useStaffClaims } from "@/components/shell/AppShell";

export default function Home() {
  const selectedOrgId = useSelectedOrg();
  const claims = useStaffClaims();

  if (!claims || (claims.orgRoles.length === 0 && claims.moduleAccess.length === 0)) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-12 text-center">
        <h1 className="text-2xl font-semibold">Welcome</h1>
        <p className="mt-4 text-gray-600">
          You don&apos;t have access to any organization yet. Contact your platform administrator.
        </p>
      </main>
    );
  }

  const hasModuleAccessForSelectedOrg = claims.moduleAccess.some((m) => m.organizationId === selectedOrgId);

  if (selectedOrgId && !hasModuleAccessForSelectedOrg) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-12 text-center">
        <h1 className="text-2xl font-semibold">Welcome</h1>
        <p className="mt-4 text-gray-600">
          No modules are enabled for this organization yet, or you haven&apos;t been granted access to one.
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-12">
      <h1 className="text-2xl font-semibold">Welcome</h1>
      <p className="mt-4 text-gray-600">Select a module from the navigation above.</p>
    </main>
  );
}
