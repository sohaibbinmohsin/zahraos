import { describe, it, expect } from "vitest";
import { isDisplayableLogo } from "./orgLogo";

describe("isDisplayableLogo", () => {
  it("accepts http(s) URLs", () => {
    expect(isDisplayableLogo("https://cdn.example.com/logo.png")).toBe(true);
    expect(isDisplayableLogo("http://example.com/a.svg")).toBe(true);
  });

  it("rejects null, empty, and non-image strings", () => {
    expect(isDisplayableLogo(null)).toBe(false);
    expect(isDisplayableLogo(undefined)).toBe(false);
    expect(isDisplayableLogo("")).toBe(false);
    expect(isDisplayableLogo("not-a-url")).toBe(false);
  });

  it("rejects the 1x1 placeholder pixel data URI from the seed", () => {
    const pixel =
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";
    expect(pixel.length).toBeLessThan(512);
    expect(isDisplayableLogo(pixel)).toBe(false);
  });

  it("accepts a substantial data-URI image", () => {
    expect(isDisplayableLogo("data:image/png;base64," + "A".repeat(600))).toBe(true);
  });
});
