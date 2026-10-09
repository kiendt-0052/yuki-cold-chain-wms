import { NextResponse, type NextRequest } from "next/server";
import { handle, must, requireUser } from "@/lib/server/api-guard";
import { db } from "@/lib/server/supabase-admin";

export const GET = handle(async (req: NextRequest) => {
  await requireUser(req);
  const client = db();
  const [alarms, imports, deviations, devices, readings] = await Promise.all([
    client.from("alarms").select("*").order("status").order("created_at", { ascending: false }).limit(30),
    client.from("temperature_imports").select("*").order("imported_at", { ascending: false }).limit(10),
    client.from("deviations").select("*").order("status", { ascending: false }).order("created_at", { ascending: false }).limit(30),
    client.from("devices").select("*").order("device_id"),
    client.from("temperature_readings").select("device_id, event_time, value_c, evaluation")
      .order("event_time", { ascending: false }).limit(120),
  ]);
  return NextResponse.json({
    alarms: must(alarms, "アラーム取得"),
    imports: must(imports, "取込履歴取得"),
    deviations: must(deviations, "逸脱取得"),
    devices: must(devices, "機器取得"),
    readings: must(readings, "温度記録取得"),
    now: new Date().toISOString(),
  });
});
