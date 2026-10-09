import { NextResponse, type NextRequest } from "next/server";
import { audit, handle } from "@/lib/server/api-guard";
import { SESSION_COOKIE, verifySession } from "@/lib/server/session-token";

export const POST = handle(async (req: NextRequest) => {
  const user = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);
  if (user) await audit(user.loginId, "logout", "auth");
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
  return res;
});
