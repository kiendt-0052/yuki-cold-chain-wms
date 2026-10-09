"use client";
import { use, useMemo, useState } from "react";
import { Alert, Badge, Button, Card, Field, inputClass, Loading, PageHeader } from "@/components/ui";
import { useSession } from "@/components/session-context";
import { api, ApiError } from "@/lib/client/api-client";
import { formatDateTime } from "@/lib/client/format";
import { useApi } from "@/lib/client/use-api";
import { checkBindingTime, formatMinutes, type BindingTimeResult, type Segment } from "@/lib/domain/binding-time-check";
import { CheckSummary } from "./check-summary";

type Data = {
  route: { route_id: string; driver_name: string; vehicle: string; start_time: string; prev_route_end: string | null; segments: Segment[];
    status: string; version: number; rule_version: string | null; published_at: string | null; change_reason: string | null };
  check: BindingTimeResult;
};
const KIND_LABEL: Record<Segment["kind"], string> = { drive: "運転", work: "荷役・作業", break: "休憩", wait: "待機" };

export function RouteEditor({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data, error, reload } = useApi<Data>(`/api/routes/${id}`);
  if (error) return <Alert>{error}</Alert>;
  if (!data) return <Loading />;
  // Re-mount the form whenever the saved route changes, so its local edits start from the stored segments.
  return <RouteForm key={`${data.route.version}:${data.route.status}:${JSON.stringify(data.route.segments)}`} id={id} data={data} reload={reload} />;
}

function RouteForm({ id, data, reload }: { id: string; data: Data; reload: () => void }) {
  const { can } = useSession();
  const { route } = data;
  const [segments, setSegments] = useState<Segment[]>(route.segments);
  const [reason, setReason] = useState("");
  const [msg, setMsg] = useState<{ tone: "red" | "green"; text: string } | null>(null);
  // Live preview with the same pure function the API uses to decide.
  const preview = useMemo(() => checkBindingTime(route.start_time, segments, route.prev_route_end), [route, segments]);
  const update = (i: number, patch: Partial<Segment>) => setSegments(segments.map((s, j) => (j === i ? { ...s, ...patch } : s)));

  async function save() {
    setMsg(null);
    try {
      await api.put(`/api/routes/${id}`, { segments, change_reason: reason || undefined });
      setMsg({ tone: "green", text: "保存しました（下書き）。公開するには再チェックが必要です。" });
      setReason(""); reload();
    } catch (e) { setMsg({ tone: "red", text: (e as Error).message }); }
  }
  async function publish() {
    setMsg(null);
    try {
      await api.post(`/api/routes/${id}/publish`);
      setMsg({ tone: "green", text: "公開しました。公開時点のルール版に紐づけています。" });
      reload();
    } catch (e) {
      const findings = ((e as ApiError).details?.findings ?? []) as { message: string }[];
      setMsg({ tone: "red", text: `${(e as Error).message}${findings.length ? "：" + findings.map((f) => f.message).join(" ／ ") : ""}` });
    }
  }

  const dirty = JSON.stringify(segments) !== JSON.stringify(route.segments);
  return (
    <>
      <PageHeader title={`ルート ${route.route_id}`} subtitle={`${route.driver_name} ／ ${route.vehicle} ／ 始業 ${formatDateTime(route.start_time)}`}
        actions={route.status === "published" ? <Badge tone="teal">公開済 v{route.version}（{route.rule_version}）</Badge> : <Badge>下書き v{route.version}</Badge>} />
      <div className="grid gap-5 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Card title="運行区間（編集するとその場で再判定）">
          <div className="space-y-2">
            {segments.map((s, i) => (
              <div key={i} className="grid grid-cols-[3.5rem_7rem_6rem_1fr_auto] items-center gap-2 text-sm">
                <span className="text-xs text-slate-500">{preview.timeline[i]?.start}〜{preview.timeline[i]?.end}</span>
                <select className={inputClass} value={s.kind} onChange={(e) => update(i, { kind: e.target.value as Segment["kind"] })}>
                  {Object.entries(KIND_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
                <input type="number" min={1} className={inputClass} value={s.minutes} onChange={(e) => update(i, { minutes: Number(e.target.value) })} />
                <input className={inputClass} value={s.note ?? ""} placeholder="メモ" onChange={(e) => update(i, { note: e.target.value })} />
                <Button variant="secondary" onClick={() => setSegments(segments.filter((_, j) => j !== i))}>削除</Button>
              </div>
            ))}
            <Button variant="secondary" onClick={() => setSegments([...segments, { kind: "break", minutes: 30 }])}>区間を追加</Button>
          </div>
          {can("route:edit") && (
            <div className="mt-4 space-y-3 border-t border-slate-100 pt-4">
              {route.status === "published" && (
                <Field label="変更理由（公開済みルートの変更は必須・新バージョンになります）" required>
                  <input className={inputClass} value={reason} onChange={(e) => setReason(e.target.value)} />
                </Field>
              )}
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" onClick={save} disabled={!dirty}>保存</Button>
                <Button onClick={publish} disabled={dirty || route.status === "published" || !preview.publishable}>公開</Button>
              </div>
            </div>
          )}
          {msg && <div className="mt-3"><Alert tone={msg.tone}>{msg.text}</Alert></div>}
        </Card>
        <Card title="拘束時間チェック結果">
          <CheckSummary check={preview} />
          <p className="mt-3 text-xs text-slate-500">前日終業：{formatDateTime(route.prev_route_end)} ／ 休息期間 {preview.restBeforeMinutes !== null ? formatMinutes(preview.restBeforeMinutes) : "—"}</p>
        </Card>
      </div>
    </>
  );
}
