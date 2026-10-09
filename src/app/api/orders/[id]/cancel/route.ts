import { NextResponse, type NextRequest } from "next/server";
import { audit, handle, HttpError, readJson, requireUser } from "@/lib/server/api-guard";
import { db } from "@/lib/server/supabase-admin";

export const POST = handle(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireUser(req, "order:allocate");
  const { id } = await params;
  const { reason } = await readJson<{ reason?: string }>(req);
  if (!reason?.trim()) throw new HttpError(400, "取消理由を入力してください");
  const { error } = await db().rpc("cancel_allocation", { p_order_id: id, p_actor: user.loginId, p_reason: reason });
  if (error) throw new HttpError(409, `引当取消に失敗しました: ${error.message}`);
  await audit(user.loginId, "cancel_allocation", id, { reason });
  return NextResponse.json({ ok: true });
});
