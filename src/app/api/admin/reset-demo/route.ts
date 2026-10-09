import { NextResponse, type NextRequest } from "next/server";
import { audit, handle, HttpError, requireUser } from "@/lib/server/api-guard";
import { db } from "@/lib/server/supabase-admin";

// Restore the mock dataset (dates re-anchored to today) so reviewers can replay the demo scenarios.
export const POST = handle(async (req: NextRequest) => {
  const user = await requireUser(req, "demo:reset");
  const { error } = await db().rpc("reset_demo_data");
  if (error) throw new HttpError(500, `デモデータの初期化に失敗しました: ${error.message}`);
  await audit(user.loginId, "demo_data_reset", "all");
  return NextResponse.json({ ok: true });
});
