// 納品期限ウィンドウ (BR-DELWIN-01). 3分の1・2分の1ルールは契約に基づく商慣行であり法令ではない。
import { addDays, diffDays } from "./dates";
import type { WindowRule } from "./labels";

/**
 * Last date this lot may be delivered to a customer under the contract rule.
 * ONE_THIRD / ONE_HALF: production + floor(shelf life × ratio).
 * LABEL_DATE_ONLY: only the label date is compared (no ratio).
 * Returns null when the rule is not set (未設定) — callers must not guess a default.
 */
export function deliveryDeadline(
  rule: WindowRule | null,
  productionDate: string,
  expiryDate: string,
): string | null {
  if (!rule) return null;
  if (rule === "LABEL_DATE_ONLY") return expiryDate;
  const shelfLife = diffDays(expiryDate, productionDate);
  const ratio = rule === "ONE_THIRD" ? 1 / 3 : 1 / 2;
  return addDays(productionDate, Math.floor(shelfLife * ratio));
}
