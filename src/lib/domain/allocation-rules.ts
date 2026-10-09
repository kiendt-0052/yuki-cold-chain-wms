// 引当ルール (FR-OUT-02). D3 defines the rules; this module runs them in the RFP's order:
// 消費期限 → 温度帯 → 隔離 → 納品期限ウィンドウ → 日付逆転 → 数量, then FEFO (same expiry → earlier receipt).
import { toDayNumber } from "./dates";
import { deliveryDeadline } from "./delivery-window";
import type { ExpiryType, TemperatureBand, WindowRule } from "./labels";
import { BAND_SHORT } from "./labels";

export type LotCandidate = {
  lot_id: string;
  production_date: string;
  expiry_date: string;
  received_at: string;
  qty_available: number;
  status: string;
  location_band: TemperatureBand;
  sku_band: TemperatureBand;
  expiry_type: ExpiryType;
};

export type CheckCode =
  | "USE_BY_REACHED" | "BEST_BEFORE_PASSED" | "TEMPERATURE_BAND" | "QUARANTINE"
  | "DELIVERY_WINDOW" | "WINDOW_UNSET" | "DATE_REVERSAL" | "QUANTITY";

export type CheckResult = { code: CheckCode; ok: boolean; severity: "block" | "warn" | "review"; message: string };

export type LotEvaluation = LotCandidate & {
  verdict: "eligible" | "excluded" | "review";
  failedCode: CheckCode | null;
  deadline: string | null;
  checks: CheckResult[];
};

export type EvaluationInput = {
  order: { qty: number; requested_date: string };
  rule: WindowRule | null;
  lastAcceptedExpiry: string | null;
  lots: LotCandidate[];
};

export type EvaluationResult = {
  lots: LotEvaluation[];
  recommendedLotId: string | null;
  ruleUnset: boolean;
};

function checkLot(lot: LotCandidate, input: EvaluationInput): { checks: CheckResult[]; deadline: string | null } {
  const { order, rule, lastAcceptedExpiry } = input;
  const delivery = toDayNumber(order.requested_date);
  const expiry = toDayNumber(lot.expiry_date);
  const deadline = deliveryDeadline(rule, lot.production_date, lot.expiry_date);
  const checks: CheckResult[] = [];

  if (lot.expiry_type === "use_by") {
    checks.push({ code: "USE_BY_REACHED", severity: "block", ok: expiry > delivery,
      message: `消費期限 ${lot.expiry_date}：納品日 ${order.requested_date} 時点で${expiry > delivery ? "期限内" : "到来/超過のため出荷不可"}` });
  } else {
    checks.push({ code: "BEST_BEFORE_PASSED", severity: "warn", ok: expiry > delivery,
      message: `賞味期限 ${lot.expiry_date}：${expiry > delivery ? "期限内" : "納品日時点で超過（警告）"}` });
  }
  checks.push({ code: "TEMPERATURE_BAND", severity: "block", ok: lot.location_band === lot.sku_band,
    message: `保管温度帯 ${BAND_SHORT[lot.location_band]} / SKU温度帯 ${BAND_SHORT[lot.sku_band]}` });
  checks.push({ code: "QUARANTINE", severity: "block", ok: lot.status === "available",
    message: lot.status === "available" ? "隔離なし" : `ステータス：${lot.status === "quarantine" ? "隔離中" : "廃棄"}` });
  if (rule) {
    const ok = deadline !== null && delivery <= toDayNumber(deadline);
    checks.push({ code: "DELIVERY_WINDOW", severity: "block", ok,
      message: `納品期限 ${deadline}（契約ルール）に対し納品日 ${order.requested_date}` });
  } else {
    checks.push({ code: "WINDOW_UNSET", severity: "review", ok: false,
      message: "顧客-SKU契約の配送ウィンドウルールが未設定のため要確認（推定しない）" });
  }
  if (lastAcceptedExpiry) {
    const ok = expiry >= toDayNumber(lastAcceptedExpiry);
    checks.push({ code: "DATE_REVERSAL", severity: "block", ok,
      message: `同一顧客-SKUの直近受入済み期限 ${lastAcceptedExpiry} に対し本ロット ${lot.expiry_date}${ok ? "" : "（日付逆転）"}` });
  } else {
    checks.push({ code: "DATE_REVERSAL", severity: "block", ok: true,
      message: "同一顧客-SKUの受入済み配送履歴なし（他顧客の履歴は参照しない）" });
  }
  checks.push({ code: "QUANTITY", severity: "block", ok: lot.qty_available >= order.qty,
    message: `引当可能数 ${lot.qty_available} / 受注数 ${order.qty}` });
  return { checks, deadline };
}

export function evaluateLots(input: EvaluationInput): EvaluationResult {
  const evaluated: LotEvaluation[] = input.lots.map((lot) => {
    const { checks, deadline } = checkLot(lot, input);
    const failed = checks.find((c) => !c.ok && c.severity === "block");
    const needsReview = checks.some((c) => !c.ok && c.severity === "review");
    return {
      ...lot, checks, deadline,
      failedCode: failed?.code ?? (needsReview ? "WINDOW_UNSET" : null),
      verdict: failed ? "excluded" : needsReview ? "review" : "eligible",
    };
  });

  evaluated.sort((a, b) =>
    toDayNumber(a.expiry_date) - toDayNumber(b.expiry_date) ||
    Date.parse(a.received_at) - Date.parse(b.received_at));

  const recommended = evaluated.find((l) => l.verdict === "eligible");
  return { lots: evaluated, recommendedLotId: recommended?.lot_id ?? null, ruleUnset: !input.rule };
}

export const CHECK_LABEL: Record<CheckCode, string> = {
  USE_BY_REACHED: "消費期限",
  BEST_BEFORE_PASSED: "賞味期限",
  TEMPERATURE_BAND: "温度帯",
  QUARANTINE: "隔離",
  DELIVERY_WINDOW: "納品期限",
  WINDOW_UNSET: "ルール未設定",
  DATE_REVERSAL: "日付逆転",
  QUANTITY: "数量",
};
