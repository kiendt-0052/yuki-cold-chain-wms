import { NextResponse, type NextRequest } from "next/server";
import { audit, handle, HttpError, must, readJson, requireUser } from "@/lib/server/api-guard";
import { db } from "@/lib/server/supabase-admin";

type Deviation = { id: number; status: string; affected_lots: string[] };
type CloseBody = {
  investigation?: string; corrective_action?: string; decision?: "release" | "scrap"; rationale?: string; attachment_ref?: string;
};

export const GET = handle(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  await requireUser(req);
  const { id } = await params;
  const client = db();
  const deviation = must(await client.from("deviations").select("*").eq("id", id).maybeSingle(), "逸脱取得") as Deviation | null;
  if (!deviation) throw new HttpError(404, "逸脱ケースが見つかりません");
  const [alarm, lots] = await Promise.all([
    client.from("alarms").select("*").eq("deviation_id", id).maybeSingle(),
    client.from("lots").select("lot_id, sku_id, status, qty_available, expiry_date, location_id, skus(name_ja)")
      .in("lot_id", deviation.affected_lots.length ? deviation.affected_lots : ["-"]),
  ]);
  return NextResponse.json({ deviation, alarm: must(alarm, "アラーム取得"), lots: must(lots, "ロット取得") });
});

// FR-TEMP-04: a case cannot be closed without rationale and the required attachment. QA decides; the system never auto-releases.
export const POST = handle(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireUser(req, "deviation:decide");
  const { id } = await params;
  const body = await readJson<CloseBody>(req);
  const missing = [
    !body.investigation?.trim() && "調査内容",
    !body.corrective_action?.trim() && "是正措置",
    !body.decision && "判定（解除／廃棄）",
    !body.rationale?.trim() && "判定根拠",
    !body.attachment_ref?.trim() && "添付（再測定記録など）",
  ].filter(Boolean);
  if (missing.length) throw new HttpError(422, `次の項目が未入力のためケースを閉じられません：${missing.join("、")}`);

  const client = db();
  const deviation = must(await client.from("deviations").select("*").eq("id", id).maybeSingle(), "逸脱取得") as Deviation | null;
  if (!deviation) throw new HttpError(404, "逸脱ケースが見つかりません");
  if (deviation.status !== "open") throw new HttpError(409, "このケースは既に完了しています");

  const lots = deviation.affected_lots;
  if (lots.length) {
    const update = body.decision === "release" ? { status: "available" } : { status: "scrapped", qty_available: 0 };
    must(await client.from("lots").update(update).in("lot_id", lots).eq("status", "quarantine"), "ロット更新");
    must(await client.from("lot_events").insert(lots.map((lot_id) => ({
      lot_id, event_type: body.decision === "release" ? "released" : "scrapped", actor: user.loginId,
      detail: { deviation_id: Number(id), rationale: body.rationale },
    }))), "イベント登録");
  }
  must(await client.from("deviations").update({
    status: "closed", investigation: body.investigation, corrective_action: body.corrective_action,
    decision: body.decision, rationale: body.rationale, attachment_ref: body.attachment_ref,
    decided_by: user.loginId, closed_at: new Date().toISOString(),
  }).eq("id", id), "逸脱更新");
  must(await client.from("alarms").update({ status: "closed" }).eq("deviation_id", id), "アラーム更新");
  await audit(user.loginId, "deviation_closed", `deviation:${id}`, { decision: body.decision, lots });
  return NextResponse.json({ ok: true });
});
