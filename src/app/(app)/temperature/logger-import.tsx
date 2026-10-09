"use client";
import { useState } from "react";
import { Alert, Button } from "@/components/ui";
import { useSession } from "@/components/session-context";
import { api } from "@/lib/client/api-client";

type ImportResult = {
  duplicate: boolean;
  import: { rows_ok: number; rows_error: number; file_name: string };
  errors?: { line: number; message: string }[];
  alarms?: { id: number; device_id: string; peak_c: number; quarantined: string[] }[];
};

export function LoggerImport({ onDone }: { onDone: () => void }) {
  const { can } = useSession();
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function upload() {
    if (!file) return;
    setBusy(true); setError(null); setResult(null);
    try {
      const content = await file.text();
      setResult(await api.post<ImportResult>("/api/temperature/import", { file_name: file.name, content }));
      onDone();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3 text-sm">
      <p className="text-slate-600">
        形式：<code>device_id,event_time,value_c</code>（タイムゾーン付きISO 8601）。
        <a className="ml-1 text-brand underline" href="/samples/logger-DL-F01-sample.csv" download>サンプルCSV（冷凍帯の逸脱・エラー行を含む）</a>
      </p>
      <input type="file" accept=".csv,text/csv" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="block text-sm" />
      <Button onClick={upload} disabled={!file || busy || !can("temperature:import")}>
        {can("temperature:import") ? (busy ? "取込中…" : "取込・評価") : "取込（品質管理・管理者のみ）"}
      </Button>
      {error && <Alert>{error}</Alert>}
      {result?.duplicate && <Alert tone="amber">同一内容のファイルは取込済みです（重複取込しません）。</Alert>}
      {result && !result.duplicate && (
        <Alert tone={result.alarms?.length ? "red" : "green"} title={`取込完了：正常 ${result.import.rows_ok} 件 / エラー ${result.import.rows_error} 件`}>
          {result.errors?.map((e) => <p key={e.line}>行 {e.line}：{e.message}</p>)}
          {result.alarms?.map((a) => (
            <p key={a.id} className="mt-1 font-medium">アラーム #{a.id}（{a.device_id} 最大 {a.peak_c}℃）→ 自動隔離 {a.quarantined.length} ロット：{a.quarantined.join(", ") || "なし"}</p>
          ))}
        </Alert>
      )}
    </div>
  );
}
