import { NextResponse, type NextRequest } from "next/server";
import { addDays, todayJst } from "@/lib/domain/dates";
import { handle, must, requireUser } from "@/lib/server/api-guard";
import { db } from "@/lib/server/supabase-admin";

export const GET = handle(async (req: NextRequest) => {
  await requireUser(req);
  const client = db();
  const head = { count: "exact" as const, head: true };
  const overdueSince = new Date(Date.now() - 15 * 60_000).toISOString();
  const [openAlarms, overdueAlarms, quarantined, waiting, expiring, unset, openDeviations, drafts, recent] =
    await Promise.all([
      client.from("alarms").select("*", head).eq("status", "open"),
      client.from("alarms").select("*", head).eq("status", "open").lt("created_at", overdueSince),
      client.from("lots").select("*", head).eq("status", "quarantine"),
      client.from("orders").select("*", head).eq("status", "created"),
      client.from("lots").select("*", head).neq("status", "scrapped").gt("qty_available", 0)
        .lte("expiry_date", addDays(todayJst(), 7)),
      client.from("agreements").select("*", head).is("delivery_window_rule", null),
      client.from("deviations").select("*", head).eq("status", "open"),
      client.from("routes").select("*", head).eq("status", "draft"),
      client.from("audit_logs").select("*").order("created_at", { ascending: false }).limit(8),
    ]);
  const count = (r: { count: number | null; error: { message: string } | null }, what: string) => {
    must({ data: null, error: r.error }, what);
    return r.count ?? 0;
  };
  return NextResponse.json({
    today: todayJst(),
    counts: {
      openAlarms: count(openAlarms, "アラーム件数"),
      overdueAlarms: count(overdueAlarms, "期限超過アラーム件数"),
      quarantinedLots: count(quarantined, "隔離ロット件数"),
      ordersWaiting: count(waiting, "引当待ち件数"),
      expiringLots: count(expiring, "期限接近件数"),
      unsetAgreements: count(unset, "未設定契約件数"),
      openDeviations: count(openDeviations, "未完了逸脱件数"),
      draftRoutes: count(drafts, "未公開ルート件数"),
    },
    recent: must(recent, "監査ログ取得"),
  });
});
