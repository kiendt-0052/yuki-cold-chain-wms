import { NextResponse, type NextRequest } from "next/server";
import type { TemperatureBand } from "@/lib/domain/labels";
import { groupExcursions, inBand, parseLoggerCsv, POLICY_VERSION, sha256Hex } from "@/lib/domain/temperature";
import { audit, handle, HttpError, must, readJson, requireUser } from "@/lib/server/api-guard";
import { db } from "@/lib/server/supabase-admin";

type Device = { device_id: string; zone: string; temperature_band: TemperatureBand };

// FR-TEMP-01/02 + BR-HACCP-01: idempotent CSV import → evaluation → alarm + deviation + quarantine of zone lots.
export const POST = handle(async (req: NextRequest) => {
  const user = await requireUser(req, "temperature:import");
  const { file_name, content } = await readJson<{ file_name?: string; content?: string }>(req);
  if (!content?.trim()) throw new HttpError(422, "CSVファイルの内容が空です");
  if (content.length > 500_000) throw new HttpError(413, "ファイルが大きすぎます（500KBまで）");

  const client = db();
  const hash = await sha256Hex(content);
  const existing = must(await client.from("temperature_imports").select("*").eq("file_hash", hash).maybeSingle(), "取込履歴確認");
  if (existing) return NextResponse.json({ duplicate: true, import: existing });

  const devices = must(await client.from("devices").select("*"), "機器取得") as Device[];
  const byId = new Map(devices.map((d) => [d.device_id, d]));
  const { readings, errors } = parseLoggerCsv(content);
  const totalRows = readings.length + errors.length;
  const valid = readings.filter((r) => {
    if (byId.has(r.device_id)) return true;
    errors.push({ line: r.line, message: `未登録の機器ID "${r.device_id}"` });
    return false;
  });

  const imp = must(await client.from("temperature_imports").insert({
    file_name: file_name || "upload.csv", file_hash: hash, rows_total: totalRows,
    rows_ok: valid.length, rows_error: errors.length, errors: errors.sort((a, b) => a.line - b.line), imported_by: user.loginId,
  }).select("*").single(), "取込登録") as { id: number };

  const enriched = valid.map((r) => ({ ...r, band: byId.get(r.device_id)!.temperature_band, zone: byId.get(r.device_id)!.zone }));
  if (enriched.length) {
    must(await client.from("temperature_readings").insert(enriched.map((r) => ({
      import_id: imp.id, device_id: r.device_id, zone: r.zone, event_time: r.event_time, value_c: r.value_c,
      policy_band: `${r.band} (${POLICY_VERSION})`, evaluation: inBand(r.band, r.value_c) ? "ok" : "excursion",
    }))), "温度記録登録");
  }

  const alarms = [];
  for (const ex of groupExcursions(enriched)) {
    const device = byId.get(ex.device_id)!;
    // Every alarm creates a deviation and quarantines the lots stored in that zone; QA decides release/scrap.
    const lots = must(await client.from("lots").select("lot_id, locations!inner(zone, is_quarantine)")
      .eq("status", "available").eq("locations.zone", device.zone).eq("locations.is_quarantine", false), "対象ロット取得") as { lot_id: string }[];
    const lotIds = lots.map((l) => l.lot_id);
    const deviation = must(await client.from("deviations").insert({
      source: "alarm", zone: device.zone, affected_lots: lotIds,
      description: `${ex.device_id} ${device.zone}ゾーンで基準外温度（最大 ${ex.peak_c}℃）を検知`,
    }).select("id").single(), "逸脱登録") as { id: number };
    if (lotIds.length) {
      must(await client.from("lots").update({ status: "quarantine" }).in("lot_id", lotIds).eq("status", "available"), "隔離更新");
      must(await client.from("lot_events").insert(lotIds.map((lot_id) => ({
        lot_id, event_type: "quarantined", actor: "system", detail: { deviation_id: deviation.id, device_id: ex.device_id },
      }))), "イベント登録");
    }
    const alarm = must(await client.from("alarms").insert({ ...ex, zone: device.zone, deviation_id: deviation.id })
      .select("*").single(), "アラーム登録") as Record<string, unknown>;
    alarms.push({ ...alarm, quarantined: lotIds });
  }

  await audit(user.loginId, "temperature_import", file_name || "upload.csv", { rows_ok: valid.length, alarms: alarms.length });
  return NextResponse.json({ duplicate: false, import: imp, errors, alarms });
});
