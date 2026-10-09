import { NextResponse, type NextRequest } from "next/server";
import { audit, handle, HttpError, must, requireUser } from "@/lib/server/api-guard";
import { db } from "@/lib/server/supabase-admin";

// FR-TEMP-03: record the first review time; reviews later than 15 minutes stay marked as SLA breaches.
export const POST = handle(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireUser(req, "alarm:review");
  const { id } = await params;
  const client = db();
  const alarm = must(await client.from("alarms").select("status, created_at").eq("id", id).maybeSingle(), "アラーム取得") as
    { status: string; created_at: string } | null;
  if (!alarm) throw new HttpError(404, "アラームが見つかりません");
  if (alarm.status !== "open") throw new HttpError(409, "このアラームは既に確認済みです");
  const reviewedAt = new Date();
  const minutes = Math.round((reviewedAt.getTime() - Date.parse(alarm.created_at)) / 60_000);
  must(await client.from("alarms").update({
    status: "acknowledged", reviewed_at: reviewedAt.toISOString(), reviewed_by: user.loginId,
  }).eq("id", id).eq("status", "open"), "アラーム更新");
  await audit(user.loginId, "alarm_reviewed", `alarm:${id}`, { minutes_to_review: minutes, within_sla: minutes <= 15 });
  return NextResponse.json({ ok: true, minutes, withinSla: minutes <= 15 });
});
