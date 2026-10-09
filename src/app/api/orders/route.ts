import { NextResponse, type NextRequest } from "next/server";
import { handle, must, requireUser } from "@/lib/server/api-guard";
import { db } from "@/lib/server/supabase-admin";

export const GET = handle(async (req: NextRequest) => {
  await requireUser(req);
  const client = db();
  const [orders, agreements] = await Promise.all([
    client.from("orders").select("*, customers(name), skus(name_ja, temperature_band, expiry_type)")
      .order("status").order("order_id"),
    client.from("agreements").select("customer_id, sku_id, delivery_window_rule"),
  ]);
  const rules = new Map(
    (must(agreements, "契約取得") as { customer_id: string; sku_id: string; delivery_window_rule: string | null }[])
      .map((a) => [`${a.customer_id}|${a.sku_id}`, a.delivery_window_rule]),
  );
  const rows = (must(orders, "受注一覧取得") as { customer_id: string; sku_id: string }[]).map((o) => ({
    ...o,
    delivery_window_rule: rules.get(`${o.customer_id}|${o.sku_id}`) ?? null,
  }));
  return NextResponse.json({ orders: rows });
});
