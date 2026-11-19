import { redirect } from "next/navigation";
import { landingPathFor } from "@/lib/shellData";
import { resolveInitialShell } from "@/lib/shellData.server";

/** `/youth-republic` has no page of its own. Send the person to the first page they can open. */
export default async function YouthRepublicIndexPage() {
  const { shell, selectedOrgId } = await resolveInitialShell();
  redirect(landingPathFor(shell, selectedOrgId) ?? "/");
}
