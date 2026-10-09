import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "食品コールドチェーン業務支援システム（プロトタイプ）",
  description: "ユキコールドロジスティクス 向け 低温物流業務支援システムのプロトタイプ",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ja" className="h-full antialiased">
      <body className="min-h-full">{children}</body>
    </html>
  );
}
