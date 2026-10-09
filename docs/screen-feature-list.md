# Danh sách màn hình / tính năng — bản chốt LAB-2

> Đối chiếu với LAB-1: `04-screen-list.md` (65 màn), `03-feature-list.md` (79 feature), `05-user-stories.md` (23 story).
> Prototype dựng **14 màn hình** (gộp từ 34 màn LAB-1) phủ **luồng nghiệp vụ lõi** và **cả 4 lỗi nghiêm trọng khi chấm LAB-1** (賞味/消費, 1/3 rule không phải luật, 日付逆転 không so với hôm nay, 拘束時間).

## 1. Màn hình đã dựng (chạy thật, đọc/ghi Supabase)

| # | URL | Màn hình | Màn LAB-1 tương ứng | Feature / Req | Đọc/ghi DB thật |
|---|---|---|---|---|---|
| 1 | `/login` | ログイン | SC-001 | F01-01 (thay SSO bằng tài khoản demo) | Đọc `app_users`, ghi `audit_logs` |
| 2 | `/dashboard` | ダッシュボード | SC-002 | Tổng hợp việc cần làm | Đọc 8 bảng (count) |
| 3 | `/inbound` | 入荷検品 | SC-020/022/023 | F03-02/03/04/05/06/07, FR-REC-02..05, BR-TEMP-02, BR-TRACE-01/02 | RPC `record_inbound` (lot + kiểm hàng + event + deviation trong 1 transaction, idempotent) |
| 4 | `/inventory` | 在庫・ロット照会 | SC-030 | F04-07, FR-INV-06 | Đọc `lots` + join |
| 5 | `/inventory/[lotId]` | ロット詳細・品質ステータス | SC-031/038 | F04-06, FR-INV-05 | Ghi `lots.status`, `lot_events` |
| 6 | `/orders` | 受注一覧 | SC-040 | F06-01/06 | Đọc `orders`, `agreements` |
| 7 | `/orders/[id]` | 引当 → 出荷前チェック → 配送完了(POD) | SC-042/046/047/051 | F05-01..05, F06-02/04/05, F07-02/04, FR-OUT-02/05/06, BR-EXP/DATE/DELWIN/FEFO/POD | RPC `allocate_lot` / `cancel_allocation` (khoá dòng), ghi `shipment_checks`, `accepted_deliveries`, `deviations` |
| 8 | `/deliveries` | 受入済み配送履歴 | SC-043 | F05-05, DR-HIST-01 | Đọc `accepted_deliveries` |
| 9 | `/temperature` | 温度・アラーム（CSV取込・アラームキュー・逸脱一覧） | SC-070/071/073 | F09-01/02/03, FR-TEMP-01..03, IF-LOG-01 | Ghi `temperature_imports/readings`, `alarms`, `deviations`, cách ly `lots` |
| 10 | `/temperature/deviations/[id]` | 逸脱ケース | SC-074 | F09-04, FR-TEMP-04 | Ghi `deviations`, `lots`, `lot_events`, `alarms` |
| 11 | `/trace` | トレース検索 | SC-080/081 | F10-01/02/03, FR-TRC-01 | Đọc `lots`, `accepted_deliveries`, `lot_events` |
| 12 | `/routes`, `/routes/[id]` | 配車・拘束時間チェック | SC-061/062 | F08-03/05/07 (rút gọn), FR-SCH-02/04 | Ghi `routes` (segments, version, publish) |
| 13 | `/masters` | マスター（契約・SKU・仕入先/顧客・ロケーション/機器） | SC-011..015 | F02-01..05, sửa cửa sổ giao của hợp đồng (F02-02) | Đọc 6 bảng, ghi `agreements` |
| 14 | `/audit`, `/admin` | 監査ログ・デモ管理 | SC-094, SC-010 (rút gọn) | F13-01, F01-03 (bảng quyền) | Đọc `audit_logs`, `lot_events`; RPC `reset_demo_data` |

## 2. Kịch bản demo (dữ liệu mock đổ sẵn, ngày tự tính theo hôm nay)

| Kịch bản | Cách xem |
|---|---|
| **日付逆転**: CUS-003 đã nhận CHI-002 hạn D+45 → lot LOT-S-0008 hạn D+43 bị chặn, hiện hộp cảnh báo | `/orders/ORD-1001` → chọn LOT-S-0008 → bấm 引当 |
| **3分の1ルール** (hợp đồng, không phải luật): LOT-S-0001 quá hạn giao | `/orders/ORD-1002` |
| **未設定** (AGR-008): không tự gán quy tắc, bắt nhập lý do xác nhận | `/orders/ORD-1003` |
| **消費期限** chặn cứng / **賞味期限** chỉ cảnh báo | `/orders/ORD-1004` (đậu phụ) so với CHI-002 (sữa chua) |
| **温度帯不一致**: kem lưu ở kho mát bị loại | `/orders/ORD-1005` |
| **隔離**: lot bị cách ly không được phân bổ | `/orders/ORD-1007` |
| **POD 車上渡し vs 軒先渡し** | `/orders/ORD-1009` (車上渡し, đã xuất) hoặc phân bổ ORD-1006/1007 rồi xuất |
| **Nhiệt độ**: tải `samples/logger-DL-F01-sample.csv` → alarm, tự cách ly lot vùng F, lỗi theo dòng, tải lại → không trùng | `/temperature` |
| **拘束時間**: R-002 lái liên tục > 4h, R-003 拘束 > 15h, R-004 nghỉ < 9h → không publish được | `/routes` |
| **Mã bò 9 số** bị từ chối, không tự thêm 0 | `/inbound` (CHI-001) hoặc `/trace` nhập 9 số |

## 3. Để ngoài phạm vi so với LAB-1 (và lý do)

| Hạng mục LAB-1 | Lý do để ngoài |
|---|---|
| F03-01 lịch hẹn nhập (SC-020/021) | Không phải luồng lõi của đề; kiểm hàng thực hiện trực tiếp |
| F04-01/02/03/04/05 put-away, di chuyển, kiểm kê mù | Tập trung vào chất lượng & phân bổ; các luồng này là CRUD kho thông thường |
| F06-03/04 gom task picking, quét mã xếp xe (HT) | Cần máy quét thật; gộp vào bước 出荷前チェック |
| F07-01/03/05/06 lịch trình tài xế, queue offline, claim | Offline/Service Worker và claim là phạm vi lớn, xem mục Mock |
| F08-01/02/04/06 bảng lập tuyến, map API, chèn điểm nghỉ, sự cố | Cần map service có license; prototype nhập sẵn các đoạn tuyến |
| F09-05/06 hồ sơ HACCP đầy đủ, log vệ sinh | Ngoài luồng cảnh báo – sai lệch chính |
| F10-04/05 recall case & thông báo thu hồi | Đã có truy xuất; recall case để LAB sau |
| F11-01/02/03 12 báo cáo, audit export checksum, KPI | Chưa chốt layout báo cáo (Q12) |
| F12 ERP/SFTP, mail, archive | Tích hợp bên thứ ba — xem mục Mock |
| F02-06 quy trình duyệt master (maker/checker) | Chỉ admin sửa master, có audit log |
| F14 công cụ migration | Không thuộc prototype |

## 4. Phần đã mock — nếu làm thật cần gì

| Phần mock | Trong prototype | Nếu làm thật cần |
|---|---|---|
| Đăng nhập | Bảng `app_users` + bcrypt + cookie JWT 8h, 5 tài khoản demo | SSO OIDC với IdP của Yuki (IF-IDP-01), MFA cho vai trò đặc quyền, managed device auth cho tài xế |
| Ảnh kiểm hàng / ảnh POD / file đính kèm deviation | Chỉ lưu **tên file** | Supabase Storage (bucket private), hash khi upload (DR-POD-01), giới hạn dung lượng, vòng đời 3 năm |
| Datalogger | Upload CSV thủ công trên web | Upload có kiểm soát theo ca hoặc batch tự động từ thư mục; live logger/IoT là option ngoài phạm vi |
| Map service (IF-MAP-01) | Không gọi; các đoạn lái nhập tay | API map có license (Yuki cung cấp – Q04), timeout + cache, chặn publish khi số liệu > 24h |
| Kiểm tra 拘束時間 | Chỉ 1 ngày: 13h/15h, lái 9h, liên tục 4h, nghỉ 9h/11h | Đủ 7 ràng buộc: 3.300h/năm, 284h/tháng, 960h tăng ca, TB 2 ngày, 44h/tuần TB 2 tuần; lấy giờ thực từ thiết bị tài xế; pháp chế Yuki xác nhận (OPS-LAW-01) |
| POD offline 8h (NFR-AVL-02) | Không có (cần online) | PWA + Service Worker + IndexedDB mã hoá, đồng bộ idempotent |
| Bộ bằng chứng POD | 2 bộ cố định (車上渡し / 軒先渡し) | Cấu hình theo hợp đồng từng khách sau khi Yuki trả lời Q07 |
| Ngưỡng nhiệt | Cố định 3 dải (chính sách Yuki), mỗi reading ngoài dải là excursion | Policy version theo ngày hiệu lực, ngưỡng thời gian vượt (Q20) |
| Cách ly khi alarm | Cách ly mọi lot "available" trong zone của logger | Xác định lot theo vị trí & thời gian thực tế; di chuyển vật lý sang khu -Q |
| ERP / mail / archive | Không có | CSV qua SFTP (Q05/Q06), mail relay doanh nghiệp, archive có manifest SHA-256 |
| Dữ liệu | Mock theo fixture RFP (R-02, R-04), tên công ty hư cấu, ngày tính tương đối | Migration từ dữ liệu cũ có lineage, chủ nghiệp vụ ký ngoại lệ |
| Hiệu năng / NFR | Không load test | Load test 80 CCU, 300.000 dòng xuất, RTO/RPO, WCAG 2.2 AA |
