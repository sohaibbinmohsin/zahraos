import { redirect } from "next/navigation";
import { resolveInitialShell } from "@/lib/shellData.server";
import { landingPathFor } from "@/lib/shellData";

/**
 * `/` is never a real page — it forwards an authenticated user to their
 * Youth Republic dashboard, or to the Organization page when that module
 * isn't enabled for their active org. Only a staff account with no org or
 * module access at all falls through to the message below.
 */
export default async function Home() {
  const { shell, selectedOrgId } = await resolveInitialShell();
  const dest = landingPathFor(shell, selectedOrgId);
  if (dest) redirect(dest);

  return (
    <main className="mx-auto max-w-2xl px-4 py-12 text-center">
      <h1 className="text-2xl font-semibold">Welcome</h1>
      <p className="mt-4 text-gray-600">
        You don&apos;t have access to any organization yet. Contact your platform administrator.
      </p>
    </main>
  );
}
