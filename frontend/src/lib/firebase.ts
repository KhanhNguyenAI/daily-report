import { initializeApp } from "firebase/app"
import { getAuth, GoogleAuthProvider, type Auth } from "firebase/auth"

// Firebase web config là PUBLIC, an toàn để commit — bảo mật đến từ Authorized domains
// + Firestore rules, không phải từ việc giấu apiKey. Cho phép override bằng env nếu cần.
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY ?? "AIzaSyDQiweZtM2VNtyRfDtKOZ1Yk2zbMiYLjAE",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN ?? "daily-76d37.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID ?? "daily-76d37",
  appId:
    import.meta.env.VITE_FIREBASE_APP_ID ??
    "1:816037332970:web:6497b373cdadccd2825493",
}

// Bật đăng nhập ở bản production (Vercel). Local `npm run dev` bỏ qua login (dev mode).
export const authEnabled = import.meta.env.PROD

export const auth: Auth | null = authEnabled ? getAuth(initializeApp(firebaseConfig)) : null
export const googleProvider = new GoogleAuthProvider()
