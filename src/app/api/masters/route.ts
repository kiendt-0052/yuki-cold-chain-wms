import { NextResponse, type NextRequest } from "next/server";
import { handle, must, requireUser } from "@/lib/server/api-guard";
import { db } from "@/lib/server/supabase-admin";

export const GET = handle(async (req: NextRequest) => {
  await requireUser(req);
  const client = db();
  const [skus, suppliers, customers, locations, agreements, devices] = await Promise.all([
    client.from("skus").select("*").order("sku_id"),
    client.from("suppliers").select("*").order("supplier_id"),
    client.from("customers").select("*").order("customer_id"),
    client.from("locations").select("*").order("location_id"),
    client.from("agreements").select("*, customers(name), skus(name_ja)").order("agreement_id"),
    client.from("devices").select("*").order("device_id"),
  ]);
  return NextResponse.json({
    skus: must(skus, "SKU取得"),
    suppliers: must(suppliers, "仕入先取得"),
    customers: must(customers, "顧客取得"),
    locations: must(locations, "ロケーション取得"),
    agreements: must(agreements, "契約取得"),
    devices: must(devices, "機器取得"),
  });
});
