"use client";
import { useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { Alert, Button, Field, inputClass } from "@/components/ui";
import { useSession } from "@/components/session-context";
import { api, ApiError } from "@/lib/client/api-client";
import { BAND_SHORT, EXPIRY_TYPE_LABEL, type ExpiryType, type TemperatureBand } from "@/lib/domain/labels";

export type InboundOptions = {
  suppliers: { supplier_id: string; name: string }[];
  skus: { sku_id: string; name_ja: string; temperature_band: TemperatureBand; expiry_type: ExpiryType; trace_lane: string }[];
  locations: { location_id: string; temperature_band: TemperatureBand }[];
};

const EMPTY = {
  supplier_id: "", sku_id: "", supplier_lot: "", qty_reported: "", qty_accepted: "", qty_rejected: "0", variance_reason: "",
  expiry_type: "", production_date: "", expiry_date: "", measured_temp: "", packaging_ok: "", photo_ref: "",
  location_id: "", rice_origin: "", beef_individual_id: "",
};

export function InboundForm({ options, onDone }: { options: InboundOptions; onDone: () => void }) {
  const { can } = useSession();
  const [f, setF] = useState(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<{ tone: "red" | "green" | "amber"; text: string; lot?: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const sku = options.skus.find((s) => s.sku_id === f.sku_id);
  const locations = useMemo(() => options.locations.filter((l) => !sku || l.temperature_band === sku.temperature_band), [options, sku]);
  const set = (k: keyof typeof EMPTY) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true); setErrors({}); setMessage(null);
    try {
      const res = await api.post<{ lot_id: string; result: string; reasons: string[] }>("/api/inbound", {
        ...f, request_id: crypto.randomUUID(),
        qty_reported: Number(f.qty_reported), qty_accepted: Number(f.qty_accepted), qty_rejected: Number(f.qty_rejected || 0),
        measured_temp: f.measured_temp === "" ? null : Number(f.measured_temp),
        packaging_ok: f.packaging_ok === "" ? null : f.packaging_ok === "ok",
      });
      setMessage(res.result === "accepted"
        ? { tone: "green", text: `入荷確定：ロット ${res.lot_id} を作成しました`, lot: res.lot_id }
        : { tone: "amber", text: `ロット ${res.lot_id} を作成し隔離しました（${res.reasons.join("、")}）。品質管理が判定します`, lot: res.lot_id });
      setF(EMPTY);
      onDone();
    } catch (err) {
      const list = ((err as ApiError).details?.errors ?? []) as { field: string; message: string }[];
      setErrors(Object.fromEntries(list.map((x) => [x.field, x.message])));
      setMessage({ tone: "red", text: (err as Error).message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
      <Field label="仕入先" required error={errors.supplier_id}>
        <select className={inputClass} value={f.supplier_id} onChange={set("supplier_id")}>
          <option value="">選択</option>
          {options.suppliers.map((s) => <option key={s.supplier_id} value={s.supplier_id}>{s.supplier_id} {s.name}</option>)}
        </select>
      </Field>
      <Field label="SKU" required error={errors.sku_id}
        hint={sku ? `${BAND_SHORT[sku.temperature_band]}・マスタの期限種別：${EXPIRY_TYPE_LABEL[sku.expiry_type]}` : undefined}>
        <select className={inputClass} value={f.sku_id} onChange={(e) => setF({ ...f, sku_id: e.target.value, location_id: "" })}>
          <option value="">選択</option>
          {options.skus.map((s) => <option key={s.sku_id} value={s.sku_id}>{s.sku_id} {s.name_ja}</option>)}
        </select>
      </Field>
      <Field label="仕入先ロット" required error={errors.supplier_lot}><input className={inputClass} value={f.supplier_lot} onChange={set("supplier_lot")} /></Field>
      <Field label="期限種別（ラベルを確認）" required error={errors.expiry_type}>
        <select className={inputClass} value={f.expiry_type} onChange={set("expiry_type")}>
          <option value="">選択</option>
          <option value="best_before">賞味期限（品質の期限）</option>
          <option value="use_by">消費期限（安全の期限）</option>
        </select>
      </Field>
      <Field label="製造日" required error={errors.production_date}><input type="date" className={inputClass} value={f.production_date} onChange={set("production_date")} /></Field>
      <Field label="期限日" required error={errors.expiry_date}><input type="date" className={inputClass} value={f.expiry_date} onChange={set("expiry_date")} /></Field>
      <Field label="伝票数量" required error={errors.qty_reported}><input type="number" min="0" className={inputClass} value={f.qty_reported} onChange={set("qty_reported")} /></Field>
      <Field label="受入数量" required error={errors.qty_accepted}><input type="number" min="0" className={inputClass} value={f.qty_accepted} onChange={set("qty_accepted")} /></Field>
      <Field label="拒否数量" error={errors.qty_rejected}><input type="number" min="0" className={inputClass} value={f.qty_rejected} onChange={set("qty_rejected")} /></Field>
      <Field label="差異理由" error={errors.variance_reason} hint="受入＋拒否が伝票数量と異なる場合に必須"><input className={inputClass} value={f.variance_reason} onChange={set("variance_reason")} /></Field>
      <Field label="実測温度（℃）" required error={errors.measured_temp}><input type="number" step="0.1" className={inputClass} value={f.measured_temp} onChange={set("measured_temp")} /></Field>
      <Field label="梱包状態" required error={errors.packaging_ok}>
        <select className={inputClass} value={f.packaging_ok} onChange={set("packaging_ok")}>
          <option value="">選択</option><option value="ok">異常なし</option><option value="ng">破損・汚損あり</option>
        </select>
      </Field>
      <Field label="写真（ファイル名・モック）" required error={errors.photo_ref} hint="実画像の保存はモック。ファイル名のみ記録">
        <input className={inputClass} value={f.photo_ref} onChange={set("photo_ref")} placeholder="IMG_0001.jpg" />
      </Field>
      <Field label="格納ロケーション" required error={errors.location_id} hint="SKUの温度帯に一致する場所のみ表示">
        <select className={inputClass} value={f.location_id} onChange={set("location_id")}>
          <option value="">選択</option>
          {locations.map((l) => <option key={l.location_id} value={l.location_id}>{l.location_id}（{BAND_SHORT[l.temperature_band]}）</option>)}
        </select>
      </Field>
      {sku?.trace_lane === "rice" && (
        <Field label="米の産地（米トレーサビリティ法）" required error={errors.rice_origin}><input className={inputClass} value={f.rice_origin} onChange={set("rice_origin")} /></Field>
      )}
      {sku?.trace_lane === "beef" && (
        <Field label="牛個体識別番号（10桁）" required error={errors.beef_individual_id}>
          <input className={inputClass} inputMode="numeric" value={f.beef_individual_id} onChange={set("beef_individual_id")} />
        </Field>
      )}
      <div className="sm:col-span-2 space-y-3">
        {message && (
          <Alert tone={message.tone}>
            {message.text} {message.lot && <Link className="underline" href={`/inventory/${message.lot}`}>ロット詳細へ</Link>}
          </Alert>
        )}
        <Button type="submit" disabled={busy || !can("inbound:write")} className="w-full py-3 text-base">
          {can("inbound:write") ? (busy ? "登録中…" : "入荷確定") : "入荷確定（権限なし）"}
        </Button>
      </div>
    </form>
  );
}
