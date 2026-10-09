import "server-only";
import { evaluateLots, type EvaluationResult, type LotCandidate } from "@/lib/domain/allocation-rules";
import type { DeliveryTerm, ExpiryType, TemperatureBand, WindowRule } from "@/lib/domain/labels";
import { HttpError, must } from "./api-guard";
import { db } from "./supabase-admin";

export type OrderRow = {
  order_id: string; customer_id: string; sku_id: string; qty: number; requested_date: string;
  delivery_term: DeliveryTerm; status: string; allocated_lot_id: string | null; created_at: string;
};
export type SkuRow = {
  sku_id: string; name_ja: string; unit: string; temperature_band: TemperatureBand; expiry_type: ExpiryType;
  trace_lane: string; regulated_identifier: string | null;
};

export type OrderContext = {
  order: OrderRow;
  sku: SkuRow;
  customer: { customer_id: string; name: string };
  agreement: { agreement_id: string; delivery_window_rule: WindowRule | null; delivery_term: DeliveryTerm } | null;
  lastAccepted: { expiry_date: string; completed_at: string; lot_id: string | null } | null;
  evaluation: EvaluationResult | null;
};

export async function loadOrderContext(orderId: string): Promise<OrderContext> {
  const client = db();
  const order = must(await client.from("orders").select("*").eq("order_id", orderId).maybeSingle(), "受注取得") as OrderRow | null;
  if (!order) throw new HttpError(404, "受注が見つかりません");

  const [skuRes, customerRes, agreementRes, historyRes] = await Promise.all([
    client.from("skus").select("*").eq("sku_id", order.sku_id).single(),
    client.from("customers").select("*").eq("customer_id", order.customer_id).single(),
    client.from("agreements").select("agreement_id, delivery_window_rule, delivery_term")
      .eq("customer_id", order.customer_id).eq("sku_id", order.sku_id).maybeSingle(),
    // 日付逆転: compare only with THIS customer's accepted deliveries of THIS sku (never today, never others).
    client.from("accepted_deliveries").select("expiry_date, completed_at, lot_id")
      .eq("customer_id", order.customer_id).eq("sku_id", order.sku_id)
      .order("completed_at", { ascending: false }).limit(1),
  ]);
  const sku = must(skuRes, "SKU取得") as SkuRow;
  const lastAccepted = (must(historyRes, "配送履歴取得") as OrderContext["lastAccepted"][])[0] ?? null;
  const agreement = must(agreementRes, "契約取得") as OrderContext["agreement"];

  let evaluation: EvaluationResult | null = null;
  if (order.status === "created") {
    const lots = must(
      await client.from("lots")
        .select("lot_id, production_date, expiry_date, received_at, qty_available, status, locations(temperature_band)")
        .eq("sku_id", order.sku_id).neq("status", "scrapped").gt("qty_available", 0),
      "ロット取得",
    ) as unknown as (Omit<LotCandidate, "location_band" | "sku_band" | "expiry_type"> & { locations: { temperature_band: TemperatureBand } })[];
    evaluation = evaluateLots({
      order: { qty: Number(order.qty), requested_date: order.requested_date },
      rule: agreement?.delivery_window_rule ?? null,
      lastAcceptedExpiry: lastAccepted?.expiry_date ?? null,
      lots: lots.map(({ locations, ...l }) => ({
        ...l, qty_available: Number(l.qty_available),
        location_band: locations.temperature_band, sku_band: sku.temperature_band, expiry_type: sku.expiry_type,
      })),
    });
  }
  return {
    order, sku, agreement, lastAccepted, evaluation,
    customer: must(customerRes, "顧客取得") as OrderContext["customer"],
  };
}
