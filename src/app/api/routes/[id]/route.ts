import { NextResponse, type NextRequest } from "next/server";
import { checkBindingTime, type Segment } from "@/lib/domain/binding-time-check";
import { audit, handle, HttpError, must, readJson, requireUser } from "@/lib/server/api-guard";
import { db } from "@/lib/server/supabase-admin";

type RouteRow = {
  route_id: string; status: string; version: number; start_time: string; prev_route_end: string | null; segments: Segment[];
};
const KINDS = ["drive", "work", "break", "wait"];

async function load(id: string): Promise<RouteRow> {
  const route = must(await db().from("routes").select("*").eq("route_id", id).maybeSingle(), "ルート取得") as RouteRow | null;
  if (!route) throw new HttpError(404, "ルートが見つかりません");
  return route;
}

export const GET = handle(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  await requireUser(req);
  const route = await load((await params).id);
  return NextResponse.json({ route, check: checkBindingTime(route.start_time, route.segments, route.prev_route_end) });
});

// FR-SCH-04: editing a published route needs a reason and creates a new version (back to draft, must be re-checked).
export const PUT = handle(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireUser(req, "route:edit");
  const { id } = await params;
  const body = await readJson<{ segments?: Segment[]; start_time?: string; change_reason?: string }>(req);
  const route = await load(id);
  const segments = body.segments ?? [];
  if (!segments.length || segments.some((s) => !KINDS.includes(s.kind) || !(Number(s.minutes) > 0) || Number(s.minutes) > 1440)) {
    throw new HttpError(422, "区間の種別と時間（1〜1440分）を正しく入力してください");
  }
  if (route.status === "published" && !body.change_reason?.trim()) {
    throw new HttpError(422, "公開済みルートの変更には理由の入力が必要です");
  }
  const start = body.start_time ?? route.start_time;
  if (Number.isNaN(Date.parse(start))) throw new HttpError(422, "始業時刻が不正です");
  const clean = segments.map((s) => ({ kind: s.kind, minutes: Math.round(Number(s.minutes)), note: s.note?.slice(0, 50) }));
  must(await db().from("routes").update({
    segments: clean, start_time: start, status: "draft",
    version: route.status === "published" ? route.version + 1 : route.version,
    change_reason: body.change_reason ?? null,
  }).eq("route_id", id), "ルート更新");
  await audit(user.loginId, "route_updated", id, { change_reason: body.change_reason ?? null });
  return NextResponse.json({ ok: true, check: checkBindingTime(start, clean, route.prev_route_end) });
});
