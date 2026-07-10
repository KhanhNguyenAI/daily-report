import { useState } from "react"
import { toast } from "sonner"

import { downloadBackup } from "@/api/notes"
import { ThemeToggle } from "@/components/theme-toggle"
import { Button } from "@/components/ui/button"
import { Toaster } from "@/components/ui/sonner"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Journal } from "@/pages/Journal"
import { Reports } from "@/pages/Reports"
import { Timeline } from "@/pages/Timeline"

export default function App() {
  const [exporting, setExporting] = useState(false)
  const [tab, setTab] = useState("today")

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
    <div className="mx-auto min-h-screen max-w-5xl px-4 py-8">
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

      <Tabs value={tab} onValueChange={setTab}>
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
          <Journal onReportCreated={() => setTab("reports")} />
        </TabsContent>
        <TabsContent value="timeline">
          <Timeline />
        </TabsContent>
        <TabsContent value="reports">
          <Reports />
        </TabsContent>
      </Tabs>

      <Toaster />
    </div>
  )
}
