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
