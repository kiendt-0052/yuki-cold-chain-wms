"use client";
import Link from "next/link";
import { Alert, Badge, Card, Loading, PageHeader, Table, td } from "@/components/ui";
import { formatDateTime } from "@/lib/client/format";
import { useApi } from "@/lib/client/use-api";
import { InboundForm, type InboundOptions } from "./inbound-form";

type Recent = {
  id: number; lot_id: string; sku_id: string; supplier_lot: string; qty_accepted: number; qty_rejected: number;
  measured_temp: number; result: string; reason: string | null; inspected_by: string; inspected_at: string;
  skus: { name_ja: string }; suppliers: { name: string };
};

export default function InboundPage() {
  const { data, error, reload } = useApi<InboundOptions & { recent: Recent[] }>("/api/inbound");
  if (error) return <Alert>{error}</Alert>;
  if (!data) return <Loading />;
  return (
    <>
      <PageHeader title="入荷検品" subtitle="P0項目（数量・ロット・期限種別・実測温度・写真）が揃わないと確定できません。基準外温度は自動で隔離されます。" />
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Card title="検品入力（ハンディ画面想定）">
          <InboundForm options={data} onDone={reload} />
        </Card>
        <Card title="最近の入荷検品">
          <Table head={["日時", "ロット", "SKU", "受入/拒否", "温度", "判定"]} empty={!data.recent.length}>
            {data.recent.map((r) => (
              <tr key={r.id}>
                <td className={td}>{formatDateTime(r.inspected_at)}</td>
                <td className={td}><Link className="text-brand underline" href={`/inventory/${r.lot_id}`}>{r.lot_id}</Link></td>
                <td className={td}>{r.sku_id}<br /><span className="text-xs text-slate-500">{r.skus?.name_ja}</span></td>
                <td className={td}>{r.qty_accepted} / {r.qty_rejected}</td>
                <td className={td}>{r.measured_temp}℃</td>
                <td className={td}>
                  {r.result === "accepted" ? <Badge tone="green">受入</Badge> : <Badge tone="red">隔離</Badge>}
                  {r.reason && <p className="mt-1 text-xs text-slate-500">{r.reason}</p>}
                </td>
              </tr>
            ))}
          </Table>
        </Card>
      </div>
    </>
  );
}
