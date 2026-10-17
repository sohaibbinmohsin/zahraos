import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { computeMiddlewareRedirect } from "./lib/middlewareRedirect";

export async function proxy(request: NextRequest) {
  const hostname = request.headers.get("host") || "";
  const isSaving9Host =
    hostname.startsWith("saving9.") ||
    hostname.includes("saving9") ||
    request.nextUrl.searchParams.get("tenant") === "saving9";

  if (isSaving9Host && request.nextUrl.pathname === "/") {
    return NextResponse.redirect(new URL("/maseeha/dashboard", request.url));
  }

  const response = NextResponse.next({ request });
  if (isSaving9Host) {
    response.cookies.set("saving9_demo", "1", { path: "/" });
  } else if (request.cookies.has("saving9_demo")) {
    response.cookies.delete("saving9_demo");
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
  if (user) {
    const { data: staffRow } = await supabase
      .from("staff")
      .select("must_change_password")
      .eq("auth_user_id", user.id)
      .single();
    mustChangePassword = staffRow?.must_change_password ?? false;
  }

  const redirectTo = computeMiddlewareRedirect({
    pathname: request.nextUrl.pathname,
    isAuthenticated: Boolean(user),
    mustChangePassword,
    isSaving9Host,
  });

  if (redirectTo) {
    return NextResponse.redirect(new URL(redirectTo, request.url));
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|assets|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|json)$).*)",
  ],
};
