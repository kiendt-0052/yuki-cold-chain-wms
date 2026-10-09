"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Alert, Badge, Button } from "@/components/ui";
import { useSession } from "@/components/session-context";
import { api } from "@/lib/client/api-client";
import { formatDateTime } from "@/lib/client/format";

export type Alarm = {
  id: number; device_id: string; zone: string; first_at: string; last_at: string; peak_c: number; reading_count: number;
  status: string; reviewed_at: string | null; reviewed_by: string | null; deviation_id: number | null; created_at: string;
};

const SLA_MS = 15 * 60_000;

export function AlarmQueue({ alarms, now, onDone }: { alarms: Alarm[]; now: string; onDone: () => void }) {
  const { can } = useSession();
  // Countdown runs on the server clock: start from the API's `now`, then advance with the local clock.
  const [tick, setTick] = useState(() => Date.parse(now));
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => {
    const offset = Date.parse(now) - Date.now();
    const t = setInterval(() => setTick(Date.now() + offset), 1000);
    return () => clearInterval(t);
  }, [now]);

  async function review(id: number) {
    try {
      const r = await api.post<{ minutes: number; withinSla: boolean }>(`/api/alarms/${id}/review`);
      setMsg(r.withinSla ? `確認を記録しました（${r.minutes}分）` : `確認を記録しました（${r.minutes}分・15分超過として報告されます）`);
      onDone();
    } catch (e) {
      setMsg((e as Error).message);
    }
  }

  const open = alarms.filter((a) => a.status === "open");
  return (
    <div className="space-y-3">
      {open.length === 0 && <p className="text-sm text-slate-500">未確認のアラームはありません。下のサンプルCSVを取り込むと発生します。</p>}
      {msg && <Alert tone="blue">{msg}</Alert>}
      <ul className="space-y-2">
        {alarms.slice(0, 8).map((a) => {
          const remaining = Date.parse(a.created_at) + SLA_MS - tick;
          const overdue = a.status === "open" && remaining < 0;
          return (
            <li key={a.id} className={`rounded-md border p-3 text-sm ${a.status === "open" ? (overdue ? "border-red-400 bg-red-50" : "border-amber-300 bg-amber-50") : "border-slate-200"}`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium">#{a.id} {a.device_id}（{a.zone}ゾーン） 最大 {a.peak_c}℃</span>
                {a.status === "open"
                  ? <Badge tone={overdue ? "red" : "amber"}>{overdue ? `期限超過 ${Math.ceil(-remaining / 60_000)}分` : `残り ${Math.floor(remaining / 60_000)}:${String(Math.floor((remaining % 60_000) / 1000)).padStart(2, "0")}`}</Badge>
                  : <Badge tone={a.status === "closed" ? "green" : "blue"}>{a.status === "closed" ? "クローズ" : "確認済"}</Badge>}
              </div>
              <p className="mt-1 text-xs text-slate-600">
                {formatDateTime(a.first_at)}〜{formatDateTime(a.last_at)}（{a.reading_count}件）
                {a.reviewed_at && ` ／ 確認 ${formatDateTime(a.reviewed_at)} ${a.reviewed_by}`}
                {a.deviation_id && <> ／ <Link className="text-brand underline" href={`/temperature/deviations/${a.deviation_id}`}>逸脱 #{a.deviation_id}</Link></>}
              </p>
              {a.status === "open" && can("alarm:review") && <Button className="mt-2" onClick={() => review(a.id)}>確認を記録</Button>}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
