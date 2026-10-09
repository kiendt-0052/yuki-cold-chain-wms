-- ============================================================
-- setup.sql — paste the whole file into Supabase Dashboard > SQL Editor and Run (idempotent).
-- Generated from supabase/migrations/0001..0004. Re-running resets the demo data (users are kept).
-- ============================================================

-- >>> supabase/migrations/0001_schema.sql
-- 食品コールドチェーン業務支援システム (prototype) — schema
-- Every table has RLS enabled and NO policy: only the server (secret key) can read/write.

create extension if not exists pgcrypto with schema extensions;

-- ---------- Users (custom login, not Supabase Auth) ----------
create table if not exists app_users (
  id            uuid primary key default gen_random_uuid(),
  login_id      text unique not null,
  display_name  text not null,
  role          text not null check (role in ('admin','receiving','dispatcher','qa','auditor')),
  password_hash text not null,
  active        boolean not null default true,
  created_at    timestamptz not null default now()
);

-- ---------- Masters ----------
create table if not exists skus (
  sku_id               text primary key,
  name_ja              text not null,
  unit                 text not null,
  temperature_band     text not null check (temperature_band in ('ambient','chilled','frozen')),
  expiry_type          text not null check (expiry_type in ('best_before','use_by')),   -- 賞味期限 / 消費期限
  trace_lane           text not null check (trace_lane in ('rice','beef','internal')),
  regulated_identifier text
);

create table if not exists suppliers (
  supplier_id text primary key,
  name        text not null
);

create table if not exists customers (
  customer_id text primary key,
  name        text not null
);

create table if not exists agreements (
  agreement_id         text primary key,
  customer_id          text not null references customers,
  sku_id               text not null references skus,
  delivery_term        text not null check (delivery_term in ('on_truck','at_door')),   -- 車上渡し / 軒先渡し
  delivery_window_rule text check (delivery_window_rule in ('ONE_THIRD','ONE_HALF','LABEL_DATE_ONLY')), -- null = 未設定
  effective_from       date not null default date '2026-04-01',
  updated_by           text,
  updated_at           timestamptz,
  unique (customer_id, sku_id)
);

create table if not exists locations (
  location_id      text primary key,
  zone             text not null,
  temperature_band text not null check (temperature_band in ('ambient','chilled','frozen')),
  is_quarantine    boolean not null default false,
  capacity         integer not null default 100
);

create table if not exists devices (
  device_id text primary key,
  zone      text not null,
  temperature_band text not null check (temperature_band in ('ambient','chilled','frozen'))
);

-- ---------- Inventory ----------
create table if not exists lots (
  lot_id             text primary key,
  sku_id             text not null references skus,
  supplier_id        text not null references suppliers,
  supplier_lot       text not null,
  received_at        timestamptz not null default now(),
  production_date    date not null,
  expiry_date        date not null,
  qty_received       numeric not null check (qty_received >= 0),
  qty_available      numeric not null check (qty_available >= 0),
  location_id        text not null references locations,
  status             text not null default 'available' check (status in ('available','quarantine','scrapped')),
  rice_origin        text,
  beef_individual_id text
);

create table if not exists inbound_inspections (
  id              bigserial primary key,
  request_id      text unique not null,              -- idempotency key from the client
  supplier_id     text not null references suppliers,
  sku_id          text not null references skus,
  supplier_lot    text not null,
  qty_reported    numeric not null,
  qty_accepted    numeric not null,
  qty_rejected    numeric not null default 0,
  variance_reason text,
  expiry_type     text not null,
  production_date date not null,
  expiry_date     date not null,
  measured_temp   numeric(5,1) not null,
  packaging_ok    boolean not null,
  photo_ref       text not null,
  location_id     text not null references locations,
  result          text not null check (result in ('accepted','quarantined')),
  reason          text,
  lot_id          text references lots,
  inspected_by    text not null,
  inspected_at    timestamptz not null default now()
);

-- Immutable business event log per lot (no update / delete from the app).
create table if not exists lot_events (
  id         bigserial primary key,
  lot_id     text not null references lots,
  event_type text not null,
  detail     jsonb not null default '{}',
  actor      text not null,
  created_at timestamptz not null default now()
);

-- ---------- Orders, allocation, shipment, delivery ----------
create table if not exists orders (
  order_id         text primary key,
  customer_id      text not null references customers,
  sku_id           text not null references skus,
  qty              numeric not null check (qty > 0),
  requested_date   date not null,
  delivery_term    text not null check (delivery_term in ('on_truck','at_door')),
  status           text not null default 'created' check (status in ('created','allocated','dispatched','delivered')),
  allocated_lot_id text references lots,
  created_at       timestamptz not null default now()
);

create table if not exists allocations (
  id              bigserial primary key,
  order_id        text not null references orders,
  lot_id          text not null references lots,
  qty             numeric not null,
  warnings        jsonb not null default '[]',
  override_reason text,
  decided_by      text not null,
  cancelled_at    timestamptz,
  created_at      timestamptz not null default now()
);

create table if not exists shipment_checks (
  id           bigserial primary key,
  order_id     text not null references orders,
  vehicle_temp numeric(5,1) not null,
  cargo_temp   numeric(5,1) not null,
  seal_no      text not null,
  result       text not null check (result in ('passed','failed')),
  reason       text,
  checked_by   text not null,
  checked_at   timestamptz not null default now()
);

-- DR-HIST-01: accepted delivery history (basis for 日付逆転禁止). Corrections only by reversal rows.
create table if not exists accepted_deliveries (
  id             bigserial primary key,
  order_id       text references orders,
  customer_id    text not null references customers,
  sku_id         text not null references skus,
  lot_id         text references lots,
  expiry_date    date not null,
  qty            numeric not null,
  delivery_term  text not null,
  recipient_name text not null,
  evidence       jsonb not null default '{}',
  evidence_hash  text,
  completed_by   text not null,
  completed_at   timestamptz not null default now()
);

-- ---------- Temperature / HACCP ----------
create table if not exists temperature_imports (
  id          bigserial primary key,
  file_name   text not null,
  file_hash   text unique not null,                  -- same file twice = idempotent
  rows_total  integer not null,
  rows_ok     integer not null,
  rows_error  integer not null,
  errors      jsonb not null default '[]',
  imported_by text not null,
  imported_at timestamptz not null default now()
);

create table if not exists temperature_readings (
  id          bigserial primary key,
  import_id   bigint references temperature_imports,
  device_id   text not null references devices,
  zone        text not null,
  event_time  timestamptz not null,
  value_c     numeric(5,1) not null,
  policy_band text not null,
  evaluation  text not null check (evaluation in ('ok','excursion'))
);

create table if not exists deviations (
  id                bigserial primary key,
  source            text not null check (source in ('alarm','inbound','shipment','movement')),
  zone              text,
  description       text not null,
  affected_lots     text[] not null default '{}',
  status            text not null default 'open' check (status in ('open','closed')),
  investigation     text,
  corrective_action text,
  decision          text check (decision in ('release','scrap')),
  rationale         text,
  attachment_ref    text,
  decided_by        text,
  closed_at         timestamptz,
  created_at        timestamptz not null default now()
);

create table if not exists alarms (
  id            bigserial primary key,
  device_id     text not null references devices,
  zone          text not null,
  first_at      timestamptz not null,
  last_at       timestamptz not null,
  peak_c        numeric(5,1) not null,
  reading_count integer not null,
  status        text not null default 'open' check (status in ('open','acknowledged','closed')),
  reviewed_at   timestamptz,
  reviewed_by   text,
  deviation_id  bigint references deviations,
  created_at    timestamptz not null default now()
);

-- ---------- Routes (拘束時間 check, simplified) ----------
create table if not exists routes (
  route_id       text primary key,
  route_date     date not null,
  driver_name    text not null,
  vehicle        text not null,
  start_time     timestamptz not null,
  prev_route_end timestamptz,
  segments       jsonb not null default '[]',
  status         text not null default 'draft' check (status in ('draft','published')),
  version        integer not null default 1,
  rule_version   text,
  change_reason  text,
  published_at   timestamptz,
  published_by   text
);

-- ---------- Audit (append-only) ----------
create table if not exists audit_logs (
  id         bigserial primary key,
  actor      text not null,
  action     text not null,
  target     text,
  detail     jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index if not exists idx_lots_sku on lots (sku_id);
create index if not exists idx_lot_events_lot on lot_events (lot_id, created_at);
create index if not exists idx_hist_customer_sku on accepted_deliveries (customer_id, sku_id, completed_at desc);
create index if not exists idx_readings_device_time on temperature_readings (device_id, event_time);

-- RLS on, no policies: anon / authenticated keys cannot touch any row.
do $$
declare t text;
begin
  foreach t in array array['app_users','skus','suppliers','customers','agreements','locations','devices','lots',
    'inbound_inspections','lot_events','orders','allocations','shipment_checks','accepted_deliveries',
    'temperature_imports','temperature_readings','deviations','alarms','routes','audit_logs']
  loop
    execute format('alter table %I enable row level security', t);
  end loop;
end $$;

-- >>> supabase/migrations/0002_functions.sql
-- Atomic operations called from Next.js API routes via supabase.rpc().
-- Business-rule evaluation (期限・温度帯・日付逆転…) runs in TypeScript first; these functions
-- re-check the state that can change concurrently (status, quantity) under row locks.

-- 原子的引当 (FR-OUT-02): two concurrent requests can never over-allocate the same lot.
create or replace function allocate_lot(
  p_order_id text, p_lot_id text, p_actor text,
  p_warnings jsonb default '[]', p_override_reason text default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_order orders%rowtype;
  v_lot   lots%rowtype;
begin
  select * into v_order from orders where order_id = p_order_id for update;
  if not found then raise exception 'ORDER_NOT_FOUND'; end if;
  if v_order.status <> 'created' then raise exception 'ORDER_NOT_ALLOCATABLE:%', v_order.status; end if;

  select * into v_lot from lots where lot_id = p_lot_id for update;
  if not found then raise exception 'LOT_NOT_FOUND'; end if;
  if v_lot.sku_id <> v_order.sku_id then raise exception 'SKU_MISMATCH'; end if;
  if v_lot.status <> 'available' then raise exception 'LOT_NOT_AVAILABLE:%', v_lot.status; end if;
  if v_lot.qty_available < v_order.qty then raise exception 'INSUFFICIENT_QTY'; end if;

  update lots set qty_available = qty_available - v_order.qty where lot_id = p_lot_id;
  update orders set status = 'allocated', allocated_lot_id = p_lot_id where order_id = p_order_id;
  insert into allocations (order_id, lot_id, qty, warnings, override_reason, decided_by)
    values (p_order_id, p_lot_id, v_order.qty, coalesce(p_warnings, '[]'), p_override_reason, p_actor);
  insert into lot_events (lot_id, event_type, detail, actor)
    values (p_lot_id, 'allocated', jsonb_build_object('order_id', p_order_id, 'qty', v_order.qty,
            'warnings', p_warnings, 'override_reason', p_override_reason), p_actor);
  return jsonb_build_object('order_id', p_order_id, 'lot_id', p_lot_id, 'qty', v_order.qty);
end $$;

-- 引当取消: returns the quantity to the lot (only before dispatch).
create or replace function cancel_allocation(p_order_id text, p_actor text, p_reason text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_order orders%rowtype;
begin
  select * into v_order from orders where order_id = p_order_id for update;
  if not found then raise exception 'ORDER_NOT_FOUND'; end if;
  if v_order.status <> 'allocated' then raise exception 'ORDER_NOT_CANCELLABLE:%', v_order.status; end if;

  update lots set qty_available = qty_available + v_order.qty where lot_id = v_order.allocated_lot_id;
  update allocations set cancelled_at = now()
    where order_id = p_order_id and cancelled_at is null;
  update orders set status = 'created', allocated_lot_id = null where order_id = p_order_id;
  insert into lot_events (lot_id, event_type, detail, actor)
    values (v_order.allocated_lot_id, 'allocation_cancelled',
            jsonb_build_object('order_id', p_order_id, 'qty', v_order.qty, 'reason', p_reason), p_actor);
  return jsonb_build_object('order_id', p_order_id);
end $$;

-- 入荷確定 (FR-REC-02/04/05): inspection + immutable lot + event in one transaction, idempotent by request_id.
create or replace function record_inbound(p jsonb, p_actor text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_existing inbound_inspections%rowtype;
  v_lot_id   text;
  v_seq      integer;
  v_result   text := p->>'result';
  v_deviation_id bigint;
begin
  select * into v_existing from inbound_inspections where request_id = p->>'request_id';
  if found then
    return jsonb_build_object('lot_id', v_existing.lot_id, 'result', v_existing.result, 'duplicate', true);
  end if;

  select count(*) + 1 into v_seq from lots where lot_id like 'LOT-' || to_char(now(), 'YYYYMMDD') || '-%';
  v_lot_id := 'LOT-' || to_char(now(), 'YYYYMMDD') || '-' || lpad(v_seq::text, 3, '0');

  insert into lots (lot_id, sku_id, supplier_id, supplier_lot, production_date, expiry_date,
                    qty_received, qty_available, location_id, status, rice_origin, beef_individual_id)
  values (v_lot_id, p->>'sku_id', p->>'supplier_id', p->>'supplier_lot',
          (p->>'production_date')::date, (p->>'expiry_date')::date,
          (p->>'qty_accepted')::numeric, (p->>'qty_accepted')::numeric, p->>'location_id',
          case when v_result = 'quarantined' then 'quarantine' else 'available' end,
          nullif(p->>'rice_origin', ''), nullif(p->>'beef_individual_id', ''));

  insert into inbound_inspections (request_id, supplier_id, sku_id, supplier_lot, qty_reported, qty_accepted,
    qty_rejected, variance_reason, expiry_type, production_date, expiry_date, measured_temp, packaging_ok,
    photo_ref, location_id, result, reason, lot_id, inspected_by)
  values (p->>'request_id', p->>'supplier_id', p->>'sku_id', p->>'supplier_lot',
    (p->>'qty_reported')::numeric, (p->>'qty_accepted')::numeric, coalesce((p->>'qty_rejected')::numeric, 0),
    nullif(p->>'variance_reason', ''), p->>'expiry_type', (p->>'production_date')::date,
    (p->>'expiry_date')::date, (p->>'measured_temp')::numeric, (p->>'packaging_ok')::boolean,
    p->>'photo_ref', p->>'location_id', v_result, nullif(p->>'reason', ''), v_lot_id, p_actor);

  insert into lot_events (lot_id, event_type, detail, actor)
    values (v_lot_id, 'received', jsonb_build_object('request_id', p->>'request_id',
            'measured_temp', (p->>'measured_temp')::numeric, 'result', v_result), p_actor);

  if v_result = 'quarantined' then
    insert into deviations (source, zone, description, affected_lots)
      values ('inbound', p->>'location_id', coalesce(p->>'reason', '入荷時の逸脱'), array[v_lot_id])
      returning id into v_deviation_id;
    insert into lot_events (lot_id, event_type, detail, actor)
      values (v_lot_id, 'quarantined', jsonb_build_object('deviation_id', v_deviation_id,
              'reason', p->>'reason'), 'system');
  end if;

  return jsonb_build_object('lot_id', v_lot_id, 'result', v_result, 'deviation_id', v_deviation_id,
                            'duplicate', false);
end $$;

-- Only the server-side secret key (service_role) may touch data or call these functions.
revoke all on function allocate_lot(text, text, text, jsonb, text) from public, anon, authenticated;
revoke all on function cancel_allocation(text, text, text) from public, anon, authenticated;
revoke all on function record_inbound(jsonb, text) from public, anon, authenticated;
revoke all on all tables in schema public from anon, authenticated;
grant usage on schema public to service_role;
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;
grant execute on all functions in schema public to service_role;

-- >>> supabase/migrations/0003_demo_seed.sql
-- Demo (mock) data. Masters follow the RFP fixtures (R-02 SKU master, R-04 customer agreements).
-- Dates are relative to the day the function runs so the demo scenarios keep working:
--   * ORD-1001 CUS-003/CHI-002 : lot LOT-S-0008 expires before the last accepted delivery → 日付逆転
--   * ORD-1002 CUS-001/AMB-001 : LOT-S-0001 is past its 3分の1 delivery deadline (contract rule, not law)
--   * ORD-1003 CUS-003/CHI-004 : AGR-008 has no delivery window rule yet (未設定 → 要確認)
--   * ORD-1004 CUS-002/CHI-003 : LOT-S-0011 reaches its 消費期限 before delivery → hard stop
--   * ORD-1005 CUS-002/FRO-002 : LOT-S-0016 is stored in a chilled location → 温度帯不一致
--   * ORD-1007 CUS-005/FRO-001 : LOT-S-0014 is quarantined
-- Business names are fictional. Users (app_users) are NOT touched by this function.

create or replace function reset_demo_data() returns void
language plpgsql security definer set search_path = public as $$
declare
  d date := (now() at time zone 'Asia/Tokyo')::date;
begin
  -- date + time literals below are local JST timestamps
  perform set_config('timezone', 'Asia/Tokyo', true);
  truncate table alarms, deviations, temperature_readings, temperature_imports, accepted_deliveries,
    shipment_checks, allocations, orders, lot_events, inbound_inspections, lots, routes, agreements,
    locations, devices, skus, suppliers, customers, audit_logs restart identity cascade;

  insert into skus values
    ('AMB-001','新潟県産包装精米5kg','bag','ambient','best_before','rice','出所＋取引（米トレーサビリティ法）'),
    ('AMB-002','玄米せんべい12枚','pack','ambient','best_before','internal',null),
    ('AMB-003','レトルト野菜カレー200g','pouch','ambient','best_before','internal',null),
    ('AMB-004','ほうじ茶ティーバッグ20包','box','ambient','best_before','internal',null),
    ('CHI-001','国産牛スライス200g','tray','chilled','use_by','beef','牛個体識別番号（10桁）'),
    ('CHI-002','プレーンヨーグルト400g','cup','chilled','best_before','internal',null),
    ('CHI-003','絹ごし豆腐300g','pack','chilled','use_by','internal',null),
    ('CHI-004','カットサラダ150g','bag','chilled','use_by','internal',null),
    ('FRO-001','冷凍えび餃子12個','bag','frozen','best_before','internal',null),
    ('FRO-002','バニラアイス120ml','cup','frozen','best_before','internal',null),
    ('FRO-003','冷凍うどん5食','bag','frozen','best_before','internal',null),
    ('FRO-004','冷凍枝豆400g','bag','frozen','best_before','internal',null);

  insert into suppliers values
    ('SUP-001','越後米穀株式会社'), ('SUP-002','北の大地ミート株式会社'),
    ('SUP-003','関東デイリーフーズ株式会社'), ('SUP-004','みなと冷凍食品株式会社'),
    ('SUP-005','さくら食品工業株式会社');

  insert into customers values
    ('CUS-001','さくらマート本店'), ('CUS-002','ひまわりストア駅前店'), ('CUS-003','あおばスーパー中央店'),
    ('CUS-004','こだまフレッシュ北口店'), ('CUS-005','みどり屋マーケット');

  insert into agreements (agreement_id, customer_id, sku_id, delivery_term, delivery_window_rule) values
    ('AGR-001','CUS-001','AMB-001','at_door','ONE_THIRD'), ('AGR-002','CUS-001','CHI-001','at_door','ONE_HALF'),
    ('AGR-003','CUS-001','FRO-001','at_door','LABEL_DATE_ONLY'), ('AGR-004','CUS-002','AMB-002','on_truck','ONE_THIRD'),
    ('AGR-005','CUS-002','CHI-003','on_truck','ONE_HALF'), ('AGR-006','CUS-002','FRO-002','on_truck','LABEL_DATE_ONLY'),
    ('AGR-007','CUS-003','CHI-002','at_door','ONE_HALF'), ('AGR-008','CUS-003','CHI-004','at_door',null),
    ('AGR-009','CUS-003','FRO-003','at_door','LABEL_DATE_ONLY'), ('AGR-010','CUS-004','AMB-003','on_truck','ONE_THIRD'),
    ('AGR-011','CUS-004','CHI-001','on_truck','ONE_HALF'), ('AGR-012','CUS-004','FRO-004','on_truck','LABEL_DATE_ONLY'),
    ('AGR-013','CUS-005','AMB-004','at_door','ONE_THIRD'), ('AGR-014','CUS-005','CHI-002','at_door',null),
    ('AGR-015','CUS-005','FRO-001','at_door','LABEL_DATE_ONLY');

  insert into locations (location_id, zone, temperature_band, is_quarantine) values
    ('A-01-01','A','ambient',false), ('A-02-01','A','ambient',false), ('A-03-01','A','ambient',false),
    ('C-01-01','C','chilled',false), ('C-02-01','C','chilled',false), ('C-03-01','C','chilled',false),
    ('C-Q-01','C','chilled',true),
    ('F-01-01','F','frozen',false), ('F-02-01','F','frozen',false), ('F-03-01','F','frozen',false),
    ('F-04-01','F','frozen',false), ('F-Q-01','F','frozen',true);

  insert into devices values ('DL-A01','A','ambient'), ('DL-C01','C','chilled'), ('DL-F01','F','frozen');

  insert into lots (lot_id, sku_id, supplier_id, supplier_lot, received_at, production_date, expiry_date,
                    qty_received, qty_available, location_id, status, rice_origin, beef_individual_id) values
    ('LOT-S-0001','AMB-001','SUP-001','NIG-0412',(d-100)+time '09:00',d-120,d+240,50,50,'A-01-01','available','新潟県',null),
    ('LOT-S-0002','AMB-001','SUP-001','NIG-0901',(d-20)+time '09:00',d-30,d+330,60,60,'A-01-01','available','新潟県',null),
    ('LOT-S-0003','AMB-002','SUP-005','GS-1188',(d-25)+time '09:30',d-30,d+150,80,68,'A-02-01','available',null,null),
    ('LOT-S-0004','AMB-003','SUP-005','RC-2201',(d-15)+time '10:00',d-20,d+340,40,40,'A-03-01','available',null,null),
    ('LOT-S-0005','AMB-004','SUP-005','HT-0315',(d-8)+time '10:00',d-10,d+350,30,30,'A-03-01','available',null,null),
    ('LOT-S-0006','CHI-001','SUP-002','BF-7701',(d-1)+time '06:30',d-2,d+6,20,20,'C-01-01','available',null,'1234567890'),
    ('LOT-S-0007','CHI-001','SUP-002','BF-7702',d+time '06:30',d-1,d+8,15,15,'C-01-01','available',null,'1234567891'),
    ('LOT-S-0008','CHI-002','SUP-003','YG-3301',(d-8)+time '07:00',d-10,d+43,30,30,'C-02-01','available',null,null),
    ('LOT-S-0009','CHI-002','SUP-003','YG-3355',(d-3)+time '07:00',d-5,d+52,40,40,'C-02-01','available',null,null),
    ('LOT-S-0010','CHI-002','SUP-003','YG-2980',(d-38)+time '07:00',d-40,d+5,25,25,'C-02-01','available',null,null),
    ('LOT-S-0011','CHI-003','SUP-003','TF-0101',(d-2)+time '07:30',d-3,d+1,30,30,'C-03-01','available',null,null),
    ('LOT-S-0012','CHI-003','SUP-003','TF-0105',d+time '07:30',d-1,d+6,25,25,'C-03-01','available',null,null),
    ('LOT-S-0013','CHI-004','SUP-005','SL-4410',d+time '07:45',d-1,d+4,20,20,'C-03-01','available',null,null),
    ('LOT-S-0014','FRO-001','SUP-004','GY-8802',(d-55)+time '08:00',d-60,d+300,40,40,'F-Q-01','quarantine',null,null),
    ('LOT-S-0015','FRO-001','SUP-004','GY-9010',(d-25)+time '08:00',d-30,d+330,50,50,'F-01-01','available',null,null),
    ('LOT-S-0016','FRO-002','SUP-004','IC-5501',(d-18)+time '08:15',d-20,d+700,30,30,'C-02-01','available',null,null),
    ('LOT-S-0017','FRO-002','SUP-004','IC-5530',(d-8)+time '08:15',d-10,d+710,30,30,'F-02-01','available',null,null),
    ('LOT-S-0018','FRO-003','SUP-004','UD-1201',(d-12)+time '08:30',d-15,d+345,40,40,'F-03-01','available',null,null),
    ('LOT-S-0019','FRO-004','SUP-004','ED-0707',(d-35)+time '08:30',d-40,d+320,60,50,'F-04-01','available',null,null);

  insert into lot_events (lot_id, event_type, detail, actor, created_at)
    select lot_id, 'received', jsonb_build_object('source','demo_seed'), 'seed', received_at from lots;

  insert into orders (order_id, customer_id, sku_id, qty, requested_date, delivery_term, status, allocated_lot_id) values
    ('ORD-1001','CUS-003','CHI-002',20,d+2,'at_door','created',null),
    ('ORD-1002','CUS-001','AMB-001',10,d+2,'at_door','created',null),
    ('ORD-1003','CUS-003','CHI-004',5,d+2,'at_door','created',null),
    ('ORD-1004','CUS-002','CHI-003',10,d+2,'on_truck','created',null),
    ('ORD-1005','CUS-002','FRO-002',15,d+2,'on_truck','created',null),
    ('ORD-1006','CUS-004','CHI-001',5,d+2,'on_truck','created',null),
    ('ORD-1007','CUS-005','FRO-001',20,d+2,'at_door','created',null),
    ('ORD-1008','CUS-001','CHI-001',4,d+2,'at_door','created',null),
    ('ORD-1009','CUS-004','FRO-004',10,d+1,'on_truck','dispatched','LOT-S-0019'),
    ('ORD-1010','CUS-002','AMB-002',12,d+1,'on_truck','allocated','LOT-S-0003');

  insert into allocations (order_id, lot_id, qty, decided_by, created_at) values
    ('ORD-1009','LOT-S-0019',10,'seed',(d-1)+time '15:00'), ('ORD-1010','LOT-S-0003',12,'seed',(d-1)+time '15:10');
  insert into lot_events (lot_id, event_type, detail, actor, created_at) values
    ('LOT-S-0019','allocated','{"order_id":"ORD-1009","qty":10}','seed',(d-1)+time '15:00'),
    ('LOT-S-0003','allocated','{"order_id":"ORD-1010","qty":12}','seed',(d-1)+time '15:10'),
    ('LOT-S-0019','shipped','{"order_id":"ORD-1009"}','seed',d+time '06:10');
  insert into shipment_checks (order_id, vehicle_temp, cargo_temp, seal_no, result, checked_by, checked_at) values
    ('ORD-1009',-20.0,-19.0,'SL-55012','passed','seed',d+time '06:05');

  -- DR-HIST-01 accepted delivery history (rows from before go-live are "migrated", lot unknown)
  insert into accepted_deliveries (customer_id, sku_id, lot_id, expiry_date, qty, delivery_term, recipient_name,
                                   evidence, completed_by, completed_at) values
    ('CUS-003','CHI-002',null,d+45,20,'at_door','受付 田中','{"source":"migration"}','seed',(d-3)+time '10:20'),
    ('CUS-001','AMB-001',null,d+200,10,'at_door','受付 山本','{"source":"migration"}','seed',(d-10)+time '11:00'),
    ('CUS-004','CHI-001',null,d+3,6,'on_truck','店長 佐々木','{"source":"migration"}','seed',(d-2)+time '09:40'),
    ('CUS-002','FRO-002',null,d+690,15,'on_truck','受付 伊藤','{"source":"migration"}','seed',(d-15)+time '14:00'),
    ('CUS-005','FRO-001',null,d+320,20,'at_door','受付 小林','{"source":"migration"}','seed',(d-7)+time '13:30'),
    ('CUS-002','CHI-003',null,d+2,10,'on_truck','受付 伊藤','{"source":"migration"}','seed',(d-1)+time '10:00');

  -- Past temperature incidents: one closed (released), one still open for LOT-S-0014.
  insert into deviations (source, zone, description, affected_lots, status, investigation, corrective_action,
                          decision, rationale, decided_by, closed_at, created_at) values
    ('alarm','C','DL-C01 冷蔵帯 6.8℃ を検知（扉の閉め忘れ）', array['LOT-S-0008'], 'closed',
     '扉の閉め忘れ 12分。製品温度は 4.1℃ で再測定。', '扉センサーの点検、作業手順の再教育',
     'release', '製品温度が基準内に収まっており品質影響なしと判断', 'seed', (d-6)+time '10:30', (d-6)+time '09:50'),
    ('alarm','F','DL-F01 冷凍帯 -12.5℃ を検知', array['LOT-S-0014'], 'open',
     '霜取り運転の延長を確認中', null, null, null, null, null, (d-1)+time '14:20');
  insert into alarms (device_id, zone, first_at, last_at, peak_c, reading_count, status, reviewed_at, reviewed_by,
                      deviation_id, created_at) values
    ('DL-C01','C',(d-6)+time '09:30',(d-6)+time '09:45',6.8,2,'closed',(d-6)+time '09:38','seed',1,(d-6)+time '09:31'),
    ('DL-F01','F',(d-1)+time '14:00',(d-1)+time '14:15',-12.5,2,'acknowledged',(d-1)+time '14:09','seed',2,(d-1)+time '14:01');
  insert into lot_events (lot_id, event_type, detail, actor, created_at) values
    ('LOT-S-0014','quarantined','{"deviation_id":2,"reason":"DL-F01 冷凍帯逸脱"}','system',(d-1)+time '14:01'),
    ('LOT-S-0014','moved','{"from":"F-01-01","to":"F-Q-01"}','seed',(d-1)+time '14:30');

  insert into routes (route_id, route_date, driver_name, vehicle, start_time, prev_route_end, segments, status,
                      rule_version, published_at, published_by) values
    ('R-001',d+1,'佐藤 一郎','4t冷蔵 1号車',(d+1)+time '06:00',d+time '18:00',
     '[{"kind":"work","minutes":60,"note":"積込"},{"kind":"drive","minutes":120},{"kind":"work","minutes":30,"note":"納品 CUS-001"},
       {"kind":"break","minutes":30},{"kind":"drive","minutes":150},{"kind":"work","minutes":30,"note":"納品 CUS-003"},
       {"kind":"break","minutes":45},{"kind":"drive","minutes":120},{"kind":"work","minutes":30,"note":"帰庫・点検"}]',
     'published','改善基準告示 2024-04（簡易版 v1）',d+time '17:00','seed'),
    ('R-002',d+1,'鈴木 次郎','4t冷凍 2号車',(d+1)+time '05:00',d+time '19:00',
     '[{"kind":"work","minutes":45,"note":"積込"},{"kind":"drive","minutes":150},{"kind":"work","minutes":20,"note":"納品"},
       {"kind":"break","minutes":10},{"kind":"drive","minutes":100},{"kind":"work","minutes":30,"note":"納品"},
       {"kind":"break","minutes":60},{"kind":"drive","minutes":90},{"kind":"work","minutes":30,"note":"帰庫"}]',
     'draft',null,null,null),
    ('R-003',d+1,'高橋 三郎','10t冷凍 3号車',(d+1)+time '04:00',(d-1)+time '16:00',
     '[{"kind":"work","minutes":60,"note":"積込"},{"kind":"drive","minutes":180},{"kind":"break","minutes":30},
       {"kind":"drive","minutes":180},{"kind":"work","minutes":60,"note":"納品"},{"kind":"break","minutes":60},
       {"kind":"drive","minutes":180},{"kind":"break","minutes":30},{"kind":"drive","minutes":60},{"kind":"work","minutes":90,"note":"帰庫・洗車"}]',
     'draft',null,null,null),
    ('R-004',d+1,'田中 四郎','2t冷蔵 4号車',(d+1)+time '06:00',d+time '22:00',
     '[{"kind":"work","minutes":30,"note":"積込"},{"kind":"drive","minutes":90},{"kind":"work","minutes":30,"note":"納品"},
       {"kind":"break","minutes":45},{"kind":"drive","minutes":90},{"kind":"work","minutes":20,"note":"帰庫"}]',
     'draft',null,null,null);

  insert into audit_logs (actor, action, target, detail) values ('system','demo_data_reset','all','{}');
end $$;

revoke all on function reset_demo_data() from public, anon, authenticated;
grant execute on function reset_demo_data() to service_role;

select reset_demo_data();

-- >>> supabase/migrations/0004_demo_users.sql
-- Demo accounts for reviewers (test values only — see README.md).
-- Passwords are bcrypt-hashed by pgcrypto; the app verifies them with bcryptjs.
insert into app_users (login_id, display_name, role, password_hash) values
  ('admin',      '管理者 デモ',      'admin',      extensions.crypt('YukiDemo#2026', extensions.gen_salt('bf'))),
  ('receiving',  '入荷担当 デモ',    'receiving',  extensions.crypt('YukiDemo#2026', extensions.gen_salt('bf'))),
  ('dispatcher', '配送計画者 デモ',  'dispatcher', extensions.crypt('YukiDemo#2026', extensions.gen_salt('bf'))),
  ('qa',         '品質管理 デモ',    'qa',         extensions.crypt('YukiDemo#2026', extensions.gen_salt('bf'))),
  ('auditor',    '監査者 デモ',      'auditor',    extensions.crypt('YukiDemo#2026', extensions.gen_salt('bf')))
on conflict (login_id) do update
  set password_hash = excluded.password_hash, role = excluded.role, display_name = excluded.display_name,
      active = true;
