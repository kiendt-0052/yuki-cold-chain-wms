"use client";
import Link from "next/link";
import { Card, Loading, PageHeader, Alert } from "@/components/ui";
import { formatDateTime } from "@/lib/client/format";
import { useApi } from "@/lib/client/use-api";

type Dashboard = {
  today: string;
  counts: Record<
    "openAlarms" | "overdueAlarms" | "quarantinedLots" | "ordersWaiting" | "expiringLots" | "unsetAgreements" | "openDeviations" | "draftRoutes",
    number
  >;
  recent: { id: number; actor: string; action: string; target: string; created_at: string }[];
};

const TILES: { key: keyof Dashboard["counts"]; label: string; href: string; danger?: boolean }[] = [
  { key: "openAlarms", label: "未確認アラーム", href: "/temperature", danger: true },
  { key: "overdueAlarms", label: "15分超過アラーム", href: "/temperature", danger: true },
  { key: "openDeviations", label: "未完了の逸脱ケース", href: "/temperature" },
  { key: "quarantinedLots", label: "隔離中ロット", href: "/inventory?status=quarantine" },
  { key: "ordersWaiting", label: "引当待ち受注", href: "/orders" },
  { key: "expiringLots", label: "7日以内に期限到来", href: "/inventory?expiringDays=7" },
  { key: "unsetAgreements", label: "配送ウィンドウ未設定の契約", href: "/masters" },
  { key: "draftRoutes", label: "未公開ルート", href: "/routes" },
];

export default function DashboardPage() {
  const { data, error } = useApi<Dashboard>("/api/dashboard");
  if (error) return <Alert>{error}</Alert>;
  if (!data) return <Loading />;
  return (
    <>
      <PageHeader title="ダッシュボード" subtitle={`本日 ${data.today}（JST）— 対応が必要な項目`} />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {TILES.map((t) => {
          const value = data.counts[t.key];
          const alert = t.danger && value > 0;
          return (
            <Link key={t.key} href={t.href}
              className={`rounded-lg border bg-white p-4 shadow-sm hover:shadow ${alert ? "border-red-300" : "border-slate-200"}`}>
              <p className="text-xs text-slate-600">{t.label}</p>
              <p className={`mt-1 text-3xl font-bold ${alert ? "text-red-600" : "text-brand-dark"}`}>{value}</p>
            </Link>
          );
        })}
      </div>
      <Card title="デモシナリオ（モックデータ）" className="mt-5">
        <ul className="list-disc space-y-1 pl-5 text-sm text-slate-700">
          <li><Link className="text-brand underline" href="/orders/ORD-1001">ORD-1001</Link> 日付逆転：同一顧客-SKUの直近受入済み期限より古いロットをブロック</li>
          <li><Link className="text-brand underline" href="/orders/ORD-1002">ORD-1002</Link> 3分の1ルール（契約に基づく商慣行）で納品期限切れのロットを除外</li>
          <li><Link className="text-brand underline" href="/orders/ORD-1003">ORD-1003</Link> 配送ウィンドウ未設定（AGR-008）→ 推定せず要確認</li>
          <li><Link className="text-brand underline" href="/orders/ORD-1004">ORD-1004</Link> 消費期限到来ロットは出荷不可（賞味期限は警告のみ）</li>
          <li><Link className="text-brand underline" href="/orders/ORD-1005">ORD-1005</Link> 温度帯不一致のロケーションにある冷凍品を除外</li>
          <li><Link className="text-brand underline" href="/temperature">温度・アラーム</Link> サンプルCSV取込 → アラーム・逸脱・自動隔離 → 品質管理が判定</li>
          <li><Link className="text-brand underline" href="/routes">配車・拘束時間</Link> 連続運転4時間超・拘束15時間超のルートは公開不可</li>
        </ul>
      </Card>
      <Card title="最近の操作（監査ログ）" className="mt-5">
        <ul className="divide-y divide-slate-100 text-sm">
          {data.recent.map((r) => (
            <li key={r.id} className="flex justify-between gap-3 py-1.5">
              <span>{r.actor}：{r.action} <span className="text-slate-500">{r.target}</span></span>
              <span className="text-xs text-slate-500">{formatDateTime(r.created_at)}</span>
            </li>
          ))}
        </ul>
      </Card>
    </>
  );
}
