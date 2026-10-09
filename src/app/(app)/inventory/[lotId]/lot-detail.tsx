"use client";
import Link from "next/link";
import { Fragment, use, type ReactNode } from "react";
import { Alert, Badge, Card, Loading, PageHeader, Table, td } from "@/components/ui";
import { formatDate, formatDateTime } from "@/lib/client/format";
import { useApi } from "@/lib/client/use-api";
import { BAND_SHORT, EXPIRY_TYPE_LABEL, LOT_STATUS_LABEL, TRACE_LANE_LABEL } from "@/lib/domain/labels";
import { QualityStatusForm } from "./quality-status-form";

type LotDetailData = {
  lot: Record<string, string | number | null> & {
    skus: { name_ja: string; temperature_band: "ambient" | "chilled" | "frozen"; expiry_type: "best_before" | "use_by"; trace_lane: string };
    suppliers: { name: string }; locations: { temperature_band: "ambient" | "chilled" | "frozen"; is_quarantine: boolean };
  };
  events: { id: number; event_type: string; detail: Record<string, unknown>; actor: string; created_at: string }[];
  deliveries: { id: number; customer_id: string; customers: { name: string }; qty: number; completed_at: string; delivery_term: string }[];
  deviations: { id: number; description: string; status: string }[];
};

const EVENT_LABEL: Record<string, string> = {
  received: "入荷", allocated: "引当", allocation_cancelled: "引当取消", shipped: "出荷", delivered: "配送完了",
  quarantined: "隔離", released: "隔離解除", scrapped: "廃棄", moved: "移動",
};

export function LotDetail({ params }: { params: Promise<{ lotId: string }> }) {
  const { lotId } = use(params);
  const { data, error, reload } = useApi<LotDetailData>(`/api/lots/${encodeURIComponent(lotId)}`);
  if (error) return <Alert>{error}</Alert>;
  if (!data) return <Loading />;
  const { lot } = data;
  const info: [string, ReactNode][] = [
    ["SKU", `${lot.sku_id} ${lot.skus.name_ja}`],
    ["仕入先", `${lot.supplier_id} ${lot.suppliers.name}（ロット ${lot.supplier_lot}）`],
    ["温度帯", BAND_SHORT[lot.skus.temperature_band]],
    ["製造日 / 期限", `${formatDate(String(lot.production_date))} / ${formatDate(String(lot.expiry_date))}（${EXPIRY_TYPE_LABEL[lot.skus.expiry_type]}）`],
    ["数量（在庫/入荷）", `${lot.qty_available} / ${lot.qty_received}`],
    ["ロケーション", `${lot.location_id}${lot.locations.is_quarantine ? "（隔離エリア）" : ""}`],
    ["トレーサビリティ", TRACE_LANE_LABEL[lot.skus.trace_lane]],
    ...(lot.rice_origin ? [["米の産地", lot.rice_origin] as [string, ReactNode]] : []),
    ...(lot.beef_individual_id ? [["牛個体識別番号", lot.beef_individual_id] as [string, ReactNode]] : []),
  ];
  return (
    <>
      <PageHeader title={`ロット ${lot.lot_id}`}
        actions={<Badge tone={lot.status === "available" ? "green" : lot.status === "quarantine" ? "red" : "gray"}>{LOT_STATUS_LABEL[String(lot.status)]}</Badge>} />
      <div className="grid gap-5 lg:grid-cols-2">
        <Card title="ロット情報">
          <dl className="grid grid-cols-[9rem_1fr] gap-y-1.5 text-sm">
            {info.map(([k, v]) => <Fragment key={k}><dt className="text-slate-500">{k}</dt><dd>{v}</dd></Fragment>)}
          </dl>
          {data.deviations.length > 0 && (
            <div className="mt-3 space-y-1 text-sm">
              {data.deviations.map((d) => (
                <p key={d.id}><Link className="text-brand underline" href={`/temperature/deviations/${d.id}`}>逸脱ケース #{d.id}</Link>（{d.status === "open" ? "対応中" : "完了"}）{d.description}</p>
              ))}
            </div>
          )}
        </Card>
        <Card title="品質ステータス変更（品質管理）">
          <QualityStatusForm lotId={String(lot.lot_id)} status={String(lot.status)} onDone={reload} />
        </Card>
      </div>
      <Card title="履歴（不変イベント・上書きなし）" className="mt-5">
        <Table head={["日時", "イベント", "内容", "実施者"]} empty={!data.events.length}>
          {data.events.map((e) => (
            <tr key={e.id}>
              <td className={td}>{formatDateTime(e.created_at)}</td>
              <td className={td}><Badge tone="teal">{EVENT_LABEL[e.event_type] ?? e.event_type}</Badge></td>
              <td className={`${td} text-xs text-slate-600`}>{JSON.stringify(e.detail)}</td>
              <td className={td}>{e.actor}</td>
            </tr>
          ))}
        </Table>
      </Card>
      <Card title="配送先（受入済み）" className="mt-5">
        <Table head={["配送完了", "顧客", "数量", "条件"]} empty={!data.deliveries.length}>
          {data.deliveries.map((d) => (
            <tr key={d.id}><td className={td}>{formatDateTime(d.completed_at)}</td><td className={td}>{d.customer_id} {d.customers.name}</td>
              <td className={td}>{d.qty}</td><td className={td}>{d.delivery_term === "on_truck" ? "車上渡し" : "軒先渡し"}</td></tr>
          ))}
        </Table>
      </Card>
    </>
  );
}
