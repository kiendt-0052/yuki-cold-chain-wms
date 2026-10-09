import { NextResponse, type NextRequest } from "next/server";
import { validatePod, type PodInput } from "@/lib/domain/pod-evidence";
import { sha256Hex } from "@/lib/domain/temperature";
import { audit, handle, HttpError, must, readJson, requireUser } from "@/lib/server/api-guard";
import { loadOrderContext } from "@/lib/server/order-context";
import { db } from "@/lib/server/supabase-admin";

// 配送完了 (FR-OUT-06, BR-POD-01): completion is refused while the term's required evidence is missing.
// The accepted delivery becomes the history row that later 日付逆転 checks compare against.
export const POST = handle(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireUser(req, "order:deliver");
  const { id } = await params;
  const pod = await readJson<PodInput>(req);

  const ctx = await loadOrderContext(id);
  if (ctx.order.status !== "dispatched") throw new HttpError(409, "出荷済みの受注のみ配送完了にできます");
  const missing = validatePod(ctx.order.delivery_term, ctx.sku.temperature_band, pod);
  if (missing.length) throw new HttpError(422, "配送完了に必要な証跡が不足しています", { missing });

  const client = db();
  const lot = must(await client.from("lots").select("expiry_date").eq("lot_id", ctx.order.allocated_lot_id).single(),
    "ロット取得") as { expiry_date: string };
  const evidence = { ...pod, term: ctx.order.delivery_term, captured_at: new Date().toISOString() };
  must(await client.from("accepted_deliveries").insert({
    order_id: id, customer_id: ctx.order.customer_id, sku_id: ctx.order.sku_id, lot_id: ctx.order.allocated_lot_id,
    expiry_date: lot.expiry_date, qty: ctx.order.qty, delivery_term: ctx.order.delivery_term,
    recipient_name: pod.recipient_name, evidence, evidence_hash: await sha256Hex(JSON.stringify(evidence)),
    completed_by: user.loginId,
  }), "配送完了登録");
  must(await client.from("orders").update({ status: "delivered" }).eq("order_id", id), "受注更新");
  must(await client.from("lot_events").insert({
    lot_id: ctx.order.allocated_lot_id, event_type: "delivered", actor: user.loginId,
    detail: { order_id: id, customer_id: ctx.order.customer_id, term: ctx.order.delivery_term },
  }), "イベント登録");
  await audit(user.loginId, "delivered", id, { term: ctx.order.delivery_term });
  return NextResponse.json({ ok: true });
});
