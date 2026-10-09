// 温度ロガーCSV取込と評価 (FR-TEMP-01/02). 閾値はユキ物流の社内ポリシー（全国標準ではない）。
import type { TemperatureBand } from "./labels";

export const BAND_RANGE: Record<TemperatureBand, { min: number; max: number }> = {
  ambient: { min: 15, max: 25 },
  chilled: { min: 0, max: 5 },
  frozen: { min: -60, max: -18 },
};

export const POLICY_VERSION = "YCL-TEMP-2026-04";

export function inBand(band: TemperatureBand, valueC: number): boolean {
  const r = BAND_RANGE[band];
  return valueC >= r.min && valueC <= r.max;
}

/** How far (℃) a value lies outside the band; ≤ 0 when inside. */
export function outOfBandBy(band: TemperatureBand, valueC: number): number {
  const r = BAND_RANGE[band];
  return Math.max(r.min - valueC, valueC - r.max);
}

export type ParsedReading = { line: number; device_id: string; event_time: string; value_c: number };
export type ParseError = { line: number; message: string };

const HEADER = ["device_id", "event_time", "value_c"];
// ISO 8601 with an explicit offset (Z or ±hh:mm) — a reading without a time zone is rejected.
const ISO_WITH_TZ = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;

export function parseLoggerCsv(text: string): { readings: ParsedReading[]; errors: ParseError[] } {
  const lines = text.replace(/^﻿/, "").split(/\r?\n/);
  const readings: ParsedReading[] = [];
  const errors: ParseError[] = [];
  const header = (lines[0] ?? "").split(",").map((h) => h.trim());
  if (HEADER.some((h, i) => header[i] !== h)) {
    return { readings, errors: [{ line: 1, message: `ヘッダーは ${HEADER.join(",")} である必要があります` }] };
  }
  lines.slice(1).forEach((raw, i) => {
    const line = i + 2;
    if (!raw.trim()) return;
    const [device_id, event_time, value] = raw.split(",").map((c) => c.trim());
    if (!device_id || !event_time || value === undefined || value === "") {
      errors.push({ line, message: "必須項目（device_id / event_time / value_c）が不足" });
    } else if (!ISO_WITH_TZ.test(event_time) || Number.isNaN(Date.parse(event_time))) {
      errors.push({ line, message: `日時 "${event_time}" はタイムゾーン付きISO 8601ではありません` });
    } else if (!/^-?\d+(\.\d+)?$/.test(value)) {
      errors.push({ line, message: `温度 "${value}" が数値ではありません` });
    } else {
      readings.push({ line, device_id, event_time: new Date(event_time).toISOString(), value_c: Number(value) });
    }
  });
  return { readings, errors };
}

export type Excursion = { device_id: string; first_at: string; last_at: string; peak_c: number; reading_count: number };

/** Group consecutive out-of-band readings per device into one excursion (→ one alarm). */
export function groupExcursions(
  readings: { device_id: string; event_time: string; value_c: number; band: TemperatureBand }[],
): Excursion[] {
  const result: Excursion[] = [];
  const byDevice = new Map<string, typeof readings>();
  for (const r of readings) byDevice.set(r.device_id, [...(byDevice.get(r.device_id) ?? []), r]);
  for (const [device, list] of byDevice) {
    list.sort((a, b) => Date.parse(a.event_time) - Date.parse(b.event_time));
    let current: Excursion | null = null;
    for (const r of list) {
      if (!inBand(r.band, r.value_c)) {
        if (!current) current = { device_id: device, first_at: r.event_time, last_at: r.event_time, peak_c: r.value_c, reading_count: 0 };
        current.last_at = r.event_time;
        current.reading_count += 1;
        if (outOfBandBy(r.band, r.value_c) > outOfBandBy(r.band, current.peak_c)) current.peak_c = r.value_c;
      } else if (current) {
        result.push(current);
        current = null;
      }
    }
    if (current) result.push(current);
  }
  return result;
}

export async function sha256Hex(text: string): Promise<string> {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(bytes), (b) => b.toString(16).padStart(2, "0")).join("");
}
