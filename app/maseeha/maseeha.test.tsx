import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import MaseehaDashboardPage from "./dashboard/page";
import EmergencyCasesPage from "./cases/page";
import ZakatAuditPage from "./zakat/page";
import FleetReadinessPage from "./fleet/page";
import MedicalSuppliesPage from "./supplies/page";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/maseeha/dashboard",
  useSearchParams: () => new URLSearchParams(),
}));

describe("Saving 9 Maseeha Admin Portal Prototype", () => {
  it("renders Maseeha Executive Dashboard with KPI stat tiles and hospital distribution", () => {
    render(<MaseehaDashboardPage />);

    expect(screen.getByText("Operations Command Center")).toBeInTheDocument();
    expect(screen.getByText("Total Emergency Runs")).toBeInTheDocument();
    expect(screen.getByText("1,456")).toBeInTheDocument();
    expect(screen.getByText("Avg Response Time")).toBeInTheDocument();
    expect(screen.getByText("13.8 min")).toBeInTheDocument();
    expect(screen.getByText("Emergency Destination Hospital Distribution")).toBeInTheDocument();
    expect(screen.getByText("Fleet Readiness")).toBeInTheDocument();
  });

  it("renders Emergency Cases Ledger, searches cases, and opens case dossier drawer", () => {
    render(<EmergencyCasesPage />);

    expect(screen.getByText("Emergency Cases Ledger")).toBeInTheDocument();
    expect(screen.getByText("Sameer Qazi")).toBeInTheDocument();
    expect(screen.getByText("Riffat Shaheen")).toBeInTheDocument();

    // Click on a case to open drawer
    const inspectButtons = screen.getAllByText("Inspect Dossier →");
    expect(inspectButtons.length).toBeGreaterThan(0);
    fireEvent.click(inspectButtons[0]);

    // Drawer should show clinical vitals and chief complaint
    expect(screen.getByText("Chief Complaint & Incident Scene Assessment")).toBeInTheDocument();
    expect(screen.getByText("Pre-Hospital Clinical Vitals")).toBeInTheDocument();
    expect(screen.getByText("Mission Telemetry & Durations")).toBeInTheDocument();
  });

  it("renders Zakat & Welfare Relief Audit Queue with pool metrics", () => {
    render(<ZakatAuditPage />);

    expect(screen.getByText("Zakat & Welfare Relief Audit")).toBeInTheDocument();
    expect(screen.getByText("Monthly Zakat Pool")).toBeInTheDocument();
    expect(screen.getByText("Rs. 150,000")).toBeInTheDocument();
    expect(screen.getByText("Pending Audit Requests")).toBeInTheDocument();
  });

  it("renders Ambulance Fleet & Crew Readiness with vehicles and crew roster", () => {
    render(<FleetReadinessPage />);

    expect(screen.getByText("Ambulance Fleet & Crew Readiness")).toBeInTheDocument();
    expect(screen.getByText("LEA 7221")).toBeInTheDocument();
    expect(screen.getByText("LT-326")).toBeInTheDocument();
    expect(screen.getByText("RWP-901")).toBeInTheDocument();
  });

  it("renders Medical Consumables & Supplies with inventory items", () => {
    render(<MedicalSuppliesPage />);

    expect(screen.getByText("Medical Consumables & Supplies")).toBeInTheDocument();
    expect(screen.getByText("IV Cannula 18G (Green)")).toBeInTheDocument();
    expect(screen.getAllByText("Medical Oxygen 40L Cylinders").length).toBeGreaterThan(0);
  });
});
