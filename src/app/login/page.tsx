"use client";
import { useState, type FormEvent } from "react";
import { api } from "@/lib/client/api-client";
import { Alert, Button, Field, inputClass } from "@/components/ui";

export default function LoginPage() {
  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.post("/api/auth/login", { loginId, password });
      const next = new URLSearchParams(window.location.search).get("next");
      // Only same-site relative paths are accepted as a redirect target.
      window.location.href = next && next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-brand-dark p-4">
      <form onSubmit={submit} className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl">
        <p className="text-xs text-slate-500">ユキコールドロジスティクス株式会社</p>
        <h1 className="mb-1 text-lg font-bold text-brand-dark">食品コールドチェーン業務支援システム</h1>
        <p className="mb-5 text-xs text-slate-500">プロトタイプ — ログインしてください</p>
        <div className="space-y-4">
          <Field label="ログインID" required>
            <input className={inputClass} value={loginId} onChange={(e) => setLoginId(e.target.value)} autoComplete="username" required />
          </Field>
          <Field label="パスワード" required>
            <input className={inputClass} type="password" value={password} onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password" required />
          </Field>
          {error && <Alert>{error}</Alert>}
          <Button type="submit" disabled={busy} className="w-full">{busy ? "確認中…" : "ログイン"}</Button>
        </div>
        <p className="mt-5 text-[11px] leading-relaxed text-slate-500">
          本システムはデモ用のモックデータのみを扱います。デモアカウントは README.md を参照してください。
        </p>
      </form>
    </main>
  );
}
