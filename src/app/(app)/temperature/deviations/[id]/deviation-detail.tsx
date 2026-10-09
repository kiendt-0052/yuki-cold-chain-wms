"use client";
import Link from "next/link";
import { use, useState, type FormEvent } from "react";
import { Alert, Badge, Button, Card, Field, inputClass, Loading, PageHeader, Table, td } from "@/components/ui";
import { useSession } from "@/components/session-context";
import { api } from "@/lib/client/api-client";
import { formatDate, formatDateTime } from "@/lib/client/format";
import { useApi } from "@/lib/client/use-api";
import { LOT_STATUS_LABEL } from "@/lib/domain/labels";

type Data = {
  deviation: {
    id: number; source: string; description: string; status: string; affected_lots: string[]; investigation: string | null;
    corrective_action: string | null; decision: string | null; rationale: string | null; attachment_ref: string | null;
    decided_by: string | null; closed_at: string | null; created_at: string;
  };
  alarm: { device_id: string; peak_c: number; first_at: string; last_at: string; reviewed_at: string | null } | null;
  lots: { lot_id: string; sku_id: string; status: string; qty_available: number; expiry_date: string; location_id: string; skus: { name_ja: string } }[];
};

export function DeviationDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { can } = useSession();
  const { data, error, reload } = useApi<Data>(`/api/deviations/${id}`);
  const [f, setF] = useState({ investigation: "", corrective_action: "", decision: "", rationale: "", attachment_ref: "" });
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  if (error) return <Alert>{error}</Alert>;
  if (!data) return <Loading />;
  const d = data.deviation;
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });

  async function close(e: FormEvent) {
    e.preventDefault();
    setBusy(true); setMsg(null);
    try {
      await api.post(`/api/deviations/${id}`, { ...f, decision: f.decision || undefined });
      reload();
    } catch (err) {
      setMsg((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader title={`逸脱ケース #${d.id}`} subtitle={d.description}
        actions={d.status === "open" ? <Badge tone="red">対応中</Badge> : <Badge tone="green">完了</Badge>} />
      {data.alarm && (
        <Card title="発生アラーム" className="mb-5">
          <p className="text-sm">{data.alarm.device_id} 最大 {data.alarm.peak_c}℃ ／ {formatDateTime(data.alarm.first_at)}〜{formatDateTime(data.alarm.last_at)}
            ／ 初回確認 {formatDateTime(data.alarm.reviewed_at)}</p>
        </Card>
      )}
      <Card title="対象ロット（自動隔離・システムは品質を自動判定しません）" className="mb-5">
        <Table head={["ロット", "SKU", "期限", "在庫", "場所", "状態"]} empty={!data.lots.length}>
          {data.lots.map((l) => (
            <tr key={l.lot_id}>
              <td className={td}><Link className="text-brand underline" href={`/inventory/${l.lot_id}`}>{l.lot_id}</Link></td>
              <td className={td}>{l.sku_id} {l.skus?.name_ja}</td><td className={td}>{formatDate(l.expiry_date)}</td>
              <td className={td}>{l.qty_available}</td><td className={td}>{l.location_id}</td>
              <td className={td}><Badge tone={l.status === "quarantine" ? "red" : l.status === "available" ? "green" : "gray"}>{LOT_STATUS_LABEL[l.status]}</Badge></td>
            </tr>
          ))}
        </Table>
      </Card>
      {d.status === "closed" ? (
        <Card title="判定結果">
          <dl className="grid grid-cols-[8rem_1fr] gap-y-1.5 text-sm">
            <dt className="text-slate-500">判定</dt><dd>{d.decision === "release" ? "隔離解除" : "廃棄"}（{d.decided_by}・{formatDateTime(d.closed_at)}）</dd>
            <dt className="text-slate-500">調査</dt><dd>{d.investigation}</dd>
            <dt className="text-slate-500">是正措置</dt><dd>{d.corrective_action ?? "—"}</dd>
            <dt className="text-slate-500">根拠</dt><dd>{d.rationale}</dd>
            <dt className="text-slate-500">添付</dt><dd>{d.attachment_ref ?? "—"}</dd>
          </dl>
        </Card>
      ) : (
        <Card title="調査・是正・判定（品質管理）">
          <form onSubmit={close} className="grid gap-3 sm:grid-cols-2">
            <Field label="調査内容" required><textarea className={inputClass} rows={2} value={f.investigation} onChange={set("investigation")} /></Field>
            <Field label="是正措置" required><textarea className={inputClass} rows={2} value={f.corrective_action} onChange={set("corrective_action")} /></Field>
            <Field label="判定" required>
              <select className={inputClass} value={f.decision} onChange={set("decision")}>
                <option value="">選択</option><option value="release">隔離解除（再判定OK）</option><option value="scrap">廃棄（安全NG）</option>
              </select>
            </Field>
            <Field label="添付（再測定記録・写真のファイル名／モック）" required><input className={inputClass} value={f.attachment_ref} onChange={set("attachment_ref")} /></Field>
            <div className="sm:col-span-2"><Field label="判定根拠" required><textarea className={inputClass} rows={2} value={f.rationale} onChange={set("rationale")} /></Field></div>
            <div className="sm:col-span-2 space-y-2">
              {msg && <Alert>{msg}</Alert>}
              <Button type="submit" disabled={busy || !can("deviation:decide")}>{can("deviation:decide") ? "判定してケースを閉じる" : "品質管理・管理者のみ"}</Button>
            </div>
          </form>
        </Card>
      )}
    </>
  );
}
