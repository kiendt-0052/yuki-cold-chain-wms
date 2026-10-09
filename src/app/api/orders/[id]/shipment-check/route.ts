import { NextResponse, type NextRequest } from "next/server";
import { BAND_SHORT } from "@/lib/domain/labels";
import { inBand } from "@/lib/domain/temperature";
import { audit, handle, HttpError, must, readJson, requireUser } from "@/lib/server/api-guard";
import { loadOrderContext } from "@/lib/server/order-context";
import { db } from "@/lib/server/supabase-admin";

type Body = { vehicle_temp?: number; cargo_temp?: number; seal_no?: string };

// 出荷前チェック (FR-OUT-05): out-of-policy values create a deviation and block the dispatch.
export const POST = handle(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireUser(req, "order:ship");
  const { id } = await params;
  const body = await readJson<Body>(req);
  const vehicle = Number(body.vehicle_temp);
  const cargo = Number(body.cargo_temp);
  if (body.vehicle_temp === undefined || body.cargo_temp === undefined || Number.isNaN(vehicle) || Number.isNaN(cargo)) {
    throw new HttpError(422, "車両温度と貨物温度は必須です");
  }
  if (!body.seal_no?.trim()) throw new HttpError(422, "シール番号は必須です");

  const ctx = await loadOrderContext(id);
  if (ctx.order.status !== "allocated") throw new HttpError(409, "引当済みの受注のみ出荷前チェックできます");
  const band = ctx.sku.temperature_band;
  const problems = [
    !inBand(band, vehicle) && `車両温度 ${vehicle}℃`,
    !inBand(band, cargo) && `貨物温度 ${cargo}℃`,
  ].filter(Boolean) as string[];
  const result = problems.length ? "failed" : "passed";
  const reason = problems.length ? `${problems.join("・")} が${BAND_SHORT[band]}帯の基準外` : null;

  const client = db();
  must(await client.from("shipment_checks").insert({
    order_id: id, vehicle_temp: vehicle, cargo_temp: cargo, seal_no: body.seal_no.trim(),
    result, reason, checked_by: user.loginId,
  }), "出荷前チェック登録");

  if (result === "failed") {
    const deviation = must(await client.from("deviations").insert({
      source: "shipment", zone: null, description: `出荷前チェック不合格（${id}）：${reason}`,
      affected_lots: [ctx.order.allocated_lot_id],
    }).select("id").single(), "逸脱登録") as { id: number };
    await audit(user.loginId, "shipment_check_failed", id, { reason, deviation_id: deviation.id });
    return NextResponse.json({ ok: false, result, reason, deviation_id: deviation.id }, { status: 409 });
  }

  must(await client.from("orders").update({ status: "dispatched" }).eq("order_id", id), "受注更新");
  must(await client.from("lot_events").insert({
    lot_id: ctx.order.allocated_lot_id, event_type: "shipped", actor: user.loginId,
    detail: { order_id: id, vehicle_temp: vehicle, cargo_temp: cargo, seal_no: body.seal_no.trim() },
  }), "イベント登録");
  await audit(user.loginId, "shipment_check_passed", id, { seal_no: body.seal_no.trim() });
  return NextResponse.json({ ok: true, result });
});
