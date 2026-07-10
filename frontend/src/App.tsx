import { useState } from "react"
import { toast } from "sonner"

import { downloadBackup } from "@/api/notes"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Toaster } from "@/components/ui/sonner"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Journal } from "@/pages/Journal"

function ComingSoon({ phase }: { phase: string }) {
  return (
    <Card>
      <CardContent className="py-10 text-center text-sm text-muted-foreground">
        Coming soon — planned for {phase}.
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
    <div className="mx-auto min-h-screen max-w-4xl px-4 py-6">
      <header className="mb-5 flex items-center gap-3">
        <div className="grid size-7 place-items-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">
          T
        </div>
        <h1 className="text-base font-semibold">TakeNote</h1>
        <span className="text-sm text-muted-foreground">{today}</span>
        <div className="flex-1" />
        <Button variant="outline" size="sm" onClick={handleExport} disabled={exporting}>
          {exporting ? "Exporting…" : "⬇ Export backup"}
        </Button>
      </header>

      <Tabs defaultValue="today">
        <TabsList className="mb-4">
          <TabsTrigger value="today">✏️ Today</TabsTrigger>
          <TabsTrigger value="timeline">📅 Timeline</TabsTrigger>
          <TabsTrigger value="reports">📄 Reports &amp; Insights</TabsTrigger>
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
