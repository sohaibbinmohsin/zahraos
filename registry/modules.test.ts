import { describe, it, expect } from "vitest";
import { MODULE_REGISTRY } from "./modules";

describe("MODULE_REGISTRY", () => {
  it("starts empty — no module UI is mounted by the shell plan", () => {
    expect(MODULE_REGISTRY).toEqual([]);
  });
});
