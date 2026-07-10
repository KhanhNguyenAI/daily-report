import { useEffect, useState } from "react"

import { Button } from "@/components/ui/button"

function initialDark(): boolean {
  const stored = localStorage.getItem("theme")
  if (stored) return stored === "dark"
  return window.matchMedia("(prefers-color-scheme: dark)").matches
}

export function ThemeToggle() {
  const [dark, setDark] = useState(initialDark)

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark)
    localStorage.setItem("theme", dark ? "dark" : "light")
  }, [dark])

  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
      onClick={() => setDark((d) => !d)}
    >
      {dark ? "☀️" : "🌙"}
    </Button>
  )
}
