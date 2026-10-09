import { NextResponse, type NextRequest } from "next/server";
import { handle, must, requireUser } from "@/lib/server/api-guard";
import { db } from "@/lib/server/supabase-admin";

// NFR-AUD-01 (read-only view): append-only audit log + immutable lot events.
export const GET = handle(async (req: NextRequest) => {
  await requireUser(req);
  const client = db();
  const [logs, events] = await Promise.all([
    client.from("audit_logs").select("*").order("created_at", { ascending: false }).limit(150),
    client.from("lot_events").select("*").order("created_at", { ascending: false }).limit(150),
  ]);
  return NextResponse.json({ logs: must(logs, "監査ログ取得"), events: must(events, "ロットイベント取得") });
});
