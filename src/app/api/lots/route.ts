import { NextResponse, type NextRequest } from "next/server";
import { addDays, todayJst } from "@/lib/domain/dates";
import { handle, must, requireUser } from "@/lib/server/api-guard";
import { db } from "@/lib/server/supabase-admin";

// 在庫照会 (FR-INV-06): filter by text, status, temperature band and days to expiry.
export const GET = handle(async (req: NextRequest) => {
  await requireUser(req);
  const sp = req.nextUrl.searchParams;
  let query = db().from("lots")
    .select("*, skus!inner(name_ja, temperature_band, expiry_type, trace_lane), suppliers(name), locations(temperature_band, is_quarantine)")
    .order("expiry_date");

  const q = sp.get("q")?.trim();
  if (q) {
    const safe = q.replace(/[%,()]/g, "");
    query = query.or(`lot_id.ilike.%${safe}%,sku_id.ilike.%${safe}%,supplier_lot.ilike.%${safe}%`);
  }
  const status = sp.get("status");
  if (status) query = query.eq("status", status);
  const band = sp.get("band");
  if (band) query = query.eq("skus.temperature_band", band);
  const expiring = Number(sp.get("expiringDays"));
  if (expiring > 0) query = query.lte("expiry_date", addDays(todayJst(), expiring)).gt("qty_available", 0);

  return NextResponse.json({ lots: must(await query, "在庫取得"), today: todayJst() });
});
