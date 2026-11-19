import { redirect } from "next/navigation";
import { resolveInitialShell } from "@/lib/shellData.server";
import { landingPathFor } from "@/lib/shellData";

/**
 * `/` is never a real page. It forwards an authenticated person to the
 * first page they can open. Someone with no page at all sees the message
 * below.
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
