import type { Metadata } from "next";
import { AppShell } from "@/components/shell/AppShell";
import "./globals.css";

export const metadata: Metadata = {
  title: "Youth Republic — Operations Command Center (Powered by ZahraOS)",
  description: "Youth Republic Volunteer Operations & Noticeboard",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Jost:ital,wght@0,400;0,500;0,600;0,700;1,400&family=Oswald:wght@500;600;700&family=Space+Mono:wght@400;700&display=swap"
        />
      </head>
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
