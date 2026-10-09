import type { EvaluationResult } from "@/lib/domain/allocation-rules";
import type { DeliveryTerm, ExpiryType, TemperatureBand, WindowRule } from "@/lib/domain/labels";

export type OrderDetailData = {
  order: {
    order_id: string; customer_id: string; sku_id: string; qty: number; requested_date: string;
    delivery_term: DeliveryTerm; status: string; allocated_lot_id: string | null;
  };
  sku: { sku_id: string; name_ja: string; temperature_band: TemperatureBand; expiry_type: ExpiryType };
  customer: { customer_id: string; name: string };
  agreement: { agreement_id: string; delivery_window_rule: WindowRule | null } | null;
  lastAccepted: { expiry_date: string; completed_at: string; lot_id: string | null } | null;
  evaluation: EvaluationResult | null;
  allocations: { id: number; lot_id: string; warnings: string[]; override_reason: string | null; decided_by: string; created_at: string; cancelled_at: string | null }[];
  shipmentChecks: { id: number; vehicle_temp: number; cargo_temp: number; seal_no: string; result: string; reason: string | null; checked_at: string; checked_by: string }[];
  delivery: { recipient_name: string; completed_at: string; evidence: Record<string, unknown>; evidence_hash: string } | null;
  allocatedLot: { lot_id: string; expiry_date: string } | null;
};
