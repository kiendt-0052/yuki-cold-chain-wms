# 食品コールドチェーン業務支援システム — Prototype (LAB-2)

Prototype chạy thật cho đề **Product B — chuỗi kho lạnh thực phẩm** (khách hư cấu: ユキコールドロジスティクス株式会社).
Stack cố định: **Next.js 16 (App Router) · Vercel · Supabase (PostgreSQL)**. Giao diện tiếng Nhật.

| Mục | Link |
|---|---|
| App (Vercel) | **https://__ĐIỀN_SAU_KHI_DEPLOY__.vercel.app** — mở lên là gặp màn hình đăng nhập |
| Supabase project | **https://supabase.com/dashboard/project/__PROJECT_REF__** |
| Danh sách màn hình bản chốt + phần mock | [docs/screen-feature-list.md](docs/screen-feature-list.md) |

## Tài khoản demo (dùng được tới hết LAB-6)

Mật khẩu chung: **`YukiDemo#2026`**

| Login ID | Vai trò | Quyền ghi |
|---|---|---|
| `admin` | システム管理者 | Tất cả (gồm sửa hợp đồng, khởi tạo lại dữ liệu demo) |
| `dispatcher` | 配送計画者 | Phân bổ lot, xuất kho, POD, lập tuyến |
| `qa` | 品質管理 | Cách ly / giải phóng / huỷ lot, nhập CSV nhiệt độ, xử lý alarm & deviation |
| `receiving` | 入荷担当 | Kiểm hàng nhập, xuất kho |
| `auditor` | 監査者 | Chỉ xem |

Muốn chạy lại kịch bản từ đầu: đăng nhập `admin` → **デモ管理** → **デモデータを初期化** (ngày trong dữ liệu được tính lại theo hôm nay; tài khoản giữ nguyên).

> **Lỗi kết nối DB / app báo "サーバーエラー" hoặc không tải được dữ liệu?**
> Project Supabase gói Free **tự tạm dừng sau 7 ngày không hoạt động**. Vào Supabase Dashboard → chọn project → bấm **Resume project / Restore project**, chờ 1–2 phút rồi tải lại app.

## Chạy local

Yêu cầu: Node.js 20+ (đã test với Node 24), một project Supabase.

1. **Tạo database**: Supabase Dashboard → **SQL Editor** → dán toàn bộ [`supabase/setup.sql`](supabase/setup.sql) → **Run**.
   (File gộp 4 migration trong `supabase/migrations/`: schema + RLS, hàm Postgres, dữ liệu mock, tài khoản demo. Chạy lại được nhiều lần.)
2. **Tạo `.env.local`** từ `.env.example`:
   ```
   SUPABASE_URL=https://<project-ref>.supabase.co
   SUPABASE_SECRET_KEY=<secret key / service_role key trong Project Settings → API Keys>
   SESSION_SECRET=<chuỗi ngẫu nhiên ≥ 32 ký tự>
   ```
   Tạo `SESSION_SECRET`: `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"`
3. Cài và chạy:
   ```bash
   npm install
   npm run dev
   ```
   Mở http://localhost:3000 → chuyển tới `/login`.
4. Test logic nghiệp vụ: `npm test` (Vitest, 18 test cho phân bổ lot, 拘束時間, nhiệt độ, kiểm hàng, POD).

## Deploy Vercel

Import repo vào Vercel (framework: Next.js, không cần đổi build command) → thêm 3 biến môi trường như `.env.local` → Deploy.

## Kiến trúc tóm tắt

```
Trình duyệt (React client components)
   │ fetch /api/*  (cookie phiên httpOnly)
   ▼
src/proxy.ts  ── chưa đăng nhập → /login (trang) hoặc 401 (API)
   ▼
Route Handlers src/app/api/**  ── kiểm tra lại phiên + quyền theo vai trò
   │ logic nghiệp vụ thuần: src/lib/domain/* (có unit test)
   ▼
Supabase PostgreSQL  ── RLS bật, KHÔNG có policy → chỉ server (secret key) truy cập được
   └ hàm Postgres cho thao tác nguyên tử: allocate_lot, cancel_allocation, record_inbound, reset_demo_data
```

- **Đăng nhập**: bảng `app_users` (mật khẩu bcrypt qua pgcrypto) + cookie JWT ký HS256 (8 giờ). Người lạ mở URL chỉ thấy trang đăng nhập; gọi thẳng `/api/*` nhận 401.
- **Không có dữ liệu cứng trong code**: mọi màn hình đọc/ghi qua API → Supabase. Dữ liệu demo nằm trong `supabase/migrations/0003_demo_seed.sql`.
- **Quy tắc nghiệp vụ** chạy lại phía server trước mỗi lần ghi (không tin client); thao tác giảm tồn kho dùng khoá dòng (`SELECT … FOR UPDATE`) để hai yêu cầu song song không phân bổ trùng.
- **Lịch sử bất biến**: `lot_events`, `audit_logs`, `accepted_deliveries` chỉ ghi thêm.

## Cấu trúc thư mục

```
supabase/              SQL: migrations/ + setup.sql (gộp)
src/proxy.ts           cổng đăng nhập
src/lib/domain/        quy tắc nghiệp vụ thuần + test (allocation-rules, delivery-window, binding-time-check, temperature, inbound-validation, pod-evidence)
src/lib/server/        Supabase client (server-only), phiên, guard API, nạp ngữ cảnh đơn hàng
src/app/api/           25 route handler
src/app/(app)/         14 màn hình nghiệp vụ
public/samples/        CSV mẫu của datalogger
docs/                  danh sách màn hình bản chốt + phần mock
```
