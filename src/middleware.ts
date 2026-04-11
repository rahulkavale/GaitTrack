import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;

  // Public routes - no auth needed at all
  const isPublicRoute =
    path === "/" ||
    path.startsWith("/try") ||
    path.startsWith("/login") ||
    path.startsWith("/signup") ||
    path.startsWith("/auth");

  // These routes require a real (non-anonymous) account
  const isAuthenticatedRoute =
    path.startsWith("/dashboard") ||
    path.startsWith("/patient") ||
    path.startsWith("/review") ||
    path.startsWith("/join");

  // Redirect unauthenticated or anonymous users to login for protected routes
  if (isAuthenticatedRoute && (!user || user.is_anonymous)) {
    const url = request.nextUrl.clone();
    // Preserve the intended destination so we can redirect back after login
    url.pathname = "/login";
    url.searchParams.set("redirect", path);
    return NextResponse.redirect(url);
  }

  // Redirect signed-in (non-anon) users from auth pages to dashboard
  if (user && !user.is_anonymous && (path === "/login" || path === "/signup")) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  // Catch-all: unauthenticated users on non-public routes go to landing
  if (!isPublicRoute && !isAuthenticatedRoute && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|manifest.json|icon-.*\\.png|.*\\.svg).*)",
  ],
};
