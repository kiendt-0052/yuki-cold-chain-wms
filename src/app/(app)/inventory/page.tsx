"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { Alert, Badge, Card, inputClass, Loading, PageHeader, Table, td } from "@/components/ui";
import { formatDate } from "@/lib/client/format";
import { useApi } from "@/lib/client/use-api";
import { diffDays } from "@/lib/domain/dates";
import { BAND_SHORT, EXPIRY_TYPE_LABEL, LOT_STATUS_LABEL, type ExpiryType, type TemperatureBand } from "@/lib/domain/labels";

type Lot = {
  lot_id: string; sku_id: string; supplier_lot: string; expiry_date: string; qty_received: number; qty_available: number;
  location_id: string; status: string;
  skus: { name_ja: string; temperature_band: TemperatureBand; expiry_type: ExpiryType };
  locations: { temperature_band: TemperatureBand };
};

export default function InventoryPage() {
  return (
    <Suspense fallback={<Loading />}>
      <InventoryList />
    </Suspense>
  );
}

function InventoryList() {
  const sp = useSearchParams();
  const [filters, setFilters] = useState(() => ({
    q: sp.get("q") ?? "", status: sp.get("status") ?? "", band: sp.get("band") ?? "", expiringDays: sp.get("expiringDays") ?? "",
  }));
  const qs = new URLSearchParams(Object.entries(filters).filter(([, v]) => v)).toString();
  const { data, error } = useApi<{ lots: Lot[]; today: string }>(`/api/lots?${qs}`);
  const set = (k: keyof typeof filters) => (e: { target: { value: string } }) => setFilters({ ...filters, [k]: e.target.value });

  return (
    <>
      <PageHeader title="在庫・ロット照会" subtitle="期限の近い順に表示（FEFO）。隔離中ロットは引当・ピッキング対象外です。" />
      <Card className="mb-4">
        <div className="grid gap-3 sm:grid-cols-4">
          <input className={inputClass} placeholder="ロット / SKU / 仕入先ロット" value={filters.q} onChange={set("q")} />
          <select className={inputClass} value={filters.status} onChange={set("status")}>
            <option value="">全ステータス</option><option value="available">利用可能</option>
            <option value="quarantine">隔離中</option><option value="scrapped">廃棄</option>
          </select>
          <select className={inputClass} value={filters.band} onChange={set("band")}>
            <option value="">全温度帯</option><option value="ambient">常温</option><option value="chilled">冷蔵</option><option value="frozen">冷凍</option>
          </select>
          <select className={inputClass} value={filters.expiringDays} onChange={set("expiringDays")}>
            <option value="">期限条件なし</option><option value="7">7日以内に期限</option><option value="30">30日以内に期限</option>
          </select>
        </div>
      </Card>
      {error && <Alert>{error}</Alert>}
      {!data ? <Loading /> : (
        <Card>
          <Table head={["ロット", "SKU", "期限", "残日数", "在庫/入荷", "ロケーション", "ステータス"]} empty={!data.lots.length}>
            {data.lots.map((l) => {
              const days = diffDays(l.expiry_date, data.today);
              const bandMismatch = l.locations?.temperature_band !== l.skus.temperature_band;
              return (
                <tr key={l.lot_id} className="hover:bg-slate-50">
                  <td className={td}><Link className="font-medium text-brand underline" href={`/inventory/${l.lot_id}`}>{l.lot_id}</Link>
                    <p className="text-xs text-slate-500">{l.supplier_lot}</p></td>
                  <td className={td}>{l.sku_id} {l.skus.name_ja}<p className="text-xs text-slate-500">{BAND_SHORT[l.skus.temperature_band]}</p></td>
                  <td className={td}>{formatDate(l.expiry_date)}<p className="text-xs text-slate-500">{EXPIRY_TYPE_LABEL[l.skus.expiry_type]}</p></td>
                  <td className={td}><Badge tone={days <= 3 ? "red" : days <= 7 ? "amber" : "gray"}>{days}日</Badge></td>
                  <td className={td}>{l.qty_available} / {l.qty_received}</td>
                  <td className={td}>{l.location_id}{bandMismatch && <p><Badge tone="red">温度帯不一致</Badge></p>}</td>
                  <td className={td}><Badge tone={l.status === "available" ? "green" : l.status === "quarantine" ? "red" : "gray"}>{LOT_STATUS_LABEL[l.status]}</Badge></td>
                </tr>
              );
            })}
          </Table>
        </Card>
      )}
    </>
  );
}
