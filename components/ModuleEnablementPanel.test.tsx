import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ModuleEnablementPanel } from "./ModuleEnablementPanel";
import * as platformFunctions from "@/lib/platformFunctions";

vi.mock("@/lib/platformFunctions");

describe("ModuleEnablementPanel", () => {
  beforeEach(() => {
    vi.mocked(platformFunctions.enableModule).mockReset();
  });

  it("shows enabled modules as enabled and offers to enable the rest", async () => {
    vi.mocked(platformFunctions.enableModule).mockResolvedValue({ moduleKey: "health" });
    const onEnabled = vi.fn();
    const user = userEvent.setup();

    render(
      <ModuleEnablementPanel
        organizationId="org-1"
        allModules={[{ id: "mod-youth-republic", key: "youth-republic", displayName: "Youth Republic" }, { id: "mod-health", key: "health", displayName: "Health" }]}
        enabledModuleKeys={["youth-republic"]}
        accessToken="session-token"
        onEnabled={onEnabled}
      />,
    );

    expect(screen.getByText("Youth Republic")).toBeInTheDocument();
    expect(screen.getByText("Enabled")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Enable" }));

    await waitFor(() => {
      expect(platformFunctions.enableModule).toHaveBeenCalledWith(
        { organizationId: "org-1", moduleKey: "health" },
        "session-token",
      );
      expect(onEnabled).toHaveBeenCalled();
    });
  });
});
