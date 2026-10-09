// First gate: nobody reaches a page or API without a valid session cookie.
// Route handlers re-verify the session and role themselves (defense in depth).
import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/lib/server/session-token";

const PUBLIC_PATHS = ["/login", "/api/auth/login"];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (PUBLIC_PATHS.includes(pathname)) return NextResponse.next();

  const user = await verifySession(request.cookies.get(SESSION_COOKIE)?.value);
  if (user) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "ログインが必要です" }, { status: 401 });
  }
  const login = new URL("/login", request.url);
  if (pathname !== "/") login.searchParams.set("next", pathname);
  return NextResponse.redirect(login);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|samples/).*)"],
};
