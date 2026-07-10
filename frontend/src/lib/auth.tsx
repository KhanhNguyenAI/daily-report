import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"
import { onAuthStateChanged, signInWithPopup, signOut, type User } from "firebase/auth"

import { auth, authEnabled, googleProvider } from "@/lib/firebase"

interface AuthState {
  user: User | null
  loading: boolean
  enabled: boolean
  signIn: () => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(authEnabled)

  useEffect(() => {
    if (!authEnabled || !auth) return
    return onAuthStateChanged(auth, (u) => {
      setUser(u)
      setLoading(false)
    })
  }, [])

  const value = useMemo<AuthState>(
    () => ({
      user,
      loading,
      enabled: authEnabled,
      signIn: async () => {
        if (auth) await signInWithPopup(auth, googleProvider)
      },
      logout: async () => {
        if (auth) await signOut(auth)
      },
    }),
    [user, loading],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth must be used within AuthProvider")
  return ctx
}

/** Lấy Authorization header (Bearer ID token) cho request API; rỗng nếu không bật auth. */
export async function authHeader(): Promise<Record<string, string>> {
  if (!authEnabled || !auth?.currentUser) return {}
  const token = await auth.currentUser.getIdToken()
  return { Authorization: `Bearer ${token}` }
}
