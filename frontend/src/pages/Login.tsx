import { useState } from "react"
import { toast } from "sonner"

import { useAuth } from "@/lib/auth"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"

export function Login() {
  const { signIn } = useAuth()
  const [busy, setBusy] = useState(false)

  async function handleSignIn() {
    setBusy(true)
    try {
      await signIn()
    } catch {
      toast.error("Sign-in failed. Please try again.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="grid min-h-screen place-items-center px-4">
      <Card className="w-full max-w-sm shadow-sm">
        <CardContent className="grid gap-5 py-10 text-center">
          <div className="mx-auto grid size-12 place-items-center rounded-2xl bg-primary text-xl font-bold text-primary-foreground shadow-sm">
            T
          </div>
          <div>
            <h1 className="text-xl font-semibold tracking-tight">TakeNote</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Your internship journal, turned into polished reports.
            </p>
          </div>
          <Button className="rounded-full" onClick={handleSignIn} disabled={busy}>
            {busy ? "Signing in…" : "Sign in with Google"}
          </Button>
          <p className="text-xs text-muted-foreground">
            Your notes are private to your account.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
