"use client";
import Link from "next/link";
import { Alert, Badge, Card, Loading, PageHeader, Table, td } from "@/components/ui";
import { formatDateTime } from "@/lib/client/format";
import { useApi } from "@/lib/client/use-api";
import { AlarmQueue, type Alarm } from "./alarm-queue";
import { LoggerImport } from "./logger-import";

type TemperatureData = {
  alarms: Alarm[];
  imports: { id: number; file_name: string; rows_total: number; rows_ok: number; rows_error: number; imported_by: string; imported_at: string }[];
  deviations: { id: number; source: string; zone: string | null; description: string; status: string; affected_lots: string[]; created_at: string }[];
  readings: { device_id: string; event_time: string; value_c: number; evaluation: string }[];
  now: string;
};

const SOURCE: Record<string, string> = { alarm: "温度アラーム", inbound: "入荷検品", shipment: "出荷前チェック", movement: "在庫移動" };

export default function TemperaturePage() {
  const { data, error, reload } = useApi<TemperatureData>("/api/temperature");
  if (error) return <Alert>{error}</Alert>;
  if (!data) return <Loading />;
  return (
    <>
      <PageHeader title="温度監視・逸脱・HACCP" subtitle="ロガーCSV取込 → 基準外を評価 → アラーム（15分以内に確認）→ 逸脱ケースで品質管理が判定。閾値はユキ物流の社内ポリシーです。" />
      <div className="grid gap-5 xl:grid-cols-2">
        <Card title="アラームキュー"><AlarmQueue alarms={data.alarms} now={data.now} onDone={reload} /></Card>
        <Card title="ロガーCSV取込"><LoggerImport onDone={reload} /></Card>
      </div>
      <Card title="逸脱ケース" className="mt-5">
        <Table head={["#", "発生元", "内容", "対象ロット", "状態", "作成"]} empty={!data.deviations.length}>
          {data.deviations.map((d) => (
            <tr key={d.id}>
              <td className={td}><Link className="text-brand underline" href={`/temperature/deviations/${d.id}`}>#{d.id}</Link></td>
              <td className={td}>{SOURCE[d.source]}</td>
              <td className={td}>{d.description}</td>
              <td className={`${td} text-xs`}>{d.affected_lots.join(", ") || "—"}</td>
              <td className={td}>{d.status === "open" ? <Badge tone="red">対応中</Badge> : <Badge tone="green">完了</Badge>}</td>
              <td className={td}>{formatDateTime(d.created_at)}</td>
            </tr>
          ))}
        </Table>
      </Card>
      <div className="mt-5 grid gap-5 xl:grid-cols-2">
        <Card title="取込履歴（同一ファイルは重複取込されません）">
          <Table head={["日時", "ファイル", "正常/エラー", "実施者"]} empty={!data.imports.length}>
            {data.imports.map((i) => (
              <tr key={i.id}><td className={td}>{formatDateTime(i.imported_at)}</td><td className={td}>{i.file_name}</td>
                <td className={td}>{i.rows_ok} / {i.rows_error}</td><td className={td}>{i.imported_by}</td></tr>
            ))}
          </Table>
        </Card>
        <Card title="最新の温度記録">
          <Table head={["日時", "機器", "温度", "評価"]} empty={!data.readings.length}>
            {data.readings.slice(0, 15).map((r, i) => (
              <tr key={i}><td className={td}>{formatDateTime(r.event_time)}</td><td className={td}>{r.device_id}</td><td className={td}>{r.value_c}℃</td>
                <td className={td}>{r.evaluation === "ok" ? <Badge tone="green">基準内</Badge> : <Badge tone="red">基準外</Badge>}</td></tr>
            ))}
          </Table>
        </Card>
      </div>
    </>
  );
}
