"use client";
import { use } from "react";
import { Alert, Badge, Card, Loading, PageHeader } from "@/components/ui";
import { formatDate, formatDateTime } from "@/lib/client/format";
import { useApi } from "@/lib/client/use-api";
import { BAND_SHORT, EXPIRY_TYPE_LABEL, ORDER_STATUS_LABEL, TERM_LABEL, windowRuleLabel } from "@/lib/domain/labels";
import { AllocationPanel } from "./allocation-panel";
import { DeliveryPanel } from "./delivery-panel";
import type { OrderDetailData } from "./order-types";
import { ShipmentPanel } from "./shipment-panel";

const STEPS = ["created", "allocated", "dispatched", "delivered"];

export function OrderDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data, error, reload } = useApi<OrderDetailData>(`/api/orders/${encodeURIComponent(id)}`);
  if (error) return <Alert>{error}</Alert>;
  if (!data) return <Loading />;
  const { order, sku, customer, agreement, lastAccepted } = data;
  const stepIndex = STEPS.indexOf(order.status);

  return (
    <>
      <PageHeader title={`受注 ${order.order_id}`} subtitle={`${customer.customer_id} ${customer.name} ／ ${sku.sku_id} ${sku.name_ja}`} />
      <ol className="mb-5 flex flex-wrap gap-2 text-sm">
        {STEPS.map((s, i) => (
          <li key={s} className={`rounded-full px-3 py-1 ${i <= stepIndex ? "bg-brand text-white" : "bg-slate-200 text-slate-600"}`}>
            {i + 1}. {ORDER_STATUS_LABEL[s]}
          </li>
        ))}
      </ol>
      <Card title="受注・契約条件" className="mb-5">
        <dl className="grid gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2 lg:grid-cols-3">
          <div><dt className="text-slate-500">数量 / 納品日</dt><dd>{order.qty} ／ {formatDate(order.requested_date)}</dd></div>
          <div><dt className="text-slate-500">温度帯・期限種別</dt><dd>{BAND_SHORT[sku.temperature_band]}・{EXPIRY_TYPE_LABEL[sku.expiry_type]}</dd></div>
          <div><dt className="text-slate-500">配送条件</dt><dd>{TERM_LABEL[order.delivery_term]}</dd></div>
          <div>
            <dt className="text-slate-500">配送ウィンドウ（{agreement?.agreement_id ?? "契約なし"}）</dt>
            <dd>{agreement?.delivery_window_rule ? windowRuleLabel(agreement.delivery_window_rule) : <Badge tone="amber">未設定</Badge>}
              <span className="ml-1 text-xs text-slate-500">※契約に基づく商慣行（法令ではない）</span></dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-slate-500">同一顧客-SKUの直近受入済み配送（日付逆転の比較基準）</dt>
            <dd>{lastAccepted ? `期限 ${formatDate(lastAccepted.expiry_date)}（${formatDateTime(lastAccepted.completed_at)} 受入）` : "履歴なし（他顧客の履歴は使用しません）"}</dd>
          </div>
        </dl>
      </Card>
      {order.status === "created" && data.evaluation && <AllocationPanel data={data} onDone={reload} />}
      {order.status !== "created" && (
        <Card title="引当結果" className="mb-5">
          <p className="text-sm">ロット <strong>{order.allocated_lot_id}</strong>（期限 {formatDate(data.allocatedLot?.expiry_date)}）</p>
          {data.allocations.filter((a) => !a.cancelled_at).map((a) => (
            <p key={a.id} className="mt-1 text-xs text-slate-600">
              {formatDateTime(a.created_at)} {a.decided_by}
              {a.warnings?.length > 0 && ` ／ 警告：${a.warnings.join("、")}`}
              {a.override_reason && ` ／ 確認理由：${a.override_reason}`}
            </p>
          ))}
        </Card>
      )}
      {order.status === "allocated" && <ShipmentPanel data={data} onDone={reload} />}
      {order.status === "dispatched" && <DeliveryPanel data={data} onDone={reload} />}
      {order.status === "delivered" && data.delivery && (
        <Card title="配送完了（受入済み配送履歴に登録）">
          <p className="text-sm">受取人：{data.delivery.recipient_name} ／ {formatDateTime(data.delivery.completed_at)}</p>
          <p className="mt-1 break-all text-xs text-slate-500">証跡ハッシュ（SHA-256）：{data.delivery.evidence_hash}</p>
        </Card>
      )}
    </>
  );
}
