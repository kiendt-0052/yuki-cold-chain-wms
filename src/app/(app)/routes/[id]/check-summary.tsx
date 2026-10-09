import { Alert } from "@/components/ui";
import { formatMinutes, LIMITS, type BindingTimeResult } from "@/lib/domain/binding-time-check";

export function CheckSummary({ check }: { check: BindingTimeResult }) {
  const rows: [string, number, number][] = [
    ["拘束時間（1日）", check.bindingMinutes, LIMITS.bindingMax],
    ["運転時間（1日）", check.drivingMinutes, LIMITS.drivingPerDay],
    ["最大連続運転", check.maxContinuousDriving, LIMITS.continuousDriving],
  ];
  return (
    <div className="space-y-3 text-sm">
      {rows.map(([label, value, limit]) => (
        <div key={label}>
          <div className="flex justify-between"><span>{label}</span><span>{formatMinutes(value)} ／ 上限 {formatMinutes(limit)}</span></div>
          <div className="mt-1 h-2 rounded bg-slate-200">
            <div className={`h-2 rounded ${value > limit ? "bg-red-500" : value > limit * 0.85 ? "bg-amber-500" : "bg-brand"}`}
              style={{ width: `${Math.min(100, (value / limit) * 100)}%` }} />
          </div>
        </div>
      ))}
      {check.findings.length === 0
        ? <Alert tone="green">違反・警告はありません。公開できます。</Alert>
        : check.findings.map((f) => <Alert key={f.code} tone={f.level === "violation" ? "red" : "amber"}>{f.level === "violation" ? "違反" : "警告"}：{f.message}</Alert>)}
      <p className="text-xs text-slate-500">ルール版：{check.ruleVersion}</p>
    </div>
  );
}
