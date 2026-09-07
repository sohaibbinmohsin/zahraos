import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { getServerSupabaseClient } from "./supabase/serverClient";
import { loadShellData, type ShellData } from "./shellData";
import { SELECTED_ORG_COOKIE } from "./selectedOrg";

/**
 * Resolve the shell from the request's cookies. `cache()` dedupes it within
 * a single request, so the root layout and the `/` page share one
 * resolution. Returns nulls on any failure — callers fall back to a
 * client-side load. Kept out of shellData.ts so client components can
 * import loadShellData / types without pulling in next/headers.
 */
export const resolveInitialShell = cache(async (): Promise<{
  shell: ShellData | null;
  selectedOrgId: string | null;
}> => {
  try {
    const supabase = await getServerSupabaseClient();
    const { data } = await supabase.auth.getSession();
    if (!data.session) return { shell: null, selectedOrgId: null };
    const [shell, cookieStore] = await Promise.all([
      loadShellData(supabase, data.session),
      cookies(),
    ]);
    return { shell, selectedOrgId: cookieStore.get(SELECTED_ORG_COOKIE)?.value ?? null };
  } catch {
    return { shell: null, selectedOrgId: null };
  }
});
