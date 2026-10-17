import type { Metadata } from "next";
import { MaseehaTabs } from "@/components/maseeha/MaseehaTabs";

export const metadata: Metadata = {
  title: "Saving 9 · Maseeha Operations Command Center",
  description: "Emergency Medical Service operations console for Saving 9 pre-hospital ambulance network.",
};

export default function MaseehaLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="maseeha-root theme-saving9">
      <MaseehaTabs />
      {children}
    </div>
  );
}
