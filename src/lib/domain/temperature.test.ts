import { describe, expect, it } from "vitest";
import { groupExcursions, inBand, parseLoggerCsv } from "./temperature";

describe("parseLoggerCsv", () => {
  it("rejects rows without time zone or numeric value, keeping their line numbers", () => {
    const csv = [
      "device_id,event_time,value_c",
      "DL-F01,2026-10-08T09:00:00+09:00,-20.1",
      "DL-F01,2026-10-08 09:15,-19.5",
      "DL-F01,2026-10-08T09:30:00+09:00,abc",
    ].join("\n");
    const r = parseLoggerCsv(csv);
    expect(r.readings).toHaveLength(1);
    expect(r.errors.map((e) => e.line)).toEqual([3, 4]);
  });
});

describe("temperature evaluation", () => {
  it("uses the company policy bands", () => {
    expect(inBand("chilled", 5)).toBe(true);
    expect(inBand("chilled", 5.1)).toBe(false);
    expect(inBand("frozen", -18)).toBe(true);
    expect(inBand("frozen", -17.9)).toBe(false);
  });

  it("groups consecutive excursions per device into one alarm with the worst value", () => {
    const t = (m: number) => `2026-10-08T00:${String(m).padStart(2, "0")}:00.000Z`;
    const ex = groupExcursions([
      { device_id: "DL-F01", event_time: t(0), value_c: -20, band: "frozen" },
      { device_id: "DL-F01", event_time: t(15), value_c: -14, band: "frozen" },
      { device_id: "DL-F01", event_time: t(30), value_c: -12.4, band: "frozen" },
      { device_id: "DL-F01", event_time: t(45), value_c: -19, band: "frozen" },
    ]);
    expect(ex).toHaveLength(1);
    expect(ex[0]).toMatchObject({ peak_c: -12.4, reading_count: 2 });
  });
});
