import { useCallback, useEffect, useMemo, useState } from "react"
import { createPortal } from "react-dom"
import ReactMarkdown from "react-markdown"
import { toast } from "sonner"

import { deleteNote, listNotes, updateNote, type Note, type NoteInput } from "@/api/notes"
import {
  createDailyReport,
  downloadReportDocx,
  listReports,
  markdownToPlain,
  savedInstructions,
  saveInstructions,
  savedLanguage,
  type Report,
  type ReportLanguage,
} from "@/api/reports"
import { moodEmoji, NoteCard } from "@/components/note-card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"

const DOW = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"]

const LANGUAGES: { value: ReportLanguage; label: string }[] = [
  { value: "en", label: "English" },
  { value: "ja", label: "日本語" },
  { value: "vi", label: "Tiếng Việt" },
]

function iso(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`
}

interface Cell {
  date: string
  day: number
  inMonth: boolean
}

function buildGrid(year: number, month: number): Cell[] {
  const first = new Date(year, month, 1)
  const offset = (first.getDay() + 6) % 7 // tuần bắt đầu thứ Hai
  const cells: Cell[] = []
  for (let i = 0; i < 42; i++) {
    const d = new Date(year, month, 1 - offset + i)
    cells.push({ date: iso(d), day: d.getDate(), inMonth: d.getMonth() === month })
  }
  return cells.slice(0, cells[35].inMonth ? 42 : 35)
}

export function Timeline() {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth())
  const [selected, setSelected] = useState(iso(now))
  const [notes, setNotes] = useState<Note[]>([])
  const [reports, setReports] = useState<Report[]>([])
  const [language, setLanguage] = useState<ReportLanguage>(savedLanguage)
  const [instructions, setInstructions] = useState(savedInstructions)
  const [generating, setGenerating] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [printing, setPrinting] = useState<Report | null>(null)

  const refresh = useCallback(async () => {
    const start = iso(new Date(year, month, 1))
    const end = iso(new Date(year, month + 1, 0))
    try {
      const [n, r] = await Promise.all([listNotes({ start, end }), listReports()])
      setNotes(n)
      setReports(r)
    } catch {
      toast.error("Could not load notes. Is the backend running?")
    }
  }, [year, month])

  useEffect(() => {
    refresh()
  }, [refresh])

  const byDay = useMemo(() => {
    const m = new Map<string, Note[]>()
    for (const n of notes) m.set(n.date, [...(m.get(n.date) ?? []), n])
    return m
  }, [notes])

  // Báo cáo daily mới nhất của từng ngày
  const reportByDay = useMemo(() => {
    const m = new Map<string, Report>()
    for (const r of reports) {
      if (r.type !== "daily") continue
      const cur = m.get(r.period_start)
      if (!cur || r.created_at > cur.created_at) m.set(r.period_start, r)
    }
    return m
  }, [reports])

  const cells = useMemo(() => buildGrid(year, month), [year, month])
  const dayNotes = byDay.get(selected) ?? []
  const dayReport = reportByDay.get(selected) ?? null
  const monthLabel = new Date(year, month, 1).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  })
  const selectedLabel = new Date(`${selected}T00:00:00`).toLocaleDateString("en-US", {
    weekday: "long",
    day: "2-digit",
    month: "short",
  })

  function shiftMonth(delta: number) {
    const d = new Date(year, month + delta, 1)
    setYear(d.getFullYear())
    setMonth(d.getMonth())
  }

  function pickDay(date: string) {
    setSelected(date)
    setShowForm(false)
  }

  function pickLanguage(l: ReportLanguage) {
    setLanguage(l)
    localStorage.setItem("reportLanguage", l)
  }

  async function generate() {
    setGenerating(true)
    try {
      saveInstructions(instructions)
      const report = await createDailyReport(language, selected, instructions.trim())
      toast.success("Daily report created ✨")
      setReports((cur) => [report, ...cur])
      setShowForm(false)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to create report")
    } finally {
      setGenerating(false)
    }
  }

  function printReport(r: Report) {
    setPrinting(r)
    setTimeout(() => window.print(), 150)
  }

  async function remove(id: string) {
    try {
      await deleteNote(id)
      toast.success("Note deleted")
      await refresh()
    } catch {
      toast.error("Failed to delete note")
    }
  }

  async function update(id: string, changes: Partial<NoteInput>) {
    try {
      await updateNote(id, changes)
      toast.success("Note updated")
      await refresh()
    } catch {
      toast.error("Failed to update note")
    }
  }

  const reportForm = (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-muted-foreground">Language:</span>
        <div className="flex gap-1" role="group" aria-label="Report language">
          {LANGUAGES.map((l) => (
            <button
              key={l.value}
              type="button"
              aria-pressed={language === l.value}
              onClick={() => pickLanguage(l.value)}
              className={`rounded-full border px-3 py-1 text-sm transition ${
                language === l.value
                  ? "border-primary bg-accent font-medium text-accent-foreground"
                  : "border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {l.label}
            </button>
          ))}
        </div>
      </div>
      <Textarea
        placeholder="Format request (optional) — e.g. follow the company template 業務内容／進捗／所感, keep it under 200 words…"
        value={instructions}
        onChange={(e) => setInstructions(e.target.value)}
        maxLength={500}
        className="min-h-16 bg-muted/50 text-sm"
        aria-label="Report format instructions"
      />
      <p className="-mt-1 text-xs text-muted-foreground">
        Shapes the presentation only — content still comes from your notes. Remembered for next time.
      </p>
      <div className="flex gap-2">
        <Button
          className="rounded-full shadow-sm"
          disabled={generating || dayNotes.length === 0}
          onClick={generate}
        >
          {generating ? "Writing report…" : "✨ Create report for this day"}
        </Button>
        {showForm && (
          <Button variant="ghost" className="rounded-full" onClick={() => setShowForm(false)}>
            Cancel
          </Button>
        )}
      </div>
    </div>
  )

  return (
    <div className="grid items-start gap-5 lg:grid-cols-[0.9fr_1.1fr]">
      <Card className="shadow-none">
        <CardContent>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold">{monthLabel}</h2>
            <div className="flex gap-1">
              <Button variant="ghost" size="icon" aria-label="Previous month" onClick={() => shiftMonth(-1)}>
                ‹
              </Button>
              <Button variant="ghost" size="icon" aria-label="Next month" onClick={() => shiftMonth(1)}>
                ›
              </Button>
            </div>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center">
            {DOW.map((d) => (
              <span key={d} className="py-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                {d}
              </span>
            ))}
            {cells.map((c) => {
              const has = byDay.has(c.date)
              const hasReport = reportByDay.has(c.date)
              const isSelected = c.date === selected
              return (
                <button
                  key={c.date}
                  type="button"
                  onClick={() => pickDay(c.date)}
                  className={`relative rounded-lg border-2 py-2 text-sm tabular-nums transition ${
                    !c.inMonth ? "text-muted-foreground/40" : has ? "font-semibold" : "text-muted-foreground"
                  } ${has ? "bg-accent text-accent-foreground" : "hover:bg-muted"} ${
                    hasReport ? "border-primary" : "border-transparent"
                  } ${isSelected ? "ring-2 ring-primary/50" : ""}`}
                >
                  {c.day}
                  {has && (
                    <span className="absolute bottom-1 left-1/2 size-1 -translate-x-1/2 rounded-full bg-primary" />
                  )}
                </button>
              )
            })}
          </div>
          <div className="mt-3 flex flex-wrap gap-4 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <span className="relative inline-block size-3.5 rounded bg-accent">
                <span className="absolute bottom-0.5 left-1/2 size-0.5 -translate-x-1/2 rounded-full bg-primary" />
              </span>
              days with notes
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-block size-3.5 rounded border-2 border-primary" />
              report created
            </span>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-5">
        <div>
          <h2 className="mb-3 px-1 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            {selectedLabel} · {dayNotes.length} {dayNotes.length === 1 ? "note" : "notes"}
            {dayNotes.some((n) => n.mood) && (
              <span className="ml-1 text-sm">
                {moodEmoji(
                  Math.round(
                    dayNotes.filter((n) => n.mood).reduce((s, n) => s + (n.mood as number), 0) /
                      dayNotes.filter((n) => n.mood).length,
                  ),
                )}
              </span>
            )}
          </h2>
          {dayNotes.length === 0 ? (
            <Card className="border-dashed shadow-none">
              <CardContent className="py-12 text-center">
                <div className="mb-2 text-3xl">🍃</div>
                <p className="text-sm text-muted-foreground">No notes on this day.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-3">
              {dayNotes.map((n) => (
                <NoteCard key={n.id} note={n} onDelete={remove} onUpdate={update} />
              ))}
            </div>
          )}
        </div>

        <Card className="shadow-none">
          <CardContent>
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Report for this day
            </h2>
            {dayReport && !showForm ? (
              <div className="rounded-xl border border-l-4 border-l-primary bg-background/40 p-4">
                <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
                  <Badge className="rounded-full uppercase">daily</Badge>
                  <span className="uppercase">{dayReport.language}</span>
                </div>
                <div className="report-body">
                  <ReactMarkdown>{dayReport.content}</ReactMarkdown>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-full"
                    onClick={() => {
                      navigator.clipboard.writeText(markdownToPlain(dayReport.content))
                      toast.success("Copied as plain text")
                    }}
                  >
                    📋 Copy
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-full"
                    onClick={async () => {
                      try {
                        await downloadReportDocx(dayReport)
                        toast.success("Word file downloaded")
                      } catch {
                        toast.error("Download failed")
                      }
                    }}
                  >
                    📄 Word
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-full"
                    onClick={() => printReport(dayReport)}
                  >
                    🖨 PDF / Print
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-full"
                    onClick={() => setShowForm(true)}
                  >
                    ↻ Regenerate
                  </Button>
                </div>
              </div>
            ) : dayNotes.length === 0 ? (
              <p className="py-2 text-sm text-muted-foreground">
                No notes on this day, so there is nothing to report on yet.
              </p>
            ) : (
              reportForm
            )}
          </CardContent>
        </Card>
      </div>

      {printing &&
        createPortal(
          <div id="print-report">
            <header>
              <h1>Daily Report</h1>
              <p>{printing.period_start}</p>
            </header>
            <div className="report-body">
              <ReactMarkdown>{printing.content}</ReactMarkdown>
            </div>
          </div>,
          document.body,
        )}
    </div>
  )
}
