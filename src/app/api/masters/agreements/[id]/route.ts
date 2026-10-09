import { NextResponse, type NextRequest } from "next/server";
import { audit, handle, HttpError, must, readJson, requireUser } from "@/lib/server/api-guard";
import { db } from "@/lib/server/supabase-admin";

const RULES = ["ONE_THIRD", "ONE_HALF", "LABEL_DATE_ONLY"];

// 顧客-SKU契約の配送ウィンドウルール設定。null(未設定) からの設定もスキーマ変更なしで可能。
export const PATCH = handle(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireUser(req, "master:edit");
  const { id } = await params;
  const { delivery_window_rule, reason } = await readJson<{ delivery_window_rule?: string | null; reason?: string }>(req);
  if (delivery_window_rule !== null && !RULES.includes(String(delivery_window_rule))) {
    throw new HttpError(422, "ルールが不正です");
  }
  if (!reason?.trim()) throw new HttpError(422, "変更理由（顧客との合意内容など）を入力してください");

  const client = db();
  const before = must(await client.from("agreements").select("delivery_window_rule").eq("agreement_id", id).maybeSingle(),
    "契約取得") as { delivery_window_rule: string | null } | null;
  if (!before) throw new HttpError(404, "契約が見つかりません");
  must(await client.from("agreements").update({
    delivery_window_rule, updated_by: user.loginId, updated_at: new Date().toISOString(),
  }).eq("agreement_id", id), "契約更新");
  await audit(user.loginId, "agreement_rule_changed", id, {
    from: before.delivery_window_rule, to: delivery_window_rule, reason,
  });
  return NextResponse.json({ ok: true });
});
