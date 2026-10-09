"use client";
import Link from "next/link";
import { Alert, Badge, Card, Loading, PageHeader, Table, td } from "@/components/ui";
import { formatDate, formatDateTime } from "@/lib/client/format";
import { useApi } from "@/lib/client/use-api";
import { formatMinutes, type BindingTimeResult } from "@/lib/domain/binding-time-check";

type Route = {
  route_id: string; route_date: string; driver_name: string; vehicle: string; start_time: string; status: string; version: number;
  rule_version: string | null; check: BindingTimeResult;
};

export default function RoutesPage() {
  const { data, error } = useApi<{ routes: Route[] }>("/api/routes");
  if (error) return <Alert>{error}</Alert>;
  if (!data) return <Loading />;
  return (
    <>
      <PageHeader title="配車・拘束時間チェック（簡易版）"
        subtitle="拘束時間（運転・荷役・休憩・待機を含む）と運転時間を区別して判定。違反のあるルートは公開できません。" />
      <Alert tone="blue">
        簡易版：1日単位の判定（拘束13h/15h、運転9h、連続運転4h、休息9h/11h）。年3,300h・月284h・時間外960h・2日/2週平均は対象外（README参照）。
      </Alert>
      <Card className="mt-4">
        <Table head={["ルート", "運行日", "ドライバー / 車両", "始業", "拘束", "運転", "最大連続運転", "判定", "状態"]} empty={!data.routes.length}>
          {data.routes.map((r) => {
            const violations = r.check.findings.filter((f) => f.level === "violation");
            const warnings = r.check.findings.filter((f) => f.level === "warning");
            return (
              <tr key={r.route_id}>
                <td className={td}><Link className="font-medium text-brand underline" href={`/routes/${r.route_id}`}>{r.route_id}</Link></td>
                <td className={td}>{formatDate(r.route_date)}</td>
                <td className={td}>{r.driver_name}<p className="text-xs text-slate-500">{r.vehicle}</p></td>
                <td className={td}>{formatDateTime(r.start_time)}</td>
                <td className={td}>{formatMinutes(r.check.bindingMinutes)}</td>
                <td className={td}>{formatMinutes(r.check.drivingMinutes)}</td>
                <td className={td}>{formatMinutes(r.check.maxContinuousDriving)}</td>
                <td className={td}>
                  {violations.length ? <Badge tone="red">違反 {violations.length}</Badge> : warnings.length ? <Badge tone="amber">警告 {warnings.length}</Badge> : <Badge tone="green">OK</Badge>}
                </td>
                <td className={td}>{r.status === "published" ? <Badge tone="teal">公開済 v{r.version}</Badge> : <Badge>下書き v{r.version}</Badge>}</td>
              </tr>
            );
          })}
        </Table>
      </Card>
    </>
  );
}
