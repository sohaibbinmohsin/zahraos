import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Maseeha Operations Command Center · Saving 9 & ZahraOS",
  description: "Emergency Medical Service operations console for Saving 9 pre-hospital ambulance network.",
};

export default function MaseehaLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="maseeha-root theme-saving9">
      {children}
    </div>
  );
}
