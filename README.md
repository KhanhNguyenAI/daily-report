# TakeNote — Nhật ký thực tập + AI báo cáo

Ghi chú hằng ngày trong kỳ intern như nhật ký cá nhân; AI (Gemini) tổng hợp thành
báo cáo chuyên nghiệp theo ngày/tuần. Kế hoạch chi tiết: [PLAN.md](PLAN.md).

**Stack**: React + Vite + TypeScript + Tailwind v4 + shadcn/ui · FastAPI (Python) ·
Firebase Firestore · Gemini API.

## Chạy dev

### Backend (http://localhost:8000)

```powershell
cd backend
.\.venv\Scripts\uvicorn app.main:app --reload --port 8000
```

Lần đầu setup:
1. `python -m venv .venv` rồi `.\.venv\Scripts\pip install -r requirements.txt`
2. Copy `.env.example` → `.env`, điền `GEMINI_API_KEY`
3. Đặt file service account key của Firebase vào `backend/serviceAccountKey.json`
   (Firebase console → Project settings → Service accounts → Generate new private key)

Kiểm tra: mở http://localhost:8000/health — thấy `{"status":"ok"}` là môi trường OK.
API docs tự sinh: http://localhost:8000/docs

### Frontend (http://localhost:5173)

```powershell
cd frontend
npm install
npm run dev
```

Thêm component shadcn/ui mới: `npx shadcn@latest add <tên-component>`

## Lưu ý bảo mật

`backend/.env` và `serviceAccountKey.json` chứa secret — đã nằm trong `.gitignore`,
tuyệt đối không commit.
