import { NextResponse, type NextRequest } from "next/server";
import { handle, HttpError, must, requireUser } from "@/lib/server/api-guard";
import { db } from "@/lib/server/supabase-admin";

// トレース検索 (FR-TRC-01): lot / SKU / supplier lot / rice origin / beef individual ID → supplier → lot → customers.
export const GET = handle(async (req: NextRequest) => {
  await requireUser(req);
  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) throw new HttpError(422, "2文字以上で検索してください");
  const notices: string[] = [];
  if (/^\d+$/.test(q) && q.length !== 10) {
    notices.push(`"${q}" は ${q.length} 桁です。牛個体識別番号は10桁です（0で補完して検索しません）`);
  }
  const started = Date.now();
  const safe = q.replace(/[%,()]/g, "");
  const client = db();
  const lots = must(await client.from("lots")
    .select("*, skus(name_ja, trace_lane, regulated_identifier, expiry_type), suppliers(name)")
    .or(`lot_id.ilike.%${safe}%,supplier_lot.ilike.%${safe}%,sku_id.eq.${safe},rice_origin.ilike.%${safe}%,beef_individual_id.eq.${safe}`)
    .order("received_at").limit(50), "ロット検索") as { lot_id: string; sku_id: string }[];

  const lotIds = lots.map((l) => l.lot_id);
  const skuIds = [...new Set(lots.map((l) => l.sku_id))];
  const [deliveries, events, unlinked] = await Promise.all([
    client.from("accepted_deliveries").select("*, customers(name)").in("lot_id", lotIds.length ? lotIds : ["-"]),
    client.from("lot_events").select("*").in("lot_id", lotIds.length ? lotIds : ["-"]).order("created_at"),
    // Pre-go-live (migrated) deliveries have no lot link: show them as the point where the data chain ends.
    client.from("accepted_deliveries").select("*, customers(name)").is("lot_id", null).in("sku_id", skuIds.length ? skuIds : ["-"]),
  ]);
  return NextResponse.json({
    query: q,
    notices,
    lots,
    deliveries: must(deliveries, "配送検索"),
    events: must(events, "イベント検索"),
    unlinkedDeliveries: must(unlinked, "移行データ検索"),
    elapsedMs: Date.now() - started,
  });
});
