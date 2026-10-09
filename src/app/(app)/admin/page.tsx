"use client";
import { useState } from "react";
import { Alert, Button, Card, PageHeader, Table, td } from "@/components/ui";
import { useSession } from "@/components/session-context";
import { api } from "@/lib/client/api-client";
import { PERMISSIONS } from "@/lib/permissions";
import { ROLE_LABEL, type Role } from "@/lib/domain/labels";

const PERMISSION_LABEL: Record<string, string> = {
  "inbound:write": "入荷検品の確定", "lot:quality": "ロットの隔離・解除・廃棄", "order:allocate": "引当・引当取消",
  "order:ship": "出荷前チェック", "order:deliver": "配送完了（POD）", "temperature:import": "ロガーCSV取込",
  "alarm:review": "アラーム確認", "deviation:decide": "逸脱ケースの判定", "route:edit": "ルート編集・公開",
  "master:edit": "マスター変更", "demo:reset": "デモデータ初期化",
};

export default function AdminPage() {
  const { can } = useSession();
  const [msg, setMsg] = useState<{ tone: "green" | "red"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function reset() {
    if (!window.confirm("デモデータを初期状態に戻します（日付は本日基準で再作成）。よろしいですか？")) return;
    setBusy(true);
    try {
      await api.post("/api/admin/reset-demo");
      setMsg({ tone: "green", text: "デモデータを初期化しました。" });
    } catch (e) {
      setMsg({ tone: "red", text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }

  const roles = Object.keys(ROLE_LABEL) as Role[];
  return (
    <>
      <PageHeader title="デモ管理・権限一覧" />
      <Card title="デモデータの初期化" className="mb-5">
        <p className="mb-3 text-sm text-slate-600">レビュー用のシナリオを最初からやり直せます。ユーザー（デモアカウント）は初期化されません。</p>
        <Button variant="danger" onClick={reset} disabled={busy || !can("demo:reset")}>{can("demo:reset") ? "デモデータを初期化" : "管理者のみ"}</Button>
        {msg && <div className="mt-3"><Alert tone={msg.tone}>{msg.text}</Alert></div>}
      </Card>
      <Card title="ロール別の操作権限（参照はログイン済みの全ロールが可能）">
        <Table head={["操作", ...roles.map((r) => ROLE_LABEL[r])]}>
          {Object.entries(PERMISSIONS).map(([p, allowed]) => (
            <tr key={p}>
              <td className={td}>{PERMISSION_LABEL[p] ?? p}</td>
              {roles.map((r) => <td key={r} className={`${td} text-center`}>{(allowed as readonly string[]).includes(r) ? "●" : "—"}</td>)}
            </tr>
          ))}
        </Table>
      </Card>
    </>
  );
}
