# TakeNote — Nhật ký thực tập + AI báo cáo

Ứng dụng web ghi chú hằng ngày trong kỳ intern (như nhật ký cá nhân), sau đó AI (Gemini)
tổng hợp thành báo cáo chuyên nghiệp để gửi mentor/người khác đọc.

## 1. Kiến trúc tổng thể

```
┌─────────────┐      HTTPS       ┌──────────────┐        ┌─────────────┐
│  Frontend    │ ───────────────▶ │   Backend     │ ─────▶ │  Gemini API  │
│  React+Vite  │   REST (JSON)    │   FastAPI     │        └─────────────┘
│  shadcn/ui   │                  │  (Render/     │        ┌─────────────┐
│  (Vercel)    │                  │   Koyeb)      │ ─────▶ │  Firestore   │
└─────────────┘                  └──────────────┘        │  (Firebase)  │
                                                         └─────────────┘
```

- **Frontend**: React + Vite + TypeScript + TailwindCSS + **shadcn/ui**.
  Tận dụng component có sẵn (Textarea, Card, Calendar, Dialog, Badge, Tabs, Toast,
  shadcn Charts cho trang Insights) thay vì tự code UI mới. Deploy miễn phí trên Vercel.
- **Backend**: Python FastAPI + Pydantic + `firebase-admin` SDK. Deploy trên Render (free tier)
  hoặc Koyeb. Lưu ý: Render free "ngủ" sau 15 phút idle (cold start ~30-50s). Khắc phục:
  UptimeRobot ping mỗi 10 phút, hoặc dùng Koyeb/Fly.io.
- **Database**: **Firebase Firestore** (gói Spark, free). Chọn vì luôn chạy 24/7, không bao giờ
  pause hay cần khôi phục thủ công. Free tier: 1GB, 50k reads + 20k writes/ngày — dư sức cho
  1 user. NoSQL dạng document, rất hợp mô hình nhật ký. Dùng được từ local ngay ngày đầu
  nên không cần bước migrate DB khi deploy.
- **AI**: Google Gemini API (`google-genai` SDK, model `gemini-3.5-flash` — free tier đủ dùng).
- **Auth** (Giai đoạn 3): đăng nhập thường (password → JWT) + đăng nhập Google qua Firebase Auth
  (frontend lấy ID token, backend verify bằng firebase-admin).
- **Repo**: https://github.com/KhanhNguyenAI/daily-report

## 2. Cấu trúc thư mục

```
takenote/
├── backend/
│   ├── app/
│   │   ├── main.py            # FastAPI app, CORS, router
│   │   ├── config.py          # đọc env vars (Firebase credentials, GEMINI_API_KEY, JWT secret)
│   │   ├── firebase.py        # khởi tạo firebase-admin, Firestore client
│   │   ├── schemas.py         # Pydantic schemas (validate request/response)
│   │   ├── auth.py            # login, JWT
│   │   ├── routers/
│   │   │   ├── notes.py       # CRUD ghi chú
│   │   │   └── reports.py     # tạo & xem báo cáo
│   │   └── services/
│   │       └── ai_report.py   # gọi Gemini, prompt engineering
│   ├── requirements.txt
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── pages/             # Journal, Timeline, Reports
│   │   ├── components/
│   │   │   └── ui/            # component shadcn/ui (thêm qua CLI: npx shadcn add ...)
│   │   ├── lib/               # utils của shadcn (cn helper)
│   │   ├── api/               # client gọi backend
│   │   └── App.tsx
│   └── ...
└── PLAN.md
```

## 3. Data model (Firestore collections)

**Collection `notes`** — mỗi document là một ghi chú (có thể nhiều note/ngày)
| field | kiểu | ghi chú |
|---|---|---|
| date | string "YYYY-MM-DD" | ngày làm việc (string để query dễ) |
| content | string | nội dung tự do, viết như nhật ký |
| mood | number (1-5) | cảm xúc hôm đó (tuỳ chọn) |
| tags | array<string> | vd: "bug", "meeting", "học được" |
| created_at | timestamp | |

**Collection `reports`** — báo cáo do AI sinh ra
| field | kiểu | ghi chú |
|---|---|---|
| type | string: "daily" / "weekly" | |
| period_start, period_end | string "YYYY-MM-DD" | |
| content | string (markdown) | báo cáo đã sinh |
| insights | map | mood trend, khó khăn lặp lại, gợi ý |
| created_at | timestamp | |

(ID document dùng auto-ID của Firestore. Cần composite index cho query notes theo
khoảng ngày + sắp xếp created_at — Firestore sẽ tự gợi ý link tạo index khi chạy lần đầu.)

## 4. API endpoints

- `POST /auth/login` → JWT
- `GET/POST/PUT/DELETE /notes` (+ filter theo ngày/khoảng ngày)
- `POST /reports/daily?date=...` — sinh báo cáo ngày
- `POST /reports/weekly?week=...` — sinh báo cáo tuần
- `GET /reports` / `GET /reports/{id}`
- `GET /insights` — mood trend + khó khăn lặp lại (dữ liệu cho chart)
- `GET /export` — tải toàn bộ notes + reports về máy (backup cá nhân, chống mất dữ liệu cloud):
  file ZIP gồm `data.json` (đầy đủ, dùng để khôi phục) + mỗi ngày một file Markdown
  (`2026-07-14.md`, đọc lại được như nhật ký). Frontend có nút "Export backup".

## 5. Thiết kế AI (phần quan trọng nhất)

Yêu cầu cốt lõi: **input là nhật ký cá nhân (thân mật, lộn xộn, cảm xúc) → output là báo cáo
cho người khác đọc (lịch sự, rõ ràng, chuyên nghiệp)**. AI phải có "tư duy chuyển đổi":

Prompt cho báo cáo ngày gồm 2 bước tư duy:
1. **Phân tích**: đọc toàn bộ note trong ngày, tách ra: (a) công việc đã làm, (b) kết quả/tiến độ,
   (c) khó khăn gặp phải, (d) điều học được, (e) cảm xúc — loại bỏ ngôn ngữ quá cá nhân.
2. **Viết lại**: format báo cáo chuẩn:
   - **Tóm tắt ngày** (2-3 câu)
   - **Công việc đã thực hiện** (bullet, ngôn ngữ chuyên nghiệp)
   - **Khó khăn & cách xử lý**
   - **Bài học / kiến thức mới**
   - **Kế hoạch tiếp theo** (nếu note có nhắc)
   Quy tắc: viết ngôi thứ nhất lịch sự, không chèn cảm xúc tiêu cực thô, không bịa thông tin
   không có trong note, giữ thuật ngữ kỹ thuật chính xác.

Báo cáo tuần: input là 7 báo cáo ngày (hoặc note thô cả tuần), output thêm phần
**tiến bộ trong tuần** và **mục tiêu tuần tới**.

Phân tích cảm xúc & khó khăn (chạy kèm, trả về JSON riêng): mood theo ngày,
các vấn đề lặp lại ≥2 lần, gợi ý cải thiện — hiển thị bằng chart ở trang Insights.

## 6. Giao diện (3 trang chính)

1. **Journal (hôm nay)**: editor viết note nhanh, chọn mood emoji, thêm tag, danh sách note trong ngày.
2. **Timeline**: lịch/danh sách các ngày đã ghi, click xem lại.
3. **Reports & Insights**: nút "Tạo báo cáo ngày/tuần", xem báo cáo (markdown), nút copy/export,
   chart mood theo thời gian.

## 7. Lộ trình thực hiện (phù hợp bắt đầu intern tuần tới)

- **Giai đoạn 1 — MVP local (làm ngay, ~1-2 buổi)**
  Tạo project Firebase + service account; Backend FastAPI kết nối Firestore + CRUD notes
  + endpoint `/export`; Frontend trang Journal + nút Export backup.
  → Tuần tới đi intern là ghi note được ngay, dữ liệu ở cloud và backup được về máy.
- **Giai đoạn 2 — AI báo cáo (~1-2 buổi)**
  Tích hợp Gemini, báo cáo ngày trước, rồi báo cáo tuần. Tinh chỉnh prompt bằng note thật.
- **Giai đoạn 3 — Deploy online**
  Thêm auth JWT, deploy Render/Koyeb + Vercel (DB đã trên Firebase sẵn, không cần migrate),
  cấu hình UptimeRobot ping backend nếu dùng Render.
- **Giai đoạn 4 — Insights & polish**
  Chart mood, phân tích khó khăn lặp lại, export báo cáo, UI đẹp hơn.

## 8. Chuẩn bị cần có

- API key Gemini: lấy miễn phí tại https://aistudio.google.com/apikey
- Tài khoản Firebase (console.firebase.google.com — tạo project, bật Firestore, tải
  service account key JSON), Render (hoặc Koyeb), Vercel (đều free, dùng GitHub/Google login)
- Python 3.11+, Node.js 20+ trên máy
