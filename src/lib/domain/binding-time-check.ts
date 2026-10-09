// 拘束時間チェック（簡易版）— FR-SCH-02/03 の一部のみ。
// 拘束時間 = 始業〜終業の全時間（運転・荷役・休憩・待機を含む）。運転時間とは別物。
// 休息期間 = 前日の終業から当日の始業まで（勤務中の休憩とは別物）。
// 簡易化: 1日分のみ判定。年3,300h・月284h・2日平均・2週平均は対象外（README参照）。

export type Segment = { kind: "drive" | "work" | "break" | "wait"; minutes: number; note?: string };

export type Finding = { code: string; level: "violation" | "warning"; message: string };

export type BindingTimeResult = {
  ruleVersion: string;
  bindingMinutes: number;
  drivingMinutes: number;
  maxContinuousDriving: number;
  restBeforeMinutes: number | null;
  endTime: string;
  timeline: (Segment & { start: string; end: string })[];
  findings: Finding[];
  publishable: boolean;
};

export const RULE_VERSION = "改善基準告示 2024-04（簡易版 v1）";
export const LIMITS = {
  bindingStandard: 13 * 60,
  bindingMax: 15 * 60,
  drivingPerDay: 9 * 60,
  continuousDriving: 4 * 60,
  breakToResetContinuous: 30,
  breakMinPiece: 10,
  restStandard: 11 * 60,
  restMin: 9 * 60,
};

const hm = (m: number) => `${Math.floor(m / 60)}時間${String(m % 60).padStart(2, "0")}分`;
const clock = (d: Date) =>
  new Date(d.getTime() + 9 * 3_600_000).toISOString().slice(11, 16); // JST HH:MM

export function checkBindingTime(startIso: string, segments: Segment[], prevRouteEndIso?: string | null): BindingTimeResult {
  const findings: Finding[] = [];
  const timeline: BindingTimeResult["timeline"] = [];
  let cursor = new Date(startIso);
  let driving = 0, continuous = 0, maxContinuous = 0, breakAccum = 0;

  segments.forEach((seg, i) => {
    const start = new Date(cursor);
    cursor = new Date(cursor.getTime() + seg.minutes * 60_000);
    timeline.push({ ...seg, start: clock(start), end: clock(cursor) });
    if (seg.kind === "drive") {
      driving += seg.minutes;
      continuous += seg.minutes;
      maxContinuous = Math.max(maxContinuous, continuous);
      if (continuous > LIMITS.continuousDriving) {
        findings.push({ code: "CONTINUOUS_DRIVING", level: "violation",
          message: `連続運転 ${hm(continuous)}（上限4時間）— 区間${i + 1} ${clock(start)}〜${clock(cursor)}。4時間以内に合計30分以上の中断が必要` });
      }
    } else if (seg.kind === "break" && seg.minutes >= LIMITS.breakMinPiece) {
      breakAccum += seg.minutes;
      if (breakAccum >= LIMITS.breakToResetContinuous) {
        continuous = 0;
        breakAccum = 0;
      }
    }
  });

  const binding = segments.reduce((s, x) => s + x.minutes, 0);
  if (binding > LIMITS.bindingMax) {
    findings.push({ code: "BINDING_MAX", level: "violation", message: `1日の拘束時間 ${hm(binding)}（最大15時間を超過）` });
  } else if (binding > LIMITS.bindingStandard) {
    findings.push({ code: "BINDING_STANDARD", level: "warning", message: `1日の拘束時間 ${hm(binding)}（原則13時間を超過。延長は回数制限あり）` });
  }
  if (driving > LIMITS.drivingPerDay) {
    findings.push({ code: "DRIVING_PER_DAY", level: "violation", message: `運転時間 ${hm(driving)}（1日9時間の目安を超過。本来は2日平均で判定）` });
  }

  let restBefore: number | null = null;
  if (prevRouteEndIso) {
    restBefore = Math.round((Date.parse(startIso) - Date.parse(prevRouteEndIso)) / 60_000);
    if (restBefore < LIMITS.restMin) {
      findings.push({ code: "REST_MIN", level: "violation", message: `休息期間 ${hm(restBefore)}（最低9時間を下回る）` });
    } else if (restBefore < LIMITS.restStandard) {
      findings.push({ code: "REST_STANDARD", level: "warning", message: `休息期間 ${hm(restBefore)}（原則11時間以上が望ましい）` });
    }
  }

  // Report each violation code once (the first occurrence pinpoints the time range).
  const unique = findings.filter((f, i) => findings.findIndex((g) => g.code === f.code) === i);
  return {
    ruleVersion: RULE_VERSION,
    bindingMinutes: binding,
    drivingMinutes: driving,
    maxContinuousDriving: maxContinuous,
    restBeforeMinutes: restBefore,
    endTime: cursor.toISOString(),
    timeline,
    findings: unique,
    publishable: !unique.some((f) => f.level === "violation"),
  };
}

export { hm as formatMinutes };
