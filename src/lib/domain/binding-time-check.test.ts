import { describe, expect, it } from "vitest";
import { checkBindingTime, type Segment } from "./binding-time-check";

const start = "2026-10-10T06:00:00+09:00";

describe("checkBindingTime (simplified 拘束時間 check)", () => {
  it("passes a normal day and treats work time as binding, not driving", () => {
    const segs: Segment[] = [
      { kind: "work", minutes: 60 }, { kind: "drive", minutes: 120 }, { kind: "break", minutes: 30 },
      { kind: "drive", minutes: 150 }, { kind: "work", minutes: 30 },
    ];
    const r = checkBindingTime(start, segs, "2026-10-09T18:00:00+09:00");
    expect(r.bindingMinutes).toBe(390);
    expect(r.drivingMinutes).toBe(270);
    expect(r.publishable).toBe(true);
  });

  it("flags continuous driving over 4h when breaks total less than 30 minutes", () => {
    const segs: Segment[] = [
      { kind: "drive", minutes: 150 }, { kind: "work", minutes: 20 }, { kind: "break", minutes: 10 },
      { kind: "drive", minutes: 100 },
    ];
    const r = checkBindingTime(start, segs);
    expect(r.findings.map((f) => f.code)).toContain("CONTINUOUS_DRIVING");
    expect(r.publishable).toBe(false);
  });

  it("blocks binding time over 15h and rest under 9h; warns between 13h and 15h", () => {
    const long = checkBindingTime(start, [{ kind: "work", minutes: 931 }]);
    expect(long.findings.map((f) => f.code)).toContain("BINDING_MAX");
    const mid = checkBindingTime(start, [{ kind: "work", minutes: 800 }]);
    expect(mid.findings).toEqual([expect.objectContaining({ code: "BINDING_STANDARD", level: "warning" })]);
    const shortRest = checkBindingTime(start, [{ kind: "work", minutes: 60 }], "2026-10-09T22:00:00+09:00");
    expect(shortRest.findings.map((f) => f.code)).toContain("REST_MIN");
  });
});
