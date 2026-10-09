"use client";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { Alert, Button, Card, Field, inputClass } from "@/components/ui";
import { useSession } from "@/components/session-context";
import { api, ApiError } from "@/lib/client/api-client";
import { formatDateTime } from "@/lib/client/format";
import { BAND_LABEL } from "@/lib/domain/labels";
import type { OrderDetailData } from "./order-types";

export function ShipmentPanel({ data, onDone }: { data: OrderDetailData; onDone: () => void }) {
  const { can } = useSession();
  const [f, setF] = useState({ vehicle_temp: "", cargo_temp: "", seal_no: "" });
  const [cancelReason, setCancelReason] = useState("");
  const [msg, setMsg] = useState<{ tone: "red" | "amber"; text: string; deviation?: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const id = data.order.order_id;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true); setMsg(null);
    try {
      await api.post(`/api/orders/${id}/shipment-check`, {
        vehicle_temp: f.vehicle_temp === "" ? undefined : Number(f.vehicle_temp),
        cargo_temp: f.cargo_temp === "" ? undefined : Number(f.cargo_temp), seal_no: f.seal_no,
      });
      onDone();
    } catch (err) {
      const e2 = err as ApiError;
      const deviation = e2.details?.deviation_id as number | undefined;
      setMsg(deviation
        ? { tone: "red", text: `出荷前チェック不合格：${e2.details?.reason}。逸脱ケースを作成しました。`, deviation }
        : { tone: "red", text: e2.message });
      onDone();
    } finally {
      setBusy(false);
    }
  }

  async function cancel() {
    setBusy(true);
    try {
      await api.post(`/api/orders/${id}/cancel`, { reason: cancelReason });
      onDone();
    } catch (err) {
      setMsg({ tone: "red", text: (err as Error).message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card title="出荷前チェック（積込検品）" className="mb-5">
      <p className="mb-3 text-xs text-slate-600">基準：{BAND_LABEL[data.sku.temperature_band]}。基準外の値は逸脱を作成し、出荷確定をブロックします。</p>
      <form onSubmit={submit} className="grid gap-3 sm:grid-cols-3">
        <Field label="車両庫内温度（℃）" required><input type="number" step="0.1" className={inputClass} value={f.vehicle_temp} onChange={(e) => setF({ ...f, vehicle_temp: e.target.value })} /></Field>
        <Field label="貨物温度（℃）" required><input type="number" step="0.1" className={inputClass} value={f.cargo_temp} onChange={(e) => setF({ ...f, cargo_temp: e.target.value })} /></Field>
        <Field label="シール番号" required><input className={inputClass} value={f.seal_no} onChange={(e) => setF({ ...f, seal_no: e.target.value })} /></Field>
        <div className="sm:col-span-3">
          <Button type="submit" disabled={busy || !can("order:ship")}>出荷確定</Button>
        </div>
      </form>
      {msg && (
        <div className="mt-3"><Alert tone={msg.tone}>{msg.text}
          {msg.deviation && <> <Link className="underline" href={`/temperature/deviations/${msg.deviation}`}>逸脱ケース #{msg.deviation}</Link></>}
        </Alert></div>
      )}
      {data.shipmentChecks.length > 0 && (
        <div className="mt-3 text-xs text-slate-600">
          {data.shipmentChecks.map((c) => (
            <p key={c.id}>{formatDateTime(c.checked_at)} {c.result === "passed" ? "合格" : `不合格（${c.reason}）`} 車両 {c.vehicle_temp}℃ / 貨物 {c.cargo_temp}℃ / シール {c.seal_no}</p>
          ))}
        </div>
      )}
      {can("order:allocate") && (
        <div className="mt-5 flex flex-wrap items-end gap-2 border-t border-slate-100 pt-4">
          <Field label="引当取消の理由"><input className={inputClass} value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} /></Field>
          <Button variant="secondary" onClick={cancel} disabled={busy || !cancelReason.trim()}>引当を取り消す</Button>
        </div>
      )}
    </Card>
  );
}
