# Hướng dẫn deploy TakeNote

Backend lên **Render**, frontend lên **Vercel**, đăng nhập bằng **Google (Firebase Auth)**.
App đa người dùng: ai đăng nhập Google cũng dùng được, mỗi người có nhật ký riêng.

## 0. Bật đăng nhập Google trong Firebase (làm 1 lần)

1. [console.firebase.google.com](https://console.firebase.google.com) → project `daily-76d37`
2. **Build → Authentication → Get started → Sign-in method → Google → Enable** → Save
3. **Project settings (⚙️) → General → Your apps → Web app (</>)** → đăng ký app tên "takenote"
   → copy đoạn `firebaseConfig` (apiKey, authDomain, projectId, appId) để dùng ở bước Vercel
4. Sau khi có domain Vercel: **Authentication → Settings → Authorized domains → Add domain**
   → thêm domain Vercel (vd `takenote.vercel.app`)

## 1. Backend → Render

1. [render.com](https://render.com) → đăng nhập bằng GitHub
2. **New → Blueprint** → chọn repo `daily-report` (Render tự đọc `backend/render.yaml`)
3. Điền các biến môi trường (Environment):
   - `GEMINI_API_KEY` = key Gemini trong `backend/.env`
   - `GOOGLE_CREDENTIALS_JSON` = **toàn bộ nội dung** file `backend/serviceAccountKey.json`
     (mở file, copy hết, dán vào — Render nhận cả chuỗi JSON nhiều dòng)
   - `CORS_ORIGINS` = URL Vercel (điền sau khi có, vd `https://takenote.vercel.app`)
   - `AUTH_ENABLED` = `true` (đã set sẵn trong blueprint)
4. Deploy. Xong sẽ có URL dạng `https://takenote-api.onrender.com` — kiểm tra `/health`.
5. Lưu ý free tier: backend "ngủ" sau 15 phút idle, request đầu chờ ~30-50s. Muốn tránh:
   dùng [UptimeRobot](https://uptimerobot.com) ping `/health` mỗi 10 phút.

## 2. Frontend → Vercel

1. [vercel.com](https://vercel.com) → đăng nhập GitHub → **Add New → Project** → chọn repo
2. **Root Directory** = `frontend` (Vercel tự nhận Vite)
3. Environment Variables — điền:
   - `VITE_API_URL` = URL Render ở bước 1
   - `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`,
     `VITE_FIREBASE_APP_ID` = từ `firebaseConfig` ở bước 0
4. Deploy → có URL Vercel.
5. **Quay lại**: dán URL Vercel vào `CORS_ORIGINS` của Render (bước 1.3) và vào
   Authorized domains của Firebase (bước 0.4), rồi redeploy Render.

## 3. Kiểm tra

Mở URL Vercel → thấy màn "Sign in with Google" → đăng nhập → ghi note → tạo báo cáo.
Nếu lỗi CORS: kiểm tra `CORS_ORIGINS` khớp đúng URL Vercel (không có dấu `/` ở cuối).

## Chạy local (không đổi gì)

Backend `.env` để `AUTH_ENABLED=false`, frontend không cần `.env.local` →
app bỏ qua đăng nhập, dùng dev-user. Xem [README.md](README.md).
