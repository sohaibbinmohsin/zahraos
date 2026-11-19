import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { youthRepublicBounceTarget } from "@/lib/shellData";
import { resolveInitialShell } from "@/lib/shellData.server";
import { YouthRepublicModuleFrame } from "./ModuleFrame";

/**
 * A Youth Republic URL this person cannot open never reaches the browser.
 * The redirect happens on the request, so login does not paint an empty
 * Youth Republic screen and then correct itself.
 */
export default async function YouthRepublicLayout({ children }: { children: React.ReactNode }) {
  const pathname = (await headers()).get("x-pathname") ?? "";
  const { shell, selectedOrgId } = await resolveInitialShell();
  const bounce = youthRepublicBounceTarget(shell, selectedOrgId, pathname);
  if (bounce && bounce !== pathname) redirect(bounce);

  return <YouthRepublicModuleFrame>{children}</YouthRepublicModuleFrame>;
}
