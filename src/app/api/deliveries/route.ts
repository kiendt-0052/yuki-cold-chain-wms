import { NextResponse, type NextRequest } from "next/server";
import { handle, must, requireUser } from "@/lib/server/api-guard";
import { db } from "@/lib/server/supabase-admin";

// 受入済み配送履歴 (DR-HIST-01) — the basis of every 日付逆転 check.
export const GET = handle(async (req: NextRequest) => {
  await requireUser(req);
  const sp = req.nextUrl.searchParams;
  let query = db().from("accepted_deliveries").select("*, customers(name), skus(name_ja, expiry_type)")
    .order("completed_at", { ascending: false }).limit(200);
  if (sp.get("customer")) query = query.eq("customer_id", sp.get("customer")!);
  if (sp.get("sku")) query = query.eq("sku_id", sp.get("sku")!);
  return NextResponse.json({ deliveries: must(await query, "配送履歴取得") });
});
