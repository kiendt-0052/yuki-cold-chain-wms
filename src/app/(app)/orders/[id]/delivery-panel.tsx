"use client";
import { useState, type FormEvent } from "react";
import { Alert, Button, Card, Field, inputClass } from "@/components/ui";
import { useSession } from "@/components/session-context";
import { api, ApiError } from "@/lib/client/api-client";
import { TERM_LABEL } from "@/lib/domain/labels";
import { POD_FIELDS } from "@/lib/domain/pod-evidence";
import type { OrderDetailData } from "./order-types";

// POD entry (ドライバー端末想定). Required evidence switches with 車上渡し / 軒先渡し.
export function DeliveryPanel({ data, onDone }: { data: OrderDetailData; onDone: () => void }) {
  const { can } = useSession();
  const term = data.order.delivery_term;
  const [f, setF] = useState({
    recipient_name: "", signature_obtained: false, handoff_temp: "", seal_intact: false, photo_ref: "", unload_location: "", exception_code: "",
  });
  const [errors, setErrors] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const required = new Set(POD_FIELDS[term].map((x) => x.key));

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true); setErrors([]);
    try {
      await api.post(`/api/orders/${data.order.order_id}/deliver`, {
        ...f, handoff_temp: f.handoff_temp === "" ? null : Number(f.handoff_temp),
      });
      onDone();
    } catch (err) {
      const e2 = err as ApiError;
      setErrors((e2.details?.missing as string[]) ?? [e2.message]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card title={`配送完了（POD）— ${TERM_LABEL[term]}`} className="mb-5">
      <p className="mb-3 text-xs text-slate-600">
        {term === "on_truck"
          ? "車上渡し：車上で引き渡すため、引渡し時の貨物温度とシール未開封を記録します。"
          : "軒先渡し：店舗の軒先まで荷下ろしするため、荷下ろし写真と場所を記録します。"}
        必須証跡が揃わないと完了できません。
      </p>
      <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
        <Field label="受取人（氏名・立場）" required><input className={inputClass} value={f.recipient_name} onChange={(e) => setF({ ...f, recipient_name: e.target.value })} /></Field>
        <label className="flex items-center gap-2 pt-6 text-sm">
          <input type="checkbox" checked={f.signature_obtained} onChange={(e) => setF({ ...f, signature_obtained: e.target.checked })} /> 受領サインを取得した（必須）
        </label>
        {required.has("handoff_temp") && (
          <Field label="引渡し時の貨物温度（℃）" required><input type="number" step="0.1" className={inputClass} value={f.handoff_temp} onChange={(e) => setF({ ...f, handoff_temp: e.target.value })} /></Field>
        )}
        {required.has("seal_intact") && (
          <label className="flex items-center gap-2 pt-6 text-sm">
            <input type="checkbox" checked={f.seal_intact} onChange={(e) => setF({ ...f, seal_intact: e.target.checked })} /> シール未開封を確認した（必須）
          </label>
        )}
        {required.has("photo_ref") && (
          <Field label="荷下ろし写真（ファイル名・モック）" required><input className={inputClass} value={f.photo_ref} onChange={(e) => setF({ ...f, photo_ref: e.target.value })} placeholder="POD_0001.jpg" /></Field>
        )}
        {required.has("unload_location") && (
          <Field label="荷下ろし場所" required><input className={inputClass} value={f.unload_location} onChange={(e) => setF({ ...f, unload_location: e.target.value })} placeholder="バックヤード冷蔵庫前" /></Field>
        )}
        <Field label="例外コード（任意）"><input className={inputClass} value={f.exception_code} onChange={(e) => setF({ ...f, exception_code: e.target.value })} /></Field>
        <div className="sm:col-span-2 space-y-2">
          {errors.length > 0 && <Alert title="配送完了できません"><ul className="list-disc pl-5">{errors.map((x) => <li key={x}>{x}</li>)}</ul></Alert>}
          <Button type="submit" disabled={busy || !can("order:deliver")}>配送完了を登録</Button>
          <p className="text-xs text-slate-500">オフライン時の8時間暗号化キューはモック（本プロトタイプはオンライン前提）。</p>
        </div>
      </form>
    </Card>
  );
}
