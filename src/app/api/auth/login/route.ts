import { NextResponse, type NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { audit, handle, HttpError, must, readJson } from "@/lib/server/api-guard";
import { SESSION_COOKIE, SESSION_HOURS, signSession } from "@/lib/server/session-token";
import { db } from "@/lib/server/supabase-admin";
import type { Role } from "@/lib/domain/labels";

// Compared against when the login id does not exist, so timing does not reveal valid ids.
const DUMMY_HASH = bcrypt.hashSync("not-a-real-password", 6);

export const POST = handle(async (req: NextRequest) => {
  const { loginId, password } = await readJson<{ loginId?: string; password?: string }>(req);
  if (!loginId || !password) throw new HttpError(400, "ログインIDとパスワードを入力してください");

  const rows = must(
    await db().from("app_users").select("id, login_id, display_name, role, password_hash, active")
      .eq("login_id", loginId.trim()).limit(1),
    "ユーザー検索",
  ) as { id: string; login_id: string; display_name: string; role: Role; password_hash: string; active: boolean }[];
  const user = rows[0];
  const ok = await bcrypt.compare(password, user?.password_hash ?? DUMMY_HASH);
  if (!user || !user.active || !ok) {
    await audit(loginId.slice(0, 50), "login_failed", "auth");
    throw new HttpError(401, "ログインIDまたはパスワードが正しくありません");
  }

  const token = await signSession({ id: user.id, loginId: user.login_id, name: user.display_name, role: user.role });
  await audit(user.login_id, "login", "auth");
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_HOURS * 3600,
  });
  return res;
});
