"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, type ReactNode } from "react";
import { ROLE_LABEL } from "@/lib/domain/labels";
import { api } from "@/lib/client/api-client";
import { useApi } from "@/lib/client/use-api";
import { SessionContext, type Me } from "./session-context";

const NAV = [
  { href: "/dashboard", label: "ダッシュボード" },
  { href: "/inbound", label: "入荷検品" },
  { href: "/inventory", label: "在庫・ロット" },
  { href: "/orders", label: "受注・引当・出荷" },
  { href: "/deliveries", label: "配送履歴" },
  { href: "/temperature", label: "温度・アラーム" },
  { href: "/trace", label: "トレース検索" },
  { href: "/routes", label: "配車・拘束時間" },
  { href: "/masters", label: "マスター" },
  { href: "/audit", label: "監査ログ" },
  { href: "/admin", label: "デモ管理" },
];

// usePathname() reads runtime URL data, so the nav renders inside its own Suspense boundary.
function SideNav() {
  const pathname = usePathname();
  return (
    <nav className="flex-1 py-2">
      {NAV.map((n) => (
        <Link key={n.href} href={n.href}
          className={`block px-4 py-2 text-sm hover:bg-white/10 ${pathname.startsWith(n.href) ? "bg-white/15 font-semibold" : ""}`}>
          {n.label}
        </Link>
      ))}
    </nav>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const { data: me, error } = useApi<Me>("/api/auth/me");

  async function logout() {
    await api.post("/api/auth/logout");
    window.location.href = "/login";
  }

  return (
    <SessionContext value={me}>
      <div className="flex min-h-screen">
        <aside className="hidden w-56 shrink-0 flex-col bg-brand-dark text-white md:flex">
          <div className="border-b border-white/10 px-4 py-4">
            <p className="text-xs text-white/60">ユキコールドロジスティクス</p>
            <p className="text-sm font-bold leading-snug">食品コールドチェーン<br />業務支援システム</p>
          </div>
          <Suspense fallback={<div className="flex-1" />}>
            <SideNav />
          </Suspense>
          <p className="px-4 py-3 text-[11px] text-white/50">プロトタイプ（LAB-2）・デモデータ</p>
        </aside>
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-2">
            <nav className="flex gap-2 overflow-x-auto md:hidden">
              {NAV.map((n) => <Link key={n.href} href={n.href} className="whitespace-nowrap text-xs text-brand">{n.label}</Link>)}
            </nav>
            <div className="ml-auto flex items-center gap-3 text-sm">
              {me && <span className="text-slate-600">{me.user.name}（{ROLE_LABEL[me.user.role]}）</span>}
              <button onClick={logout} className="rounded border border-slate-300 px-2 py-1 text-xs hover:bg-slate-50">ログアウト</button>
            </div>
          </header>
          <main className="flex-1 p-4 md:p-6">
            {/* Always render the page segment; write buttons stay disabled until the session (permissions) has loaded. */}
            {error ? <p className="text-sm text-red-600">{error}</p> : children}
          </main>
        </div>
      </div>
    </SessionContext>
  );
}
