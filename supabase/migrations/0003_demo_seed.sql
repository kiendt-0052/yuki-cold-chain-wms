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
