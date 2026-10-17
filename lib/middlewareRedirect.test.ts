import { describe, it, expect } from "vitest";
import { computeMiddlewareRedirect } from "./middlewareRedirect";

describe("computeMiddlewareRedirect", () => {
  it("redirects an unauthenticated request on a protected path to /login", () => {
    const result = computeMiddlewareRedirect({ pathname: "/staff", isAuthenticated: false, mustChangePassword: false });
    expect(result).toBe("/login");
  });

  it("lets an unauthenticated request through on /login itself", () => {
    const result = computeMiddlewareRedirect({ pathname: "/login", isAuthenticated: false, mustChangePassword: false });
    expect(result).toBeNull();
  });

  it("redirects an authenticated request that must change password to /set-password", () => {
    const result = computeMiddlewareRedirect({ pathname: "/staff", isAuthenticated: true, mustChangePassword: true });
    expect(result).toBe("/set-password");
  });

  it("lets an authenticated must-change-password request through on /set-password itself", () => {
    const result = computeMiddlewareRedirect({ pathname: "/set-password", isAuthenticated: true, mustChangePassword: true });
    expect(result).toBeNull();
  });

  it("redirects away from /set-password once the password no longer needs changing", () => {
    const result = computeMiddlewareRedirect({ pathname: "/set-password", isAuthenticated: true, mustChangePassword: false });
    expect(result).toBe("/");
  });

  it("redirects an authenticated request away from /login to the home page", () => {
    const result = computeMiddlewareRedirect({ pathname: "/login", isAuthenticated: true, mustChangePassword: false });
    expect(result).toBe("/");
  });

  it("lets a fully authenticated, password-set request through on any other path", () => {
    const result = computeMiddlewareRedirect({ pathname: "/staff", isAuthenticated: true, mustChangePassword: false });
    expect(result).toBeNull();
  });

  it("lets unauthenticated requests through to public static assets", () => {
    expect(computeMiddlewareRedirect({ pathname: "/assets/saving9-logo-cropped.png", isAuthenticated: false, mustChangePassword: false })).toBeNull();
    expect(computeMiddlewareRedirect({ pathname: "/assets/mohsin-project-white-bird.png", isAuthenticated: false, mustChangePassword: false })).toBeNull();
  });

  it("lets unauthenticated requests through to maseeha routes and saving9 governance", () => {
    expect(computeMiddlewareRedirect({ pathname: "/maseeha/dashboard", isAuthenticated: false, mustChangePassword: false })).toBeNull();
    expect(computeMiddlewareRedirect({ pathname: "/team/members", isAuthenticated: false, mustChangePassword: false, isSaving9Host: true })).toBeNull();
    expect(computeMiddlewareRedirect({ pathname: "/organization", isAuthenticated: false, mustChangePassword: false, isSaving9Host: true })).toBeNull();
  });
});
