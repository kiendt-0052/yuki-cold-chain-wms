"use client";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { Alert, Badge, Button, Card, inputClass, PageHeader, Table, td } from "@/components/ui";
import { api } from "@/lib/client/api-client";
import { formatDate, formatDateTime } from "@/lib/client/format";
import { LOT_STATUS_LABEL, TRACE_LANE_LABEL } from "@/lib/domain/labels";

type TraceResult = {
  query: string; notices: string[]; elapsedMs: number;
  lots: { lot_id: string; sku_id: string; supplier_id: string; supplier_lot: string; expiry_date: string; qty_received: number; qty_available: number;
    status: string; rice_origin: string | null; beef_individual_id: string | null; received_at: string;
    skus: { name_ja: string; trace_lane: string }; suppliers: { name: string } }[];
  deliveries: { id: number; lot_id: string; customer_id: string; qty: number; completed_at: string; customers: { name: string } }[];
  unlinkedDeliveries: { id: number; sku_id: string; customer_id: string; qty: number; completed_at: string; customers: { name: string } }[];
};

export default function TracePage() {
  const [q, setQ] = useState("");
  const [result, setResult] = useState<TraceResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function search(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      setResult(await api.get<TraceResult>(`/api/trace?q=${encodeURIComponent(q)}`));
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <>
      <PageHeader title="トレース検索" subtitle="ロット・SKU・仕入先ロット・米の産地・牛個体識別番号（10桁）から、仕入先 → 倉庫 → 配送先を追跡します。" />
      <Card className="mb-5">
        <form onSubmit={search} className="flex flex-wrap gap-2">
          <input className={`${inputClass} max-w-md`} value={q} onChange={(e) => setQ(e.target.value)} placeholder="例：1234567890 / 新潟県 / LOT-S-0009 / CHI-002" />
          <Button type="submit">検索</Button>
        </form>
        <p className="mt-2 text-xs text-slate-500">法定トレース対象は米・牛のみ。その他は社内ロット（ユキ物流の社内ルール）です。</p>
      </Card>
      {error && <Alert>{error}</Alert>}
      {result && (
        <div className="space-y-5">
          {result.notices.map((n) => <Alert key={n} tone="amber">{n}</Alert>)}
          <p className="text-xs text-slate-500">検索時間 {result.elapsedMs} ms（目標：3年分で60秒以内）</p>
          <Card title={`該当ロット（${result.lots.length}件）`}>
            <Table head={["仕入先", "ロット", "SKU / トレース区分", "期限", "入荷/在庫", "状態", "配送先"]} empty={!result.lots.length}>
              {result.lots.map((l) => {
                const shipped = result.deliveries.filter((d) => d.lot_id === l.lot_id);
                return (
                  <tr key={l.lot_id}>
                    <td className={td}>{l.supplier_id} {l.suppliers.name}<p className="text-xs text-slate-500">仕入先ロット {l.supplier_lot}</p></td>
                    <td className={td}><Link className="text-brand underline" href={`/inventory/${l.lot_id}`}>{l.lot_id}</Link>
                      <p className="text-xs text-slate-500">{formatDateTime(l.received_at)} 入荷</p></td>
                    <td className={td}>{l.sku_id} {l.skus.name_ja}<p className="text-xs text-slate-500">{TRACE_LANE_LABEL[l.skus.trace_lane]}
                      {l.rice_origin && ` ／ 産地 ${l.rice_origin}`}{l.beef_individual_id && ` ／ 個体 ${l.beef_individual_id}`}</p></td>
                    <td className={td}>{formatDate(l.expiry_date)}</td>
                    <td className={td}>{l.qty_received} / {l.qty_available}</td>
                    <td className={td}><Badge tone={l.status === "available" ? "green" : "red"}>{LOT_STATUS_LABEL[l.status]}</Badge></td>
                    <td className={`${td} text-xs`}>
                      {shipped.length ? shipped.map((d) => <p key={d.id}>{d.customer_id} {d.customers.name}（{d.qty}・{formatDate(d.completed_at)}）</p>) : "未出荷"}
                    </td>
                  </tr>
                );
              })}
            </Table>
          </Card>
          {result.unlinkedDeliveries.length > 0 && (
            <Card title="データの連鎖が途切れている地点">
              <p className="mb-2 text-xs text-slate-600">稼働前の移行データ（ロット不明）。この先はロット単位で追跡できません。</p>
              <ul className="text-sm">
                {result.unlinkedDeliveries.map((d) => <li key={d.id}>{d.sku_id} → {d.customer_id} {d.customers.name}（{d.qty}・{formatDate(d.completed_at)}）</li>)}
              </ul>
            </Card>
          )}
        </div>
      )}
    </>
  );
}
