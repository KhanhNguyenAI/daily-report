import { initializeApp } from "firebase/app"
import { getAuth, GoogleAuthProvider, type Auth } from "firebase/auth"

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

/** Auth bật khi có config Firebase. Thiếu config = chế độ dev, không cần đăng nhập. */
export const authEnabled = Boolean(config.apiKey && config.authDomain && config.projectId)

export const auth: Auth | null = authEnabled ? getAuth(initializeApp(config)) : null
export const googleProvider = new GoogleAuthProvider()
