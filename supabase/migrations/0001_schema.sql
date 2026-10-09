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
