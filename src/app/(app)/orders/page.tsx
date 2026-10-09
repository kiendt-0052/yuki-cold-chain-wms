"use client";
import Link from "next/link";
import { Alert, Badge, Card, Loading, PageHeader, Table, td } from "@/components/ui";
import { formatDate } from "@/lib/client/format";
import { useApi } from "@/lib/client/use-api";
import { BAND_SHORT, ORDER_STATUS_LABEL, TERM_LABEL, windowRuleLabel, type DeliveryTerm, type TemperatureBand } from "@/lib/domain/labels";

type Order = {
  order_id: string; customer_id: string; sku_id: string; qty: number; requested_date: string; delivery_term: DeliveryTerm;
  status: string; allocated_lot_id: string | null; delivery_window_rule: string | null;
  customers: { name: string }; skus: { name_ja: string; temperature_band: TemperatureBand };
};

const STATUS_TONE = { created: "amber", allocated: "blue", dispatched: "teal", delivered: "green" } as const;

export default function OrdersPage() {
  const { data, error } = useApi<{ orders: Order[] }>("/api/orders");
  if (error) return <Alert>{error}</Alert>;
  if (!data) return <Loading />;
  return (
    <>
      <PageHeader title="受注・引当・出荷" subtitle="受注 → 引当（期限・温度帯・隔離・納品期限・日付逆転を自動除外）→ 出荷前チェック → 配送完了（POD）" />
      <Card>
        <Table head={["受注", "顧客", "SKU", "数量", "納品日", "配送条件", "配送ウィンドウ", "ロット", "状態"]} empty={!data.orders.length}>
          {data.orders.map((o) => (
            <tr key={o.order_id} className="hover:bg-slate-50">
              <td className={td}><Link className="font-medium text-brand underline" href={`/orders/${o.order_id}`}>{o.order_id}</Link></td>
              <td className={td}>{o.customer_id}<p className="text-xs text-slate-500">{o.customers.name}</p></td>
              <td className={td}>{o.sku_id}<p className="text-xs text-slate-500">{o.skus.name_ja}（{BAND_SHORT[o.skus.temperature_band]}）</p></td>
              <td className={td}>{o.qty}</td>
              <td className={td}>{formatDate(o.requested_date)}</td>
              <td className={td}>{TERM_LABEL[o.delivery_term]}</td>
              <td className={td}>{o.delivery_window_rule ? windowRuleLabel(o.delivery_window_rule) : <Badge tone="amber">未設定</Badge>}</td>
              <td className={td}>{o.allocated_lot_id ?? "—"}</td>
              <td className={td}><Badge tone={STATUS_TONE[o.status as keyof typeof STATUS_TONE] ?? "gray"}>{ORDER_STATUS_LABEL[o.status]}</Badge></td>
            </tr>
          ))}
        </Table>
      </Card>
    </>
  );
}
