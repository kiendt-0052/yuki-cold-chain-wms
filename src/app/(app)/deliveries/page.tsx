"use client";
import Link from "next/link";
import { Alert, Badge, Card, Loading, PageHeader, Table, td } from "@/components/ui";
import { formatDate, formatDateTime } from "@/lib/client/format";
import { useApi } from "@/lib/client/use-api";
import { EXPIRY_TYPE_LABEL, TERM_LABEL, type DeliveryTerm, type ExpiryType } from "@/lib/domain/labels";

type Delivery = {
  id: number; order_id: string | null; customer_id: string; sku_id: string; lot_id: string | null; expiry_date: string; qty: number;
  delivery_term: DeliveryTerm; recipient_name: string; completed_at: string; evidence: { source?: string };
  customers: { name: string }; skus: { name_ja: string; expiry_type: ExpiryType };
};

export default function DeliveriesPage() {
  const { data, error } = useApi<{ deliveries: Delivery[] }>("/api/deliveries");
  if (error) return <Alert>{error}</Alert>;
  if (!data) return <Loading />;
  return (
    <>
      <PageHeader title="受入済み配送履歴" subtitle="日付逆転禁止の比較基準。顧客-SKUごとに直近の受入済み期限と比較します（修正は逆転イベントのみ・上書き不可）。" />
      <Card>
        <Table head={["受入日時", "顧客", "SKU", "期限", "数量", "条件", "ロット / 受注", "受取人"]} empty={!data.deliveries.length}>
          {data.deliveries.map((d) => (
            <tr key={d.id}>
              <td className={td}>{formatDateTime(d.completed_at)}</td>
              <td className={td}>{d.customer_id}<p className="text-xs text-slate-500">{d.customers.name}</p></td>
              <td className={td}>{d.sku_id}<p className="text-xs text-slate-500">{d.skus.name_ja}</p></td>
              <td className={td}>{formatDate(d.expiry_date)}<p className="text-xs text-slate-500">{EXPIRY_TYPE_LABEL[d.skus.expiry_type]}</p></td>
              <td className={td}>{d.qty}</td>
              <td className={td}>{TERM_LABEL[d.delivery_term]}</td>
              <td className={td}>
                {d.lot_id ? <Link className="text-brand underline" href={`/inventory/${d.lot_id}`}>{d.lot_id}</Link> : <Badge tone="gray">移行データ（ロット不明）</Badge>}
                {d.order_id && <p className="text-xs"><Link className="text-brand underline" href={`/orders/${d.order_id}`}>{d.order_id}</Link></p>}
              </td>
              <td className={td}>{d.recipient_name}</td>
            </tr>
          ))}
        </Table>
      </Card>
    </>
  );
}
