"use client";
import { useState } from "react";
import { Alert, Button, Field, inputClass } from "@/components/ui";
import { useSession } from "@/components/session-context";
import { api } from "@/lib/client/api-client";

const OPTIONS: Record<string, { to: string; label: string; variant: "primary" | "danger" | "secondary" }[]> = {
  available: [{ to: "quarantine", label: "隔離する", variant: "danger" }],
  quarantine: [
    { to: "available", label: "隔離解除（再判定OK）", variant: "primary" },
    { to: "scrapped", label: "廃棄（安全NG）", variant: "danger" },
  ],
  scrapped: [],
};

export function QualityStatusForm({ lotId, status, onDone }: { lotId: string; status: string; onDone: () => void }) {
  const { can } = useSession();
  const [reason, setReason] = useState("");
  const [msg, setMsg] = useState<{ tone: "red" | "green"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function change(to: string) {
    setBusy(true); setMsg(null);
    try {
      await api.post(`/api/lots/${encodeURIComponent(lotId)}/status`, { to, reason });
      setMsg({ tone: "green", text: "ステータスを更新しました" });
      setReason("");
      onDone();
    } catch (e) {
      setMsg({ tone: "red", text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }

  if (!can("lot:quality")) return <p className="text-sm text-slate-500">品質管理・管理者のみ操作できます（システムは品質を自動判定しません）。</p>;
  if (!OPTIONS[status]?.length) return <p className="text-sm text-slate-500">廃棄済みのロットは変更できません。</p>;
  return (
    <div className="space-y-3">
      <p className="text-xs text-slate-600">遷移は「利用可能 → 隔離 → 解除／廃棄」のみ。隔離を経ずに廃棄はできません。</p>
      <Field label="判定根拠" required>
        <textarea className={inputClass} rows={2} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="再測定 4.1℃、品質影響なし など" />
      </Field>
      <div className="flex flex-wrap gap-2">
        {OPTIONS[status].map((o) => (
          <Button key={o.to} variant={o.variant} disabled={busy || !reason.trim()} onClick={() => change(o.to)}>{o.label}</Button>
        ))}
      </div>
      {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
    </div>
  );
}
