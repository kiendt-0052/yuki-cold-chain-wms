"use client";
import { useState } from "react";
import { Alert, Badge, Button, Card, Field, inputClass, Table, td } from "@/components/ui";
import { useSession } from "@/components/session-context";
import { api, ApiError } from "@/lib/client/api-client";
import { formatDate } from "@/lib/client/format";
import { CHECK_LABEL, type LotEvaluation } from "@/lib/domain/allocation-rules";
import { BAND_SHORT } from "@/lib/domain/labels";
import { DateReversalDialog } from "./date-reversal-dialog";
import type { OrderDetailData } from "./order-types";

const VERDICT = {
  eligible: { tone: "green", label: "引当可" },
  excluded: { tone: "red", label: "除外" },
  review: { tone: "amber", label: "要確認" },
} as const;

export function AllocationPanel({ data, onDone }: { data: OrderDetailData; onDone: () => void }) {
  const { can } = useSession();
  const evaluation = data.evaluation!;
  const [selected, setSelected] = useState(evaluation.recommendedLotId ?? "");
  const [overrideReason, setOverrideReason] = useState("");
  const [warnings, setWarnings] = useState<string[] | null>(null);
  const [reversal, setReversal] = useState<LotEvaluation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const lot = evaluation.lots.find((l) => l.lot_id === selected);

  async function allocate(acknowledge = false) {
    if (!lot) return;
    // The lab's key scenario: warn BEFORE shipping a lot older than the customer's last accepted one.
    if (lot.failedCode === "DATE_REVERSAL") return setReversal(lot);
    setBusy(true); setError(null);
    try {
      await api.post(`/api/orders/${data.order.order_id}/allocate`, {
        lot_id: lot.lot_id, override_reason: overrideReason, acknowledge_warnings: acknowledge,
      });
      onDone();
    } catch (e) {
      const err = e as ApiError;
      if (err.details?.code === "WARNINGS") setWarnings(err.details.warnings as string[]);
      else setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card title="引当（FEFO・除外ルール自動判定）" className="mb-5">
      <p className="mb-3 text-xs text-slate-600">
        判定順：消費期限 → 温度帯 → 隔離 → 納品期限（契約ルール）→ 日付逆転 → 数量、その後 期限が早い順（同一期限は入荷順）。
      </p>
      {evaluation.ruleUnset && (
        <Alert tone="amber" title="配送ウィンドウルール未設定">この顧客-SKUの契約ルールは未合意です。3分の1・2分の1を推定せず、確認理由を記録した場合のみ引当できます。</Alert>
      )}
      <Table head={["", "ロット", "期限", "納品期限", "保管", "在庫", "判定", "チェック内容"]} empty={!evaluation.lots.length}>
        {evaluation.lots.map((l) => (
          <tr key={l.lot_id} className={selected === l.lot_id ? "bg-brand-soft" : ""}>
            <td className={td}><input type="radio" name="lot" checked={selected === l.lot_id} onChange={() => { setSelected(l.lot_id); setWarnings(null); setError(null); }} /></td>
            <td className={td}>{l.lot_id}{l.lot_id === evaluation.recommendedLotId && <p><Badge tone="teal">FEFO推奨</Badge></p>}</td>
            <td className={td}>{formatDate(l.expiry_date)}</td>
            <td className={td}>{l.deadline ? formatDate(l.deadline) : "—"}</td>
            <td className={td}>{BAND_SHORT[l.location_band]}</td>
            <td className={td}>{l.qty_available}</td>
            <td className={td}>
              <Badge tone={VERDICT[l.verdict].tone}>{VERDICT[l.verdict].label}</Badge>
              {l.failedCode && <p className="mt-1 text-xs font-medium text-red-700">{CHECK_LABEL[l.failedCode]}</p>}
            </td>
            <td className={`${td} text-xs`}>
              {l.checks.map((c) => (
                <p key={c.code} className={c.ok ? "text-slate-500" : c.severity === "warn" ? "text-amber-700" : "text-red-700"}>
                  {c.ok ? "✓" : "✕"} {CHECK_LABEL[c.code]}：{c.message}
                </p>
              ))}
            </td>
          </tr>
        ))}
      </Table>
      <div className="mt-4 space-y-3">
        {lot?.verdict === "review" && (
          <Field label="確認理由（未設定ルールでの引当）" required>
            <input className={inputClass} value={overrideReason} onChange={(e) => setOverrideReason(e.target.value)} placeholder="顧客担当者に電話確認済み 等" />
          </Field>
        )}
        {warnings && (
          <Alert tone="amber" title="警告があります">
            <ul className="list-disc pl-5">{warnings.map((w) => <li key={w}>{w}</li>)}</ul>
            <Button className="mt-2" onClick={() => allocate(true)} disabled={busy}>内容を確認して引当する</Button>
          </Alert>
        )}
        {error && <Alert>{error}</Alert>}
        <Button onClick={() => allocate()} disabled={busy || !lot || !can("order:allocate")}>
          {can("order:allocate") ? `選択ロット ${selected || ""} で引当` : "引当（配送計画者・管理者のみ）"}
        </Button>
      </div>
      {reversal && (
        <DateReversalDialog lot={reversal} lastAccepted={data.lastAccepted!} customer={data.customer} sku={data.sku}
          recommended={evaluation.recommendedLotId} onClose={() => setReversal(null)}
          onPickRecommended={() => { setSelected(evaluation.recommendedLotId ?? ""); setReversal(null); }} />
      )}
    </Card>
  );
}
