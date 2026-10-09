// 入荷検品の判定 (FR-REC-02/03/05, BR-TEMP-02, BR-TRACE-01/02).
// P0 fields must not be empty; an out-of-band temperature never blocks the record — it quarantines the lot.
import { toDayNumber, isIsoDate } from "./dates";
import { EXPIRY_TYPE_LABEL, type ExpiryType, type TemperatureBand, BAND_SHORT } from "./labels";
import { inBand } from "./temperature";

export type InboundInput = {
  request_id: string;
  supplier_id: string;
  sku_id: string;
  supplier_lot: string;
  qty_reported: number;
  qty_accepted: number;
  qty_rejected: number;
  variance_reason?: string;
  expiry_type: string;
  production_date: string;
  expiry_date: string;
  measured_temp: number | null;
  packaging_ok: boolean | null;
  photo_ref: string;
  location_id: string;
  rice_origin?: string;
  beef_individual_id?: string;
};

export type SkuInfo = { temperature_band: TemperatureBand; expiry_type: ExpiryType; trace_lane: string };

export type InboundJudgement = {
  errors: { field: string; message: string }[];
  result: "accepted" | "quarantined";
  reasons: string[];
};

export function judgeInbound(input: InboundInput, sku: SkuInfo, locationBand: TemperatureBand | null): InboundJudgement {
  const errors: InboundJudgement["errors"] = [];
  const reasons: string[] = [];
  const need = (field: keyof InboundInput, label: string) => {
    const v = input[field];
    if (v === undefined || v === null || (typeof v === "string" && !v.trim())) errors.push({ field, message: `${label}は必須です` });
  };
  need("supplier_lot", "仕入先ロット");
  need("expiry_type", "期限種別");
  need("photo_ref", "写真");
  need("location_id", "格納ロケーション");
  if (input.measured_temp === null || Number.isNaN(input.measured_temp)) errors.push({ field: "measured_temp", message: "実測温度は必須です" });
  if (input.packaging_ok === null) errors.push({ field: "packaging_ok", message: "梱包状態は必須です" });
  if (!(input.qty_reported > 0)) errors.push({ field: "qty_reported", message: "伝票数量は1以上で入力してください" });
  if (!isIsoDate(input.production_date)) errors.push({ field: "production_date", message: "製造日は必須です" });
  if (!isIsoDate(input.expiry_date)) errors.push({ field: "expiry_date", message: "期限日は必須です" });

  if (input.expiry_type && input.expiry_type !== sku.expiry_type) {
    errors.push({ field: "expiry_type", message: `期限種別がSKUマスタ（${EXPIRY_TYPE_LABEL[sku.expiry_type]}）と一致しません。賞味期限と消費期限を取り違えていないか確認してください` });
  }
  if (isIsoDate(input.production_date) && isIsoDate(input.expiry_date) &&
      toDayNumber(input.expiry_date) <= toDayNumber(input.production_date)) {
    errors.push({ field: "expiry_date", message: "期限日は製造日より後である必要があります" });
  }
  if (sku.trace_lane === "beef" && !/^\d{10}$/.test(input.beef_individual_id ?? "")) {
    errors.push({ field: "beef_individual_id", message: "牛個体識別番号は10桁の数字が必要です（桁不足を0で補完しません）" });
  }
  if (sku.trace_lane === "rice" && !input.rice_origin?.trim()) {
    errors.push({ field: "rice_origin", message: "米の産地情報は必須です" });
  }
  if (locationBand && locationBand !== sku.temperature_band) {
    errors.push({ field: "location_id", message: `ロケーションの温度帯（${BAND_SHORT[locationBand]}）がSKU（${BAND_SHORT[sku.temperature_band]}）と一致しません` });
  }
  if (input.qty_accepted < 0 || input.qty_rejected < 0) errors.push({ field: "qty_accepted", message: "数量が不正です" });
  if (input.qty_accepted + input.qty_rejected !== input.qty_reported && !input.variance_reason?.trim()) {
    errors.push({ field: "variance_reason", message: "受入数＋拒否数が伝票数量と一致しないため差異理由が必要です" });
  }
  if (!(input.qty_accepted > 0)) errors.push({ field: "qty_accepted", message: "受入数量が0の場合は入荷確定できません（全数拒否）" });

  if (input.measured_temp !== null && !Number.isNaN(input.measured_temp) && !inBand(sku.temperature_band, input.measured_temp)) {
    reasons.push(`実測温度 ${input.measured_temp}℃ が${BAND_SHORT[sku.temperature_band]}帯の基準外`);
  }
  if (input.packaging_ok === false) reasons.push("梱包異常");

  return { errors, result: reasons.length ? "quarantined" : "accepted", reasons };
}
