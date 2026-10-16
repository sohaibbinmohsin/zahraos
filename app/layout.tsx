import type { Metadata } from "next";
import { AppShell } from "@/components/shell/AppShell";
import { ConfirmProvider } from "@/components/ui/ConfirmDialog";
import { SwrProvider } from "@/components/providers/SwrProvider";
import { resolveInitialShell } from "@/lib/shellData.server";
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
          href="https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&family=Plus+Jakarta+Sans:ital,wght@0,400..800;1,400..800&family=JetBrains+Mono:ital,wght@0,400..700;1,400..700&family=Space+Mono:ital,wght@0,400;0,700;1,400;1,700&display=swap"
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
