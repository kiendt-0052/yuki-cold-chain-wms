import { NextResponse, type NextRequest } from "next/server";
import { checkBindingTime, type Segment } from "@/lib/domain/binding-time-check";
import { audit, handle, HttpError, must, requireUser } from "@/lib/server/api-guard";
import { db } from "@/lib/server/supabase-admin";

// FR-SCH-02/04: a route with a binding-time violation cannot be published; the rule version is bound at publish time.
export const POST = handle(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireUser(req, "route:edit");
  const { id } = await params;
  const route = must(await db().from("routes").select("*").eq("route_id", id).maybeSingle(), "ルート取得") as
    { status: string; start_time: string; prev_route_end: string | null; segments: Segment[] } | null;
  if (!route) throw new HttpError(404, "ルートが見つかりません");
  if (route.status === "published") throw new HttpError(409, "既に公開済みです");
  const check = checkBindingTime(route.start_time, route.segments, route.prev_route_end);
  if (!check.publishable) {
    throw new HttpError(409, "拘束時間の違反があるため公開できません", { findings: check.findings });
  }
  must(await db().from("routes").update({
    status: "published", rule_version: check.ruleVersion, published_at: new Date().toISOString(), published_by: user.loginId,
  }).eq("route_id", id), "ルート公開");
  await audit(user.loginId, "route_published", id, { rule_version: check.ruleVersion, warnings: check.findings });
  return NextResponse.json({ ok: true, check });
});
