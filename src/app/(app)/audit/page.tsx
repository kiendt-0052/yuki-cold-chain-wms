"use client";
import { Alert, Card, Loading, PageHeader, Table, td } from "@/components/ui";
import { formatDateTime } from "@/lib/client/format";
import { useApi } from "@/lib/client/use-api";

type Audit = {
  logs: { id: number; actor: string; action: string; target: string | null; detail: Record<string, unknown>; created_at: string }[];
  events: { id: number; lot_id: string; event_type: string; actor: string; detail: Record<string, unknown>; created_at: string }[];
};

export default function AuditPage() {
  const { data, error } = useApi<Audit>("/api/audit");
  if (error) return <Alert>{error}</Alert>;
  if (!data) return <Loading />;
  return (
    <>
      <PageHeader title="監査ログ（参照のみ）" subtitle="ログイン・引当・判定・マスター変更などを追記専用で記録。アプリから編集・削除はできません。" />
      <div className="grid gap-5 xl:grid-cols-2">
        <Card title="操作ログ">
          <Table head={["日時", "実施者", "操作", "対象", "内容"]} empty={!data.logs.length}>
            {data.logs.map((l) => (
              <tr key={l.id}><td className={td}>{formatDateTime(l.created_at)}</td><td className={td}>{l.actor}</td><td className={td}>{l.action}</td>
                <td className={td}>{l.target}</td><td className={`${td} max-w-xs break-all text-xs text-slate-500`}>{JSON.stringify(l.detail)}</td></tr>
            ))}
          </Table>
        </Card>
        <Card title="ロットイベント（不変）">
          <Table head={["日時", "ロット", "イベント", "実施者"]} empty={!data.events.length}>
            {data.events.map((e) => (
              <tr key={e.id}><td className={td}>{formatDateTime(e.created_at)}</td><td className={td}>{e.lot_id}</td><td className={td}>{e.event_type}</td><td className={td}>{e.actor}</td></tr>
            ))}
          </Table>
        </Card>
      </div>
    </>
  );
}
