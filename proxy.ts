import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { computeMiddlewareRedirect } from "./lib/middlewareRedirect";

export async function proxy(request: NextRequest) {
  const response = NextResponse.next({ request });

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
  });

  if (redirectTo) {
    return NextResponse.redirect(new URL(redirectTo, request.url));
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
