"use client";
import { useState } from "react";
import { Alert, Badge, Button, Card, inputClass, Table, td } from "@/components/ui";
import { useSession } from "@/components/session-context";
import { api } from "@/lib/client/api-client";
import { formatDateTime } from "@/lib/client/format";
import { TERM_LABEL, windowRuleLabel, type DeliveryTerm } from "@/lib/domain/labels";

export type Agreement = {
  agreement_id: string; customer_id: string; sku_id: string; delivery_term: DeliveryTerm; delivery_window_rule: string | null;
  updated_by: string | null; updated_at: string | null; customers: { name: string }; skus: { name_ja: string };
};

export function AgreementTable({ agreements, onDone }: { agreements: Agreement[]; onDone: () => void }) {
  const { can } = useSession();
  const [editing, setEditing] = useState<string | null>(null);
  const [rule, setRule] = useState("");
  const [reason, setReason] = useState("");
  const [msg, setMsg] = useState<{ tone: "red" | "green"; text: string } | null>(null);

  async function save(id: string) {
    setMsg(null);
    try {
      await api.patch(`/api/masters/agreements/${id}`, { delivery_window_rule: rule || null, reason });
      setMsg({ tone: "green", text: `${id} の配送ウィンドウルールを更新しました（監査ログに記録）` });
      setEditing(null); setReason(""); onDone();
    } catch (e) {
      setMsg({ tone: "red", text: (e as Error).message });
    }
  }

  return (
    <Card>
      <p className="mb-3 text-xs text-slate-600">
        3分の1・2分の1ルールは契約に基づく商慣行であり法令ではありません。未設定（AGR-008・AGR-014）は顧客と未合意の状態で、システムは既定値を推定しません。
      </p>
      {msg && <div className="mb-3"><Alert tone={msg.tone}>{msg.text}</Alert></div>}
      <Table head={["契約", "顧客", "SKU", "配送条件", "配送ウィンドウ", "最終更新", ""]}>
        {agreements.map((a) => (
          <tr key={a.agreement_id}>
            <td className={td}>{a.agreement_id}</td>
            <td className={td}>{a.customer_id}<p className="text-xs text-slate-500">{a.customers.name}</p></td>
            <td className={td}>{a.sku_id}<p className="text-xs text-slate-500">{a.skus.name_ja}</p></td>
            <td className={td}>{TERM_LABEL[a.delivery_term]}</td>
            <td className={td}>
              {editing === a.agreement_id ? (
                <div className="space-y-1">
                  <select className={inputClass} value={rule} onChange={(e) => setRule(e.target.value)}>
                    <option value="">未設定</option><option value="ONE_THIRD">3分の1ルール</option>
                    <option value="ONE_HALF">2分の1ルール</option><option value="LABEL_DATE_ONLY">期限ラベルのみ</option>
                  </select>
                  <input className={inputClass} placeholder="変更理由（顧客との合意内容）" value={reason} onChange={(e) => setReason(e.target.value)} />
                </div>
              ) : a.delivery_window_rule ? windowRuleLabel(a.delivery_window_rule) : <Badge tone="amber">未設定</Badge>}
            </td>
            <td className={`${td} text-xs text-slate-500`}>{a.updated_at ? `${formatDateTime(a.updated_at)} ${a.updated_by}` : "—"}</td>
            <td className={td}>
              {can("master:edit") && (editing === a.agreement_id
                ? <div className="flex gap-1"><Button onClick={() => save(a.agreement_id)} disabled={!reason.trim()}>保存</Button>
                    <Button variant="secondary" onClick={() => setEditing(null)}>取消</Button></div>
                : <Button variant="secondary" onClick={() => { setEditing(a.agreement_id); setRule(a.delivery_window_rule ?? ""); }}>変更</Button>)}
            </td>
          </tr>
        ))}
      </Table>
    </Card>
  );
}
