import { NextResponse, type NextRequest } from "next/server";
import { judgeInbound, type InboundInput, type SkuInfo } from "@/lib/domain/inbound-validation";
import type { TemperatureBand } from "@/lib/domain/labels";
import { audit, handle, HttpError, must, readJson, requireUser } from "@/lib/server/api-guard";
import { db } from "@/lib/server/supabase-admin";

export const GET = handle(async (req: NextRequest) => {
  await requireUser(req);
  const client = db();
  const [recent, suppliers, skus, locations] = await Promise.all([
    client.from("inbound_inspections").select("*, skus(name_ja), suppliers(name)")
      .order("inspected_at", { ascending: false }).limit(20),
    client.from("suppliers").select("*").order("supplier_id"),
    client.from("skus").select("*").order("sku_id"),
    client.from("locations").select("*").eq("is_quarantine", false).order("location_id"),
  ]);
  return NextResponse.json({
    recent: must(recent, "入荷履歴取得"),
    suppliers: must(suppliers, "仕入先取得"),
    skus: must(skus, "SKU取得"),
    locations: must(locations, "ロケーション取得"),
  });
});

export const POST = handle(async (req: NextRequest) => {
  const user = await requireUser(req, "inbound:write");
  const input = await readJson<InboundInput>(req);
  if (!input.request_id || !input.sku_id || !input.supplier_id) throw new HttpError(422, "SKUと仕入先は必須です");

  const client = db();
  const [skuRes, locRes] = await Promise.all([
    client.from("skus").select("temperature_band, expiry_type, trace_lane").eq("sku_id", input.sku_id).maybeSingle(),
    client.from("locations").select("temperature_band").eq("location_id", input.location_id ?? "").maybeSingle(),
  ]);
  const sku = must(skuRes, "SKU取得") as SkuInfo | null;
  if (!sku) throw new HttpError(422, "SKUが存在しません");
  const loc = must(locRes, "ロケーション取得") as { temperature_band: TemperatureBand } | null;

  const judgement = judgeInbound(input, sku, loc?.temperature_band ?? null);
  if (judgement.errors.length) {
    throw new HttpError(422, "入力内容を確認してください（P0項目の不足・不整合）", { errors: judgement.errors });
  }

  const { data, error } = await client.rpc("record_inbound", {
    p: { ...input, result: judgement.result, reason: judgement.reasons.join("、") },
    p_actor: user.loginId,
  });
  if (error) throw new HttpError(500, `入荷確定に失敗しました: ${error.message}`);
  await audit(user.loginId, "inbound", (data as { lot_id: string }).lot_id, { result: judgement.result });
  return NextResponse.json({ ok: true, ...data, reasons: judgement.reasons });
});
