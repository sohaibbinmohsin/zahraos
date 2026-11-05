import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { computeMiddlewareRedirect } from "./lib/middlewareRedirect";

export async function proxy(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

  const hostname = request.headers.get("host") || "";
  const isSaving9Host =
    hostname.startsWith("saving9.") ||
    hostname.includes("saving9") ||
    request.nextUrl.searchParams.get("tenant") === "saving9";

  const response = NextResponse.next({ request });
  if (isSaving9Host) {
    response.cookies.set("saving9_demo", "1", { path: "/" });
  } else if (request.cookies.has("saving9_demo")) {
    response.cookies.delete("saving9_demo");
  }

  function redirectWithCookies(dest: string | URL) {
    const redirectResponse = NextResponse.redirect(new URL(dest, request.url));
    response.cookies.getAll().forEach((cookie) => {
      redirectResponse.cookies.set(cookie.name, cookie.value, cookie);
    });
    return redirectResponse;
  }

  if (isSaving9Host && request.nextUrl.pathname === "/") {
    return redirectWithCookies("/maseeha/dashboard");
  }

  const hasAuthCookie = request.cookies.getAll().some(
    (c) => c.name.startsWith("sb-") && c.name.includes("-auth-token"),
  );

  if (!hasAuthCookie) {
    const redirectTo = computeMiddlewareRedirect({
      pathname: request.nextUrl.pathname,
      isAuthenticated: false,
      mustChangePassword: false,
      isSaving9Host,
    });
    if (redirectTo) {
      return redirectWithCookies(redirectTo);
    }
    return response;
  }

  const isPrefetch =
    request.headers.get("next-router-prefetch") === "1" ||
    request.headers.get("purpose") === "prefetch";

  const verifiedUserId = request.cookies.get("zos_pwd_verified")?.value;

  if (isPrefetch && verifiedUserId && !["/login", "/set-password"].includes(request.nextUrl.pathname)) {
    return response;
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    },
  );

  const { data: { user } } = await supabase.auth.getUser();

  let mustChangePassword = false;
  let isActiveStaff = false;

  if (user) {
    if (verifiedUserId === user.id) {
      isActiveStaff = true;
      mustChangePassword = false;
    } else {
      const { data: staffRow } = await supabase
        .from("staff")
        .select("must_change_password, status")
        .eq("auth_user_id", user.id)
        .maybeSingle();

      if (staffRow && staffRow.status !== "deactivated") {
        isActiveStaff = true;
        mustChangePassword = staffRow.must_change_password ?? false;
        if (!mustChangePassword) {
          response.cookies.set("zos_pwd_verified", user.id, {
            path: "/",
            httpOnly: true,
            sameSite: "lax",
            maxAge: 60 * 60 * 24 * 7,
          });
        }
      }
    }
  } else if (verifiedUserId) {
    response.cookies.delete("zos_pwd_verified");
  }

  const redirectTo = computeMiddlewareRedirect({
    pathname: request.nextUrl.pathname,
    isAuthenticated: Boolean(user && isActiveStaff),
    mustChangePassword,
    isSaving9Host,
  });

  if (redirectTo) {
    if (user && !isActiveStaff) {
      for (const c of request.cookies.getAll()) {
        if (c.name.startsWith("sb-") || c.name.includes("auth-token")) {
          response.cookies.delete(c.name);
        }
      }
    }
    return redirectWithCookies(redirectTo);
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|assets|favicon\\.ico|favicon\\.png|apple-icon\\.png|icon\\.svg|icon\\.png|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|json|woff2?)$).*)",
  ],
};
