import { useState } from "react"
import { toast } from "sonner"

import { useAuth } from "@/lib/auth"
import { Button } from "@/components/ui/button"

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="size-4.5 shrink-0">
      <path
        fill="#4285F4"
        d="M23.5 12.27c0-.85-.08-1.66-.22-2.45H12v4.64h6.46a5.53 5.53 0 0 1-2.4 3.62v3h3.88c2.27-2.09 3.56-5.17 3.56-8.81Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.96-1.07 7.94-2.91l-3.88-3c-1.08.72-2.45 1.15-4.06 1.15-3.13 0-5.78-2.11-6.72-4.95H1.27v3.1A12 12 0 0 0 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.28 14.29a7.2 7.2 0 0 1 0-4.58v-3.1H1.27a12 12 0 0 0 0 10.78l4.01-3.1Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.76c1.76 0 3.34.6 4.59 1.8l3.44-3.44A11.97 11.97 0 0 0 12 0 12 12 0 0 0 1.27 6.61l4.01 3.1C6.22 6.87 8.87 4.76 12 4.76Z"
      />
    </svg>
  )
}

const perks = [
  "Quick daily notes, saved to your timeline",
  "AI writes daily & weekly reports in your company's format",
  "One-tap PDF export and copy",
]

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
    <div className="grid min-h-screen place-items-center px-4 py-8">
      <div className="grid w-full max-w-4xl min-h-[34rem] overflow-hidden rounded-3xl border bg-card shadow-[0_24px_60px_-24px_oklch(0.3_0.05_220/30%)] md:grid-cols-[1.1fr_1fr]">
        {/* Brand panel */}
        <aside
          className="relative flex min-h-[20rem] flex-col gap-8 p-8 text-[oklch(0.95_0.01_190)] sm:p-10"
          style={{
            background:
              "radial-gradient(40rem 26rem at 110% -20%, oklch(0.6 0.09 185 / 35%), transparent 60%), linear-gradient(160deg, oklch(0.34 0.045 215), oklch(0.26 0.035 235))",
          }}
        >
          <div className="flex items-center gap-2.5 text-base font-semibold tracking-tight">
            <span className="grid size-8 place-items-center rounded-xl bg-[oklch(0.76_0.085_185)] font-bold text-[oklch(0.22_0.025_240)]">
              T
            </span>
            TakeNote
          </div>

          <div>
            <h2 className="max-w-[18ch] text-balance text-2xl font-semibold leading-snug tracking-tight sm:text-3xl">
              Daily notes,{" "}
              <em className="not-italic text-[oklch(0.82_0.09_180)]">
                reports that write themselves.
              </em>
            </h2>
            <p className="mt-2.5 max-w-[36ch] text-sm leading-relaxed text-[oklch(0.78_0.03_195)]">
              Your internship journal, turned by AI into polished daily and
              weekly reports — in Japanese, English, or Vietnamese.
            </p>
          </div>

          {/* note → report visual */}
          <div className="mt-auto grid gap-2">
            <div className="rounded-xl border border-white/15 bg-[oklch(0.4_0.045_210/55%)] px-4 py-3 text-xs leading-relaxed backdrop-blur-sm">
              <span className="mb-1 block text-[0.62rem] font-semibold uppercase tracking-widest text-[oklch(0.82_0.09_180)]">
                Note · 07/13
              </span>
              <p className="text-[oklch(0.78_0.03_195)]">
                fixed login redirect bug, studied Firestore rules, 30-min team
                sync…
              </p>
            </div>
            <div className="justify-self-center text-sm text-[oklch(0.82_0.09_180)]">
              ▼
            </div>
            <div className="rounded-xl border border-white/15 bg-[oklch(0.4_0.045_210/55%)] px-4 py-3 text-xs leading-relaxed backdrop-blur-sm">
              <span className="mb-1 block text-[0.62rem] font-semibold uppercase tracking-widest text-[oklch(0.82_0.09_180)]">
                日報 · Generated
              </span>
              <p>
                <strong>本日の業務:</strong> ログイン不具合の修正、Firestore
                ルールの学習…
                <br />
                <strong>翌日の予定:</strong> レビュー対応
              </p>
            </div>
          </div>
        </aside>

        {/* Sign-in panel */}
        <main className="flex flex-col justify-center gap-6 p-6 sm:p-11">
          <div>
            <p className="text-[0.68rem] font-semibold uppercase tracking-[0.1em] text-primary">
              Welcome back
            </p>
            <h1 className="mt-1.5 text-2xl font-semibold tracking-tight">
              Sign in to TakeNote
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              One Google account — no passwords, no long forms.
            </p>
          </div>

          <Button
            variant="outline"
            size="lg"
            className="w-full gap-3 rounded-full font-medium transition-shadow hover:border-primary hover:shadow-[0_4px_18px_-6px_oklch(0.5_0.085_192/35%)]"
            onClick={handleSignIn}
            disabled={busy}
          >
            <GoogleIcon />
            {busy ? "Signing in…" : "Continue with Google"}
          </Button>

          <div className="flex items-center gap-3 text-[0.72rem] uppercase tracking-wider text-muted-foreground before:h-px before:flex-1 before:bg-border after:h-px after:flex-1 after:bg-border">
            what you get
          </div>

          <ul className="grid gap-2.5">
            {perks.map((perk) => (
              <li
                key={perk}
                className="flex items-start gap-2.5 text-sm leading-snug text-muted-foreground"
              >
                <span className="mt-0.5 grid size-4.5 shrink-0 place-items-center rounded-full bg-accent text-[0.7rem] font-bold text-primary">
                  ✓
                </span>
                {perk}
              </li>
            ))}
          </ul>

          <p className="text-center text-xs text-muted-foreground">
            Your notes are private to your account.
          </p>
        </main>
      </div>
    </div>
  )
}
