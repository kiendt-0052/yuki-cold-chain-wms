# Quick Report — LAB-2 (Prototype chạy thật)

## 1. Công cụ / skill đã dùng
| Việc | Công cụ |
|---|---|
| Sinh code (frontend, API, SQL, test) | Claude Code (desktop) |
| Đọc thay đổi của Next.js 16 (`proxy.ts` thay `middleware`, Cache Components, `unstable_rethrow`, `instant`) | Tài liệu đi kèm trong `node_modules/next/dist/docs` (theo `AGENTS.md` của dự án) |
| Database | Supabase (SQL Editor chạy `supabase/setup.sql`) |
| Kiểm thử | Vitest (18 unit test cho quy tắc nghiệp vụ); trình duyệt tích hợp của Claude chạy E2E trên localhost với Supabase thật |
| Repo / deploy | `gh` CLI (repo public), Vercel CLI (`vercel link`, `env add`, `deploy --prod`) |

## 2. Chỗ AI sinh sai — cách phát hiện — cách sửa
| # | AI sinh sai | Phát hiện | Sửa |
|---|---|---|---|
| 1 | Wrapper `handle()` của API bắt mọi lỗi → nuốt cả lỗi nội bộ `NEXT_PRERENDER_INTERRUPTED` của Next.js, 25 route bị coi là trả 500 lúc build | `next build` thất bại, đọc stack trace | Gọi `unstable_rethrow(err)` trước khi xử lý lỗi |
| 2 | `usePathname()` trong menu nằm ngoài `<Suspense>` → chặn prerender các trang có tham số động | `next build` báo `CLIENT_HOOK_DYNAMIC` | Tách menu thành component riêng, bọc Suspense |
| 3 | Gọi `setState` đồng bộ trong `useEffect` (hook tải dữ liệu, bộ lọc tồn kho, editor tuyến) và `Date.now()` trong lúc render (đồng hồ đếm ngược alarm) | ESLint (luật React mới) báo 5 lỗi | Chỉ setState trong callback fetch; đọc query bằng `useSearchParams` + Suspense; remount form theo `key`; tính giờ trong effect |
| 4 | Tính "giá trị tệ nhất" của đợt vượt ngưỡng nhiệt bằng `Math.abs` → sai với dải thường (13℃ được coi tệ hơn 27℃) | Tự rà logic khi viết test nhiệt độ | Dùng khoảng cách ra ngoài dải (`outOfBandBy`) |
| 5 | Hash bcrypt "giả" viết tay để chống dò tài khoản theo thời gian → sai định dạng | Rà lại code login | Sinh hash thật bằng `bcrypt.hashSync` |
| 6 | Kiểu quan hệ Supabase (`locations(...)`) được suy là mảng, code giả định là object | `tsc --noEmit` | Ép kiểu qua `unknown` có chú thích |
| 7 | Khung app chỉ render trang sau khi tải xong phiên → Next.js 16 (dev) báo không kiểm tra được "instant navigation" | Console trình duyệt khi test | Luôn render trang; nút ghi tạm khoá tới khi có quyền |
| 8 | `vercel link` tự thêm `.env*` vào cuối `.gitignore`, vô hiệu ngoại lệ `!.env.example` | `git check-ignore .env.example` | Bỏ dòng thừa, kiểm tra lại |
| 9 | Lệnh scaffold dùng tên `Lab2` (npm cấm chữ hoa); vitest xung đột với `@types/node@20` | Lỗi khi chạy lệnh | Đặt tên `yuki-cold-chain-wms`; nâng `@types/node` lên 24 |

**Cách kiểm chứng không nhận nguyên code AI**: test đỏ trước rồi mới viết logic phân bổ; chạy `tsc`, `eslint`, `next build` sau mỗi nhóm file; chạy E2E bằng script trên dữ liệu thật — 8 kịch bản phân bổ, 2 yêu cầu phân bổ song song (chỉ 1 thành công, tồn kho trừ 1 lần), sai quyền (403), nhập CSV trùng, POD thiếu bằng chứng, publish tuyến vi phạm — rồi khởi tạo lại dữ liệu demo.

**Bảo mật**: không đưa secret vào chat/repo; `.env.local` bị ignore; biến môi trường đẩy lên Vercel qua stdin; bảng Supabase bật RLS không policy, chỉ server dùng secret key.

## 3. Số giờ thực tế
| Tuần | Nội dung | Giờ |
|---|---|---|
| Tuần LAB-2 | Chốt phạm vi, dựng app, setup Supabase/Vercel, kiểm thử, tài liệu | ~2 h |
