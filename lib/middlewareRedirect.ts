export interface MiddlewareRedirectInput {
  pathname: string;
  isAuthenticated: boolean;
  mustChangePassword: boolean;
  isSaving9Host?: boolean;
}

export function computeMiddlewareRedirect(input: MiddlewareRedirectInput): string | null {
  const { pathname, isAuthenticated, mustChangePassword, isSaving9Host } = input;
  const isLoginPath = pathname === "/login" || pathname.startsWith("/login/");
  const isSetPasswordPath = pathname === "/set-password" || pathname.startsWith("/set-password/");
  const isMaseehaPath = pathname === "/maseeha" || pathname.startsWith("/maseeha/");
  const isPublicAsset =
    pathname.startsWith("/assets/") ||
    pathname.startsWith("/api/health") ||
    /\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt)$/i.test(pathname);

  if (isPublicAsset) return null;

  if (!isAuthenticated) {
    if (isMaseehaPath) return null;
    if (isSaving9Host && (pathname.startsWith("/team") || pathname.startsWith("/organization"))) {
      return null;
    }
    return isLoginPath ? null : "/login";
  }

  if (mustChangePassword) {
    return isSetPasswordPath ? null : "/set-password";
  }

  if (isSetPasswordPath || isLoginPath) {
    return "/";
  }

  return null;
}
