export interface MiddlewareRedirectInput {
  pathname: string;
  isAuthenticated: boolean;
  mustChangePassword: boolean;
}

export function computeMiddlewareRedirect(input: MiddlewareRedirectInput): string | null {
  const { pathname, isAuthenticated, mustChangePassword } = input;
  const isLoginPath = pathname === "/login" || pathname.startsWith("/login/");
  const isSetPasswordPath = pathname === "/set-password" || pathname.startsWith("/set-password/");
  const isMaseehaPath = pathname === "/maseeha" || pathname.startsWith("/maseeha/");

  if (!isAuthenticated) {
    if (isMaseehaPath) return null;
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
