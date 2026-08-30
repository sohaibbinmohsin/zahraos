import { describe, it, expect } from "vitest";
import { MODULE_REGISTRY } from "./modules";

describe("MODULE_REGISTRY", () => {
  it("registers the vms module", () => {
    expect(MODULE_REGISTRY).toEqual([
      { key: "vms", navLabel: "VMS", route: "/modules/vms", icon: "🤝" },
    ]);
  });
});
