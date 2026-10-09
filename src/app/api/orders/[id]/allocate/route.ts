import { NextResponse, type NextRequest } from "next/server";
import { CHECK_LABEL } from "@/lib/domain/allocation-rules";
import { audit, handle, HttpError, readJson, requireUser } from "@/lib/server/api-guard";
import { loadOrderContext } from "@/lib/server/order-context";
import { db } from "@/lib/server/supabase-admin";

type Body = { lot_id?: string; override_reason?: string; acknowledge_warnings?: boolean };

const RPC_ERRORS: Record<string, string> = {
  ORDER_NOT_ALLOCATABLE: "この受注は既に引当済みです",
  LOT_NOT_AVAILABLE: "ロットが利用可能ではありません（隔離・廃棄）",
  INSUFFICIENT_QTY: "引当可能数が不足しています（他の引当と競合した可能性があります）",
};

export const POST = handle(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireUser(req, "order:allocate");
  const { id } = await params;
  const body = await readJson<Body>(req);
  if (!body.lot_id) throw new HttpError(400, "ロットを選択してください");

  // Never trust the client: re-run the full rule chain on the server.
  const ctx = await loadOrderContext(id);
  if (!ctx.evaluation) throw new HttpError(409, "この受注は引当待ちではありません");
  const lot = ctx.evaluation.lots.find((l) => l.lot_id === body.lot_id);
  if (!lot) throw new HttpError(404, "引当候補にないロットです");

  if (lot.verdict === "excluded") {
    const failed = lot.checks.find((c) => c.code === lot.failedCode);
    throw new HttpError(409, `${CHECK_LABEL[lot.failedCode!]}により引当できません：${failed?.message ?? ""}`,
      { code: lot.failedCode, checks: lot.checks });
  }
  const reason = body.override_reason?.trim();
  if (lot.verdict === "review" && (!reason || reason.length < 5)) {
    throw new HttpError(409, "配送ウィンドウルールが未設定です。確認理由（5文字以上）を入力した場合のみ引当できます",
      { code: "REVIEW_REQUIRED" });
  }
  const warnings = lot.checks.filter((c) => !c.ok && c.severity === "warn").map((c) => c.message);
  if (lot.lot_id !== ctx.evaluation.recommendedLotId && lot.verdict === "eligible") {
    warnings.push(`FEFO推奨ロット（${ctx.evaluation.recommendedLotId}）以外を選択`);
  }
  if (warnings.length && !body.acknowledge_warnings) {
    throw new HttpError(409, "警告があります。内容を確認のうえ再実行してください", { code: "WARNINGS", warnings });
  }

  const { data, error } = await db().rpc("allocate_lot", {
    p_order_id: id, p_lot_id: lot.lot_id, p_actor: user.loginId,
    p_warnings: warnings, p_override_reason: lot.verdict === "review" ? reason : null,
  });
  if (error) {
    const key = Object.keys(RPC_ERRORS).find((k) => error.message.includes(k));
    throw new HttpError(409, key ? RPC_ERRORS[key] : `引当に失敗しました: ${error.message}`);
  }
  await audit(user.loginId, "allocate", id, { lot_id: lot.lot_id, warnings, override_reason: reason ?? null });
  return NextResponse.json({ ok: true, result: data });
});
