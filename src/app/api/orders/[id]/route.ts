import { NextResponse, type NextRequest } from "next/server";
import { handle, must, requireUser } from "@/lib/server/api-guard";
import { loadOrderContext } from "@/lib/server/order-context";
import { db } from "@/lib/server/supabase-admin";

export const GET = handle(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  await requireUser(req);
  const { id } = await params;
  const ctx = await loadOrderContext(id);
  const client = db();
  const [allocations, checks, delivery, lot] = await Promise.all([
    client.from("allocations").select("*").eq("order_id", id).order("created_at", { ascending: false }),
    client.from("shipment_checks").select("*").eq("order_id", id).order("checked_at", { ascending: false }),
    client.from("accepted_deliveries").select("*").eq("order_id", id).maybeSingle(),
    ctx.order.allocated_lot_id
      ? client.from("lots").select("*").eq("lot_id", ctx.order.allocated_lot_id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);
  return NextResponse.json({
    ...ctx,
    allocations: must(allocations, "引当履歴取得"),
    shipmentChecks: must(checks, "出荷前チェック取得"),
    delivery: must(delivery, "配送完了取得"),
    allocatedLot: must(lot, "ロット取得"),
  });
});
