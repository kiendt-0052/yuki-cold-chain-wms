"use client";
import { useState } from "react";
import { Alert, Badge, Card, Loading, PageHeader, Table, td } from "@/components/ui";
import { useApi } from "@/lib/client/use-api";
import { BAND_SHORT, EXPIRY_TYPE_LABEL, TRACE_LANE_LABEL, type ExpiryType, type TemperatureBand } from "@/lib/domain/labels";
import { AgreementTable, type Agreement } from "./agreement-table";

type Masters = {
  skus: { sku_id: string; name_ja: string; unit: string; temperature_band: TemperatureBand; expiry_type: ExpiryType; trace_lane: string; regulated_identifier: string | null }[];
  suppliers: { supplier_id: string; name: string }[];
  customers: { customer_id: string; name: string }[];
  locations: { location_id: string; zone: string; temperature_band: TemperatureBand; is_quarantine: boolean; capacity: number }[];
  devices: { device_id: string; zone: string; temperature_band: TemperatureBand }[];
  agreements: Agreement[];
};
const TABS = ["顧客-SKU契約", "SKU", "仕入先・顧客", "ロケーション・機器"] as const;

export default function MastersPage() {
  const { data, error, reload } = useApi<Masters>("/api/masters");
  const [tab, setTab] = useState<(typeof TABS)[number]>("顧客-SKU契約");
  if (error) return <Alert>{error}</Alert>;
  if (!data) return <Loading />;
  return (
    <>
      <PageHeader title="マスター" subtitle="SKU（R-02）・顧客別配送ルール（R-04）はRFPのフィクスチャに準拠したデモデータです。" />
      <div className="mb-4 flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`rounded-full px-3 py-1 text-sm ${tab === t ? "bg-brand text-white" : "bg-white text-slate-700 border border-slate-300"}`}>{t}</button>
        ))}
      </div>
      {tab === "顧客-SKU契約" && <AgreementTable agreements={data.agreements} onDone={reload} />}
      {tab === "SKU" && (
        <Card>
          <Table head={["SKU", "名称", "単位", "温度帯", "期限種別", "トレーサビリティ", "法定識別子"]}>
            {data.skus.map((s) => (
              <tr key={s.sku_id}>
                <td className={td}>{s.sku_id}</td><td className={td}>{s.name_ja}</td><td className={td}>{s.unit}</td>
                <td className={td}>{BAND_SHORT[s.temperature_band]}</td>
                <td className={td}><Badge tone={s.expiry_type === "use_by" ? "red" : "blue"}>{EXPIRY_TYPE_LABEL[s.expiry_type]}</Badge></td>
                <td className={td}>{TRACE_LANE_LABEL[s.trace_lane]}</td><td className={td}>{s.regulated_identifier ?? "—"}</td>
              </tr>
            ))}
          </Table>
          <p className="mt-3 text-xs text-slate-600">賞味期限＝品質の期限（超過は警告）／消費期限＝安全の期限（到来・超過は出荷停止）。</p>
        </Card>
      )}
      {tab === "仕入先・顧客" && (
        <div className="grid gap-5 lg:grid-cols-2">
          <Card title="仕入先"><Table head={["ID", "名称"]}>{data.suppliers.map((s) => <tr key={s.supplier_id}><td className={td}>{s.supplier_id}</td><td className={td}>{s.name}</td></tr>)}</Table></Card>
          <Card title="顧客"><Table head={["ID", "名称"]}>{data.customers.map((c) => <tr key={c.customer_id}><td className={td}>{c.customer_id}</td><td className={td}>{c.name}</td></tr>)}</Table></Card>
        </div>
      )}
      {tab === "ロケーション・機器" && (
        <div className="grid gap-5 lg:grid-cols-2">
          <Card title="ロケーション">
            <Table head={["ロケーション", "ゾーン", "温度帯", "区分"]}>
              {data.locations.map((l) => (
                <tr key={l.location_id}><td className={td}>{l.location_id}</td><td className={td}>{l.zone}</td><td className={td}>{BAND_SHORT[l.temperature_band]}</td>
                  <td className={td}>{l.is_quarantine ? <Badge tone="red">隔離エリア</Badge> : "通常"}</td></tr>
              ))}
            </Table>
            <p className="mt-3 text-xs text-slate-600">常温帯には専用の隔離ロケーション（-Q）がありません（RFP R-01 のまま。Q21で確認中）。</p>
          </Card>
          <Card title="温度ロガー">
            <Table head={["機器", "ゾーン", "温度帯"]}>
              {data.devices.map((d) => <tr key={d.device_id}><td className={td}>{d.device_id}</td><td className={td}>{d.zone}</td><td className={td}>{BAND_SHORT[d.temperature_band]}</td></tr>)}
            </Table>
          </Card>
        </div>
      )}
    </>
  );
}
