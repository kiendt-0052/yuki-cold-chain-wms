import { describe, expect, it } from "vitest";
import { judgeInbound, type InboundInput } from "./inbound-validation";
import { validatePod } from "./pod-evidence";

const input: InboundInput = {
  request_id: "r1", supplier_id: "SUP-002", sku_id: "CHI-001", supplier_lot: "BF-1",
  qty_reported: 10, qty_accepted: 10, qty_rejected: 0, expiry_type: "use_by",
  production_date: "2026-10-07", expiry_date: "2026-10-14", measured_temp: 3.2, packaging_ok: true,
  photo_ref: "photo.jpg", location_id: "C-01-01", beef_individual_id: "1234567890",
};
const beef = { temperature_band: "chilled" as const, expiry_type: "use_by" as const, trace_lane: "beef" };

describe("judgeInbound", () => {
  it("accepts a complete chilled beef receipt", () => {
    expect(judgeInbound(input, beef, "chilled")).toMatchObject({ errors: [], result: "accepted" });
  });

  it("rejects a 9-digit beef ID and a 賞味/消費 mix-up instead of guessing", () => {
    const r = judgeInbound({ ...input, beef_individual_id: "123456789", expiry_type: "best_before" }, beef, "chilled");
    expect(r.errors.map((e) => e.field)).toEqual(expect.arrayContaining(["beef_individual_id", "expiry_type"]));
  });

  it("quarantines (not rejects) an out-of-band temperature", () => {
    const r = judgeInbound({ ...input, measured_temp: 7.2 }, beef, "chilled");
    expect(r.errors).toEqual([]);
    expect(r.result).toBe("quarantined");
  });

  it("requires a variance reason when accepted + rejected ≠ reported", () => {
    const r = judgeInbound({ ...input, qty_accepted: 8 }, beef, "chilled");
    expect(r.errors.map((e) => e.field)).toContain("variance_reason");
  });
});

describe("validatePod", () => {
  it("asks different evidence for 車上渡し and 軒先渡し", () => {
    const pod = { recipient_name: "田中", signature_obtained: true, photo_ref: "p.jpg", unload_location: "バックヤード" };
    expect(validatePod("at_door", "chilled", pod)).toEqual([]);
    expect(validatePod("on_truck", "chilled", pod).length).toBeGreaterThan(0);
  });

  it("blocks 車上渡し when the handoff temperature is out of band", () => {
    const pod = { recipient_name: "田中", signature_obtained: true, handoff_temp: 8, seal_intact: true };
    expect(validatePod("on_truck", "chilled", pod)).toHaveLength(1);
  });
});
