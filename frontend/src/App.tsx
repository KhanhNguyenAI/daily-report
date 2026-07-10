import { useState } from "react"
import { toast } from "sonner"

import { downloadBackup } from "@/api/notes"
import { ThemeToggle } from "@/components/theme-toggle"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Toaster } from "@/components/ui/sonner"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Journal } from "@/pages/Journal"

function ComingSoon({ phase }: { phase: string }) {
  return (
    <Card>
      <CardContent className="py-14 text-center">
        <div className="mb-2 text-3xl">🌱</div>
        <p className="text-sm text-muted-foreground">Coming soon — planned for {phase}.</p>
      </CardContent>
    </Card>
  )
}

export default function App() {
  const [exporting, setExporting] = useState(false)

  async function handleExport() {
    setExporting(true)
    try {
      await downloadBackup()
      toast.success("Backup downloaded")
    } catch {
      toast.error("Export failed. Is the backend running?")
    } finally {
      setExporting(false)
    }
  }

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    day: "2-digit",
    month: "short",
    year: "numeric",
  })

  return (
    <div className="mx-auto min-h-screen max-w-3xl px-4 py-8">
      <header className="mb-8 flex items-center gap-3">
        <div className="grid size-9 place-items-center rounded-xl bg-primary text-base font-bold text-primary-foreground shadow-sm">
          T
        </div>
        <div>
          <h1 className="text-lg font-semibold leading-tight tracking-tight">TakeNote</h1>
          <p className="text-xs text-muted-foreground">{today}</p>
        </div>
        <div className="flex-1" />
        <Button
          variant="outline"
          size="sm"
          className="rounded-full"
          onClick={handleExport}
          disabled={exporting}
        >
          {exporting ? "Exporting…" : "⬇ Export backup"}
        </Button>
        <ThemeToggle />
      </header>

      <Tabs defaultValue="today">
        <TabsList className="mb-5 rounded-full p-1">
          <TabsTrigger value="today" className="rounded-full px-4">
            ✏️ Today
          </TabsTrigger>
          <TabsTrigger value="timeline" className="rounded-full px-4">
            📅 Timeline
          </TabsTrigger>
          <TabsTrigger value="reports" className="rounded-full px-4">
            📄 Reports &amp; Insights
          </TabsTrigger>
        </TabsList>
        <TabsContent value="today">
          <Journal />
        </TabsContent>
        <TabsContent value="timeline">
          <ComingSoon phase="Phase 4" />
        </TabsContent>
        <TabsContent value="reports">
          <ComingSoon phase="Phase 2 (AI reports in English / 日本語 / Tiếng Việt)" />
        </TabsContent>
      </Tabs>

      <Toaster />
    </div>
  )
}
