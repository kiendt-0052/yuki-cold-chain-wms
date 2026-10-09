import { NextResponse, type NextRequest } from "next/server";
import { checkBindingTime, type Segment } from "@/lib/domain/binding-time-check";
import { handle, must, requireUser } from "@/lib/server/api-guard";
import { db } from "@/lib/server/supabase-admin";

type RouteRow = { route_id: string; start_time: string; prev_route_end: string | null; segments: Segment[] };

export const GET = handle(async (req: NextRequest) => {
  await requireUser(req);
  const routes = must(await db().from("routes").select("*").order("route_date").order("route_id"), "ルート取得") as RouteRow[];
  return NextResponse.json({
    routes: routes.map((r) => ({ ...r, check: checkBindingTime(r.start_time, r.segments, r.prev_route_end) })),
  });
});
