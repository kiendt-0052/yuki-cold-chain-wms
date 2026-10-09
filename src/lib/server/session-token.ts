// Signed session cookie (HS256 JWT). Pure module: used by proxy.ts and route handlers alike.
import { jwtVerify, SignJWT } from "jose";
import type { Role } from "@/lib/domain/labels";

export const SESSION_COOKIE = "ycl_session";
export const SESSION_HOURS = 8;

export type SessionUser = { id: string; loginId: string; name: string; role: Role };

function secret(): Uint8Array {
  const value = process.env.SESSION_SECRET;
  if (!value || value.length < 32) throw new Error("SESSION_SECRET は32文字以上で設定してください");
  return new TextEncoder().encode(value);
}

export async function signSession(user: SessionUser): Promise<string> {
  return new SignJWT({ login: user.loginId, name: user.name, role: user.role })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_HOURS}h`)
    .sign(secret());
}

export async function verifySession(token: string | undefined): Promise<SessionUser | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret(), { algorithms: ["HS256"] });
    return {
      id: String(payload.sub),
      loginId: String(payload.login),
      name: String(payload.name),
      role: payload.role as Role,
    };
  } catch {
    return null;
  }
}
