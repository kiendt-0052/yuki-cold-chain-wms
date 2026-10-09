import { NextResponse, type NextRequest } from "next/server";
import { handle, HttpError, must, requireUser } from "@/lib/server/api-guard";
import { db } from "@/lib/server/supabase-admin";

export const GET = handle(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  await requireUser(req);
  const { id } = await params;
  const client = db();
  const lot = must(
    await client.from("lots").select("*, skus(*), suppliers(name), locations(*)").eq("lot_id", id).maybeSingle(),
    "ロット取得",
  );
  if (!lot) throw new HttpError(404, "ロットが見つかりません");
  const [events, inspections, deliveries, allocations, deviations] = await Promise.all([
    client.from("lot_events").select("*").eq("lot_id", id).order("created_at"),
    client.from("inbound_inspections").select("*").eq("lot_id", id),
    client.from("accepted_deliveries").select("*, customers(name)").eq("lot_id", id).order("completed_at"),
    client.from("allocations").select("*, orders(customer_id, status)").eq("lot_id", id).order("created_at"),
    client.from("deviations").select("*").contains("affected_lots", [id]).order("created_at"),
  ]);
  return NextResponse.json({
    lot,
    events: must(events, "イベント取得"),
    inspections: must(inspections, "検品記録取得"),
    deliveries: must(deliveries, "配送取得"),
    allocations: must(allocations, "引当取得"),
    deviations: must(deviations, "逸脱取得"),
  });
});
