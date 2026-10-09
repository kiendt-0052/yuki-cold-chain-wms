// Japanese display labels for enum values stored in the database.

export type TemperatureBand = "ambient" | "chilled" | "frozen";
export type ExpiryType = "best_before" | "use_by";
export type DeliveryTerm = "on_truck" | "at_door";
export type WindowRule = "ONE_THIRD" | "ONE_HALF" | "LABEL_DATE_ONLY";
export type Role = "admin" | "receiving" | "dispatcher" | "qa" | "auditor";

export const BAND_LABEL: Record<TemperatureBand, string> = {
  ambient: "常温 (15〜25℃)",
  chilled: "冷蔵 (0〜5℃)",
  frozen: "冷凍 (-18℃以下)",
};

export const BAND_SHORT: Record<TemperatureBand, string> = {
  ambient: "常温",
  chilled: "冷蔵",
  frozen: "冷凍",
};

export const EXPIRY_TYPE_LABEL: Record<ExpiryType, string> = {
  best_before: "賞味期限",
  use_by: "消費期限",
};

export const TERM_LABEL: Record<DeliveryTerm, string> = {
  on_truck: "車上渡し",
  at_door: "軒先渡し",
};

export const WINDOW_RULE_LABEL: Record<WindowRule, string> = {
  ONE_THIRD: "3分の1ルール",
  ONE_HALF: "2分の1ルール",
  LABEL_DATE_ONLY: "期限ラベルのみ",
};

export const ROLE_LABEL: Record<Role, string> = {
  admin: "システム管理者",
  receiving: "入荷担当",
  dispatcher: "配送計画者",
  qa: "品質管理",
  auditor: "監査者（参照のみ）",
};

export const LOT_STATUS_LABEL: Record<string, string> = {
  available: "利用可能",
  quarantine: "隔離中",
  scrapped: "廃棄",
};

export const ORDER_STATUS_LABEL: Record<string, string> = {
  created: "引当待ち",
  allocated: "引当済",
  dispatched: "出荷済",
  delivered: "配送完了",
};

export const TRACE_LANE_LABEL: Record<string, string> = {
  rice: "米トレーサビリティ（法定）",
  beef: "牛トレーサビリティ（法定）",
  internal: "社内ロット",
};

export function windowRuleLabel(rule: string | null | undefined): string {
  return rule ? WINDOW_RULE_LABEL[rule as WindowRule] ?? rule : "未設定";
}
