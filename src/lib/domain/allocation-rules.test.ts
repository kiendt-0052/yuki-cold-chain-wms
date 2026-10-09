import { describe, expect, it } from "vitest";
import { evaluateLots, type LotCandidate } from "./allocation-rules";

const base: Omit<LotCandidate, "lot_id" | "expiry_date" | "production_date"> = {
  received_at: "2026-10-01T09:00:00+09:00",
  qty_available: 50,
  status: "available",
  location_band: "chilled",
  sku_band: "chilled",
  expiry_type: "best_before",
};
const lot = (id: string, production: string, expiry: string, extra: Partial<LotCandidate> = {}): LotCandidate => ({
  ...base, lot_id: id, production_date: production, expiry_date: expiry, ...extra,
});
const order = { qty: 20, requested_date: "2026-10-10" };

describe("evaluateLots — exclusion chain then FEFO", () => {
  it("blocks a lot older than the last accepted delivery of the same customer-SKU (日付逆転), not vs today", () => {
    const r = evaluateLots({
      order, rule: "ONE_HALF", lastAcceptedExpiry: "2026-11-22",
      lots: [lot("L-REV", "2026-09-28", "2026-11-20"), lot("L-OK", "2026-10-03", "2026-11-29")],
    });
    expect(r.lots.find((l) => l.lot_id === "L-REV")?.verdict).toBe("excluded");
    expect(r.lots.find((l) => l.lot_id === "L-REV")?.failedCode).toBe("DATE_REVERSAL");
    expect(r.recommendedLotId).toBe("L-OK");
  });

  it("hard-stops 消費期限 reached by the delivery date but only warns on 賞味期限", () => {
    const r = evaluateLots({
      order, rule: "LABEL_DATE_ONLY", lastAcceptedExpiry: null,
      lots: [
        lot("USE-BY", "2026-10-05", "2026-10-10", { expiry_type: "use_by" }),
        lot("BEST-BEFORE", "2026-10-05", "2026-10-30"),
      ],
    });
    expect(r.lots.find((l) => l.lot_id === "USE-BY")?.failedCode).toBe("USE_BY_REACHED");
    expect(r.lots.find((l) => l.lot_id === "BEST-BEFORE")?.verdict).toBe("eligible");
  });

  it("applies the 3分の1 contract rule from production date", () => {
    // shelf life 360 days → deadline production + 120
    const r = evaluateLots({
      order, rule: "ONE_THIRD", lastAcceptedExpiry: null,
      lots: [lot("LATE", "2026-06-01", "2027-05-27"), lot("FRESH", "2026-09-10", "2027-09-05")],
    });
    expect(r.lots.find((l) => l.lot_id === "LATE")?.failedCode).toBe("DELIVERY_WINDOW");
    expect(r.recommendedLotId).toBe("FRESH");
  });

  it("never guesses a rule when the agreement has none (未設定 → review)", () => {
    const r = evaluateLots({
      order, rule: null, lastAcceptedExpiry: null, lots: [lot("ANY", "2026-10-05", "2026-10-20")],
    });
    expect(r.lots[0].verdict).toBe("review");
    expect(r.recommendedLotId).toBeNull();
    expect(r.ruleUnset).toBe(true);
  });

  it("excludes quarantined and wrong-temperature-band lots, and orders the rest by FEFO then receipt", () => {
    const r = evaluateLots({
      order, rule: "LABEL_DATE_ONLY", lastAcceptedExpiry: null,
      lots: [
        lot("Q", "2026-10-01", "2026-10-20", { status: "quarantine" }),
        lot("BAND", "2026-10-01", "2026-10-21", { location_band: "frozen" }),
        lot("LATER-RECEIPT", "2026-10-01", "2026-10-25", { received_at: "2026-10-03T09:00:00+09:00" }),
        lot("EARLIER-RECEIPT", "2026-10-01", "2026-10-25", { received_at: "2026-10-02T09:00:00+09:00" }),
      ],
    });
    expect(r.lots.find((l) => l.lot_id === "Q")?.failedCode).toBe("QUARANTINE");
    expect(r.lots.find((l) => l.lot_id === "BAND")?.failedCode).toBe("TEMPERATURE_BAND");
    expect(r.recommendedLotId).toBe("EARLIER-RECEIPT");
  });

  it("excludes lots without enough quantity", () => {
    const r = evaluateLots({
      order, rule: "LABEL_DATE_ONLY", lastAcceptedExpiry: null,
      lots: [lot("SMALL", "2026-10-01", "2026-10-20", { qty_available: 5 })],
    });
    expect(r.lots[0].failedCode).toBe("QUANTITY");
  });
});
