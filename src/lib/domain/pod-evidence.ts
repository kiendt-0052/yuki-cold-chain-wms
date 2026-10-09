// 配送完了証跡 (BR-POD-01): 車上渡し / 軒先渡し で必須エビデンスが異なる。
// 項目セットは前提条件（Q07未回答）に基づく仮定 — README の mock 一覧を参照。
import type { DeliveryTerm, TemperatureBand } from "./labels";
import { inBand } from "./temperature";

export type PodInput = {
  recipient_name?: string;
  signature_obtained?: boolean;
  handoff_temp?: number | null;
  seal_intact?: boolean;
  photo_ref?: string;
  unload_location?: string;
  exception_code?: string;
};

export const POD_FIELDS: Record<DeliveryTerm, { key: keyof PodInput; label: string }[]> = {
  on_truck: [
    { key: "recipient_name", label: "受取人" },
    { key: "signature_obtained", label: "受領サイン取得" },
    { key: "handoff_temp", label: "引渡し時の貨物温度" },
    { key: "seal_intact", label: "シール未開封の確認" },
  ],
  at_door: [
    { key: "recipient_name", label: "受取人" },
    { key: "signature_obtained", label: "受領サイン取得" },
    { key: "photo_ref", label: "荷下ろし写真" },
    { key: "unload_location", label: "荷下ろし場所" },
  ],
};

export function validatePod(term: DeliveryTerm, band: TemperatureBand, pod: PodInput): string[] {
  const missing = POD_FIELDS[term]
    .filter(({ key }) => {
      const v = pod[key];
      return v === undefined || v === null || v === false || (typeof v === "string" && !v.trim());
    })
    .map(({ label }) => `${label}が未入力です`);
  if (term === "on_truck" && typeof pod.handoff_temp === "number" && !inBand(band, pod.handoff_temp)) {
    missing.push(`引渡し時温度 ${pod.handoff_temp}℃ が基準外です。配送完了にせず品質管理へ連絡してください`);
  }
  return missing;
}
