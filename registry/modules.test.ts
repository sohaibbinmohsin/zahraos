import { describe, it, expect } from "vitest";
import { MODULE_REGISTRY } from "./modules";

describe("MODULE_REGISTRY", () => {
  it("registers the Youth Republic module", () => {
    expect(MODULE_REGISTRY).toEqual([
      { key: "youth-republic", navLabel: "Youth Republic", route: "/modules/youth-republic", icon: "🤝" },
    ]);
  });
});
