import { NextResponse, type NextRequest } from "next/server";
import { audit, handle, HttpError, must, readJson, requireUser } from "@/lib/server/api-guard";
import { db } from "@/lib/server/supabase-admin";

// 品質ステータス遷移 (FR-INV-05): available → quarantine → available(解除) / scrapped(廃棄).
// Skipping quarantine (available → scrapped) is rejected by the system, not just by procedure.
const ALLOWED: Record<string, string[]> = {
  available: ["quarantine"],
  quarantine: ["available", "scrapped"],
  scrapped: [],
};
const EVENT: Record<string, string> = { quarantine: "quarantined", available: "released", scrapped: "scrapped" };

export const POST = handle(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireUser(req, "lot:quality");
  const { id } = await params;
  const { to, reason } = await readJson<{ to?: string; reason?: string }>(req);
  if (!to || !reason?.trim()) throw new HttpError(422, "遷移先と理由（根拠）は必須です");

  const client = db();
  const lot = must(await client.from("lots").select("status").eq("lot_id", id).maybeSingle(), "ロット取得") as
    { status: string } | null;
  if (!lot) throw new HttpError(404, "ロットが見つかりません");
  if (!ALLOWED[lot.status]?.includes(to)) {
    throw new HttpError(409, `ステータス「${lot.status}」から「${to}」への遷移は許可されていません（隔離を経ずに廃棄はできません）`);
  }

  const update: Record<string, unknown> = { status: to };
  if (to === "scrapped") update.qty_available = 0;
  // Optimistic guard: only update if nobody changed the status in between.
  const updated = must(await client.from("lots").update(update).eq("lot_id", id).eq("status", lot.status).select("lot_id"),
    "ステータス更新") as unknown[];
  if (!updated.length) throw new HttpError(409, "他の操作と競合しました。再読み込みしてください");

  must(await client.from("lot_events").insert({
    lot_id: id, event_type: EVENT[to], actor: user.loginId, detail: { from: lot.status, to, reason },
  }), "イベント登録");
  await audit(user.loginId, "lot_status", id, { from: lot.status, to, reason });
  return NextResponse.json({ ok: true });
});
