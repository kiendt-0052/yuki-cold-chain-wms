import "server-only";
import { unstable_rethrow } from "next/navigation";
import { NextResponse, type NextRequest } from "next/server";
import { can, type Permission } from "@/lib/permissions";
import { SESSION_COOKIE, verifySession, type SessionUser } from "./session-token";
import { db } from "./supabase-admin";

export class HttpError extends Error {
  constructor(public status: number, message: string, public details?: unknown) {
    super(message);
  }
}

/** Re-verify the session inside every route handler (proxy.ts is the first gate, not the only one). */
export async function requireUser(req: NextRequest, permission?: Permission): Promise<SessionUser> {
  const user = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);
  if (!user) throw new HttpError(401, "ログインが必要です");
  if (permission && !can(user.role, permission)) {
    throw new HttpError(403, "この操作を行う権限がありません");
  }
  return user;
}

/** Wrap a handler: consistent JSON errors, no stack traces leaked to the browser. */
export function handle<T extends unknown[]>(fn: (req: NextRequest, ...rest: T) => Promise<Response>) {
  return async (req: NextRequest, ...rest: T): Promise<Response> => {
    try {
      return await fn(req, ...rest);
    } catch (err) {
      // Let Next.js internal control-flow errors (e.g. dynamic-rendering bailout) through untouched.
      unstable_rethrow(err);
      if (err instanceof HttpError) {
        return NextResponse.json({ error: err.message, details: err.details }, { status: err.status });
      }
      console.error("[api]", req.method, req.nextUrl.pathname, err);
      const message = err instanceof Error ? err.message : "不明なエラー";
      return NextResponse.json({ error: `サーバーエラー: ${message}` }, { status: 500 });
    }
  };
}

/** Unwrap a Supabase result or throw a readable error. */
export function must<T>(res: { data: T | null; error: { message: string } | null }, what: string): T {
  if (res.error) throw new HttpError(500, `${what}に失敗しました: ${res.error.message}`);
  return res.data as T;
}

export async function audit(actor: string, action: string, target: string, detail: Record<string, unknown> = {}) {
  await db().from("audit_logs").insert({ actor, action, target, detail });
}

export async function readJson<T>(req: NextRequest): Promise<T> {
  try {
    return (await req.json()) as T;
  } catch {
    throw new HttpError(400, "リクエスト本文が不正です");
  }
}
