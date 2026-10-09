"use client";
import { Button } from "@/components/ui";
import { formatDate, formatDateTime } from "@/lib/client/format";
import type { LotEvaluation } from "@/lib/domain/allocation-rules";
import { diffDays } from "@/lib/domain/dates";

type Props = {
  lot: LotEvaluation;
  lastAccepted: { expiry_date: string; completed_at: string };
  customer: { customer_id: string; name: string };
  sku: { sku_id: string; name_ja: string };
  recommended: string | null;
  onClose: () => void;
  onPickRecommended: () => void;
};

// 日付逆転禁止 (BR-DATE-01) warning shown before the system would ship an older lot to the same customer.
export function DateReversalDialog({ lot, lastAccepted, customer, sku, recommended, onClose, onPickRecommended }: Props) {
  const days = diffDays(lastAccepted.expiry_date, lot.expiry_date);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-labelledby="reversal-title">
      <div className="w-full max-w-lg rounded-xl border-2 border-red-500 bg-white p-6 shadow-2xl">
        <h2 id="reversal-title" className="text-lg font-bold text-red-700">⚠ 日付逆転のため出荷できません</h2>
        <p className="mt-3 text-sm text-slate-700">
          {customer.customer_id} {customer.name} には、{sku.sku_id} {sku.name_ja} を既に
          <strong> 期限 {formatDate(lastAccepted.expiry_date)}</strong> で納品済みです（{formatDateTime(lastAccepted.completed_at)} 受入）。
        </p>
        <div className="mt-4 grid grid-cols-2 gap-3 text-center text-sm">
          <div className="rounded-lg bg-slate-100 p-3">
            <p className="text-xs text-slate-500">前回受入済み</p>
            <p className="text-lg font-bold">{formatDate(lastAccepted.expiry_date)}</p>
          </div>
          <div className="rounded-lg bg-red-50 p-3">
            <p className="text-xs text-red-600">今回の候補 {lot.lot_id}</p>
            <p className="text-lg font-bold text-red-700">{formatDate(lot.expiry_date)}</p>
          </div>
        </div>
        <p className="mt-3 text-sm text-slate-700">
          今回のロットは前回より <strong>{days}日古い</strong> 期限です。比較は「同一顧客・同一SKUの受入済み配送」に対して行い、本日の日付や他顧客の履歴とは比較しません。
        </p>
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>閉じる</Button>
          {recommended && <Button onClick={onPickRecommended}>推奨ロット {recommended} を選択</Button>}
        </div>
      </div>
    </div>
  );
}
