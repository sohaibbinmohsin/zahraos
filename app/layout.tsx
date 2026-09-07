import type { Metadata } from "next";
import { cookies } from "next/headers";
import { AppShell } from "@/components/shell/AppShell";
import { ConfirmProvider } from "@/components/ui/ConfirmDialog";
import { SwrProvider } from "@/components/providers/SwrProvider";
import { getServerSupabaseClient } from "@/lib/supabase/serverClient";
import { loadShellData, type ShellData } from "@/lib/shellData";
import { SELECTED_ORG_COOKIE } from "@/lib/selectedOrg";
import "./globals.css";

export const metadata: Metadata = {
  title: "Rizq Admin | ZahraOS",
  description: "Rizq Partner Administration & Governance Platform (Powered by ZahraOS)",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/assets/favicon.svg", type: "image/svg+xml" },
      { url: "/favicon.png", type: "image/png" },
    ],
    shortcut: "/favicon.ico",
    apple: "/apple-icon.png",
  },
};

/**
 * Resolve the shell server-side so the very first byte of HTML already has
 * the real sidebar, brand mark and profile — no post-hydration blink. The
 * middleware has already verified the session with getUser(); reading it
 * from the cookie with getSession() here avoids a second auth round-trip.
 * If anything fails we render nothing extra and let AppShell fall back to
 * its own client-side load.
 */
async function resolveInitialShell(): Promise<{
  shell: ShellData | null;
  selectedOrgId: string | null;
}> {
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
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const { shell, selectedOrgId } = await resolveInitialShell();

  return (
    <html lang="en">
      <head>
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="icon" href="/assets/favicon.svg" type="image/svg+xml" />
        <link rel="icon" href="/favicon.png" type="image/png" />
        <link rel="apple-touch-icon" href="/apple-icon.png" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Jost:ital,wght@0,400;0,500;0,600;0,700;1,400&family=Oswald:wght@500;600;700&family=Space+Mono:wght@400;700&display=swap"
        />
      </head>
      <body>
        <SwrProvider>
          <ConfirmProvider>
            <AppShell initialShell={shell} initialSelectedOrgId={selectedOrgId}>
              {children}
            </AppShell>
          </ConfirmProvider>
        </SwrProvider>
      </body>
    </html>
  );
}
