import { NextResponse, type NextRequest } from "next/server";
import { handle, requireUser } from "@/lib/server/api-guard";
import { PERMISSIONS, can, type Permission } from "@/lib/permissions";

export const GET = handle(async (req: NextRequest) => {
  const user = await requireUser(req);
  const permissions = (Object.keys(PERMISSIONS) as Permission[]).filter((p) => can(user.role, p));
  return NextResponse.json({ user, permissions });
});
