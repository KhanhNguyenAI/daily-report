import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { createPortal } from "react-dom"
import ReactMarkdown from "react-markdown"
import { toast } from "sonner"

import { listNotes, type Note } from "@/api/notes"
import {
  createWeeklyReport,
  deleteReport,
  downloadReportDocx,
  listReports,
  markdownToPlain,
  savedInstructions,
  saveInstructions,
  savedLanguage,
  type Report,
  type ReportLanguage,
} from "@/api/reports"
import { ConfirmDialog } from "@/components/confirm-dialog"
import { moodEmoji } from "@/components/note-card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"

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

function ReportBody({ content }: { content: string }) {
  return (
    <div className="report-body">
      <ReactMarkdown>{content}</ReactMarkdown>
    </div>
  )
}

const REPORT_TITLES = { daily: "Daily Report", weekly: "Weekly Report", custom: "Work Report" }

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
      {children}
    </h2>
  )
}

/* ---------- Mood chart (14 ngày, SVG) ---------- */

interface DayMood {
  date: string
  mood: number
}

function MoodChart({ points }: { points: DayMood[] }) {
  const [hover, setHover] = useState<number | null>(null)
  const ref = useRef<SVGSVGElement>(null)
  const W = 360
  const H = 140
  const L = 24
  const R = 20
  const T = 10
  const B = 22

  if (points.length < 2) {
    return (
      <p className="py-6 text-center text-sm text-muted-foreground">
        Log moods on a few more days to see your trend 📈
      </p>
    )
  }

  const x = (i: number) => L + (i * (W - L - R)) / (points.length - 1)
  const y = (v: number) => T + ((5 - v) * (H - T - B)) / 4
  const poly = points.map((p, i) => `${x(i)},${y(p.mood)}`).join(" ")
  const labelStep = Math.ceil(points.length / 5)

  return (
    <svg
      ref={ref}
      viewBox={`0 0 ${W} ${H}`}
      className="w-full"
      role="img"
      aria-label="Mood by day, scale 1 to 5"
      onMouseLeave={() => setHover(null)}
      onMouseMove={(e) => {
        const rect = ref.current?.getBoundingClientRect()
        if (!rect) return
        const px = ((e.clientX - rect.left) / rect.width) * W
        const i = Math.round(((px - L) / (W - L - R)) * (points.length - 1))
        setHover(i >= 0 && i < points.length ? i : null)
      }}
    >
      {[1, 2, 3, 4, 5].map((v) => (
        <g key={v}>
          <line x1={L} x2={W - R} y1={y(v)} y2={y(v)} className="stroke-border" strokeWidth="1" />
          <text x={L - 6} y={y(v) + 3.5} textAnchor="end" className="fill-muted-foreground text-[10px]">
            {v}
          </text>
        </g>
      ))}
      <polygon
        points={`${x(0)},${y(1)} ${poly} ${x(points.length - 1)},${y(1)}`}
        className="fill-primary opacity-15"
      />
      <polyline points={poly} className="stroke-primary fill-none" strokeWidth="2" strokeLinejoin="round" />
      {points.map((p, i) => (
        <circle
          key={p.date}
          cx={x(i)}
          cy={y(p.mood)}
          r={i === points.length - 1 || hover === i ? 4.5 : 3}
          className={i === points.length - 1 || hover === i ? "fill-primary" : "fill-card stroke-primary"}
          strokeWidth="2"
        />
      ))}
      {points.map((p, i) =>
        i % labelStep === 0 || i === points.length - 1 ? (
          <text key={p.date} x={x(i)} y={H - 6} textAnchor="middle" className="fill-muted-foreground text-[10px]">
            {p.date.slice(5).replace("-", "/")}
          </text>
        ) : null,
      )}
      {hover != null && (
        <text x={x(hover)} y={y(points[hover].mood) - 9} textAnchor="middle" className="fill-foreground text-[11px] font-medium">
          {points[hover].date.slice(5).replace("-", "/")} · {points[hover].mood} {moodEmoji(points[hover].mood)}
        </text>
      )}
    </svg>
  )
}

/* ---------- Trang Reports ---------- */

export function Reports() {
  const [reports, setReports] = useState<Report[]>([])
  const [notes, setNotes] = useState<Note[]>([])
  const [language, setLanguage] = useState<ReportLanguage>(savedLanguage)
  const [instructions, setInstructions] = useState(savedInstructions)
  // id các báo cáo đang mở — rỗng nghĩa là đóng hết, không ép ô nào phải mở
  const [open, setOpen] = useState<Set<string>>(new Set())
  const [generating, setGenerating] = useState(false)
  const [confirmWeeklyReport, setConfirmWeeklyReport] = useState(false)
  const [printing, setPrinting] = useState<Report | null>(null)

  function printReport(r: Report) {
    setPrinting(r)
    setTimeout(() => window.print(), 150)
  }

  const refresh = useCallback(async () => {
    const end = new Date()
    const start = new Date()
    start.setDate(end.getDate() - 13)
    try {
      const [r, n] = await Promise.all([
        listReports(),
        listNotes({ start: iso(start), end: iso(end) }),
      ])
      setReports(r)
      setNotes(n)
    } catch {
      toast.error("Could not load data. Is the backend running?")
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  function pickLanguage(l: ReportLanguage) {
    setLanguage(l)
    localStorage.setItem("reportLanguage", l)
  }

  async function generateWeekly() {
    setGenerating(true)
    try {
      saveInstructions(instructions)
      const report = await createWeeklyReport(language, undefined, instructions.trim())
      toast.success("Weekly report created ✨")
      setReports((cur) => [report, ...cur])
      setOpen((cur) => new Set(cur).add(report.id))
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to generate report")
    } finally {
      setGenerating(false)
    }
  }

  async function removeReport(id: string) {
    try {
      await deleteReport(id)
      toast.success("Report deleted")
      setReports((cur) => cur.filter((r) => r.id !== id))
    } catch {
      toast.error("Failed to delete report")
    }
  }

  function toggleReport(id: string) {
    setOpen((cur) => {
      const next = new Set(cur)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleAll(list: Report[]) {
    setOpen((cur) => {
      const next = new Set(cur)
      const anyOpen = list.some((r) => next.has(r.id))
      for (const r of list) {
        if (anyOpen) next.delete(r.id)
        else next.add(r.id)
      }
      return next
    })
  }

  const moodPoints = useMemo<DayMood[]>(() => {
    const byDay = new Map<string, number[]>()
    for (const n of notes) {
      if (n.mood == null) continue
      byDay.set(n.date, [...(byDay.get(n.date) ?? []), n.mood])
    }
    return [...byDay.entries()]
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([date, moods]) => ({
        date,
        mood: Math.round((moods.reduce((s, m) => s + m, 0) / moods.length) * 10) / 10,
      }))
  }, [notes])

  function reportSection(title: string, list: Report[], emptyHint: string) {
    const anyOpen = list.some((r) => open.has(r.id))
    return (
      <div>
        <div className="mb-3 flex items-baseline gap-2 px-1">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            {title} · {list.length}
          </h2>
          {list.length > 0 && (
            <button
              type="button"
              onClick={() => toggleAll(list)}
              className="ml-auto rounded-full px-2 py-0.5 text-xs text-primary transition hover:bg-accent"
            >
              {anyOpen ? "▾ Collapse all" : "▸ Expand all"}
            </button>
          )}
        </div>
        {list.length === 0 ? (
          <Card className="border-dashed shadow-none">
            <CardContent className="py-8 text-center">
              <p className="text-sm text-muted-foreground">{emptyHint}</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3">
            {list.map((r) => {
              const isOpen = open.has(r.id)
              return (
                <Card key={r.id} className="overflow-hidden py-0 shadow-none">
                  <div
                    role="button"
                    tabIndex={0}
                    aria-expanded={isOpen}
                    onClick={() => toggleReport(r.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault()
                        toggleReport(r.id)
                      }
                    }}
                    className="flex w-full cursor-pointer items-center gap-2 px-5 py-3.5 text-xs text-muted-foreground"
                  >
                    <span
                      aria-hidden
                      className={`text-[10px] text-primary transition-transform ${isOpen ? "rotate-90" : ""}`}
                    >
                      ▶
                    </span>
                    <Badge
                      variant={
                        r.type === "weekly" ? "outline" : r.type === "custom" ? "secondary" : "default"
                      }
                      className="rounded-full uppercase"
                    >
                      {r.type}
                    </Badge>
                    <span className="whitespace-nowrap">
                      {r.period_start}
                      {r.period_end !== r.period_start && ` → ${r.period_end}`}
                    </span>
                    {!isOpen && (
                      <span className="truncate">{markdownToPlain(r.content).split("\n")[0]}</span>
                    )}
                    <span className="ml-auto uppercase">{r.language}</span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        removeReport(r.id)
                      }}
                      className="rounded-full px-1.5 text-muted-foreground transition hover:text-destructive"
                      aria-label="Delete report"
                    >
                      ✕
                    </button>
                  </div>
                  {isOpen && (
                    <CardContent className="px-5 pb-4">
                      <ReportBody content={r.content} />
                      <div className="mt-4 flex flex-wrap gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="rounded-full"
                          onClick={() => {
                            navigator.clipboard.writeText(markdownToPlain(r.content))
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
                              await downloadReportDocx(r)
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
                          onClick={() => printReport(r)}
                        >
                          🖨 PDF / Print
                        </Button>
                      </div>
                    </CardContent>
                  )}
                </Card>
              )
            })}
          </div>
        )}
      </div>
    )
  }

  const topTags = useMemo(() => {
    const counts = new Map<string, number>()
    for (const n of notes) for (const t of n.tags) counts.set(t, (counts.get(t) ?? 0) + 1)
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5)
  }, [notes])
  const maxTag = topTags[0]?.[1] ?? 1

  return (
    <div className="grid items-start gap-5 lg:grid-cols-[1.1fr_0.9fr]">
      <div className="grid gap-5">
        <Card className="shadow-none">
          <CardContent>
            <SectionTitle>Generate weekly report</SectionTitle>
            <div className="mb-4 flex flex-wrap items-center gap-2">
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
              placeholder="Format request (optional) — e.g. follow the company template 業務内容／進捗／所感…"
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              maxLength={500}
              className="mb-1 min-h-16 bg-muted/50 text-sm"
              aria-label="Report format instructions"
            />
            <p className="mb-4 text-xs text-muted-foreground">
              Shapes the presentation only — content still comes from your notes. Remembered for next time.
            </p>
            <Button
              className="rounded-full shadow-sm"
              disabled={generating}
              onClick={() => setConfirmWeeklyReport(true)}
            >
              {generating ? "Writing report…" : "🗓 Weekly report"}
            </Button>
            <p className="mt-3 text-xs text-muted-foreground">
              Daily reports are created per day in the Timeline tab.
            </p>
          </CardContent>
        </Card>

        {reportSection(
          "Daily reports",
          reports.filter((r) => r.type === "daily"),
          "No daily reports yet. Create them per day in the Timeline tab.",
        )}
        {reportSection(
          "Weekly reports",
          reports.filter((r) => r.type === "weekly"),
          "No weekly reports yet. Generate one above.",
        )}
        {reportSection(
          "Custom reports",
          reports.filter((r) => r.type === "custom"),
          "No custom reports yet. Use ☑ Custom report on the Timeline calendar to pick days and notes.",
        )}
      </div>

      <div className="grid gap-5">
        <Card className="shadow-none">
          <CardContent>
            <SectionTitle>Mood · last 14 days</SectionTitle>
            <MoodChart points={moodPoints} />
          </CardContent>
        </Card>

        <Card className="shadow-none">
          <CardContent>
            <SectionTitle>Top tags · last 14 days</SectionTitle>
            {topTags.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">
                Tag your notes to see patterns here 🏷️
              </p>
            ) : (
              <div className="grid gap-2.5">
                {topTags.map(([tag, count]) => (
                  <div key={tag} className="flex items-center gap-3 text-sm">
                    <span
                      className="h-2 rounded-full bg-primary/85"
                      style={{ width: `${Math.max(12, (count / maxTag) * 120)}px` }}
                    />
                    <span>{tag}</span>
                    <span className="ml-auto text-xs tabular-nums text-muted-foreground">
                      ×{count}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {printing &&
        createPortal(
          <div id="print-report">
            <header>
              <h1>{REPORT_TITLES[printing.type]}</h1>
              <p>
                {printing.period_start}
                {printing.period_end !== printing.period_start && ` – ${printing.period_end}`}
              </p>
            </header>
            <div className="report-body">
              <ReactMarkdown>{printing.content}</ReactMarkdown>
            </div>
          </div>,
          document.body,
        )}

      <ConfirmDialog
        open={confirmWeeklyReport}
        onOpenChange={setConfirmWeeklyReport}
        title="Create weekly report?"
        description="This will generate a report from this week's notes using AI."
        confirmLabel="Create report"
        onConfirm={generateWeekly}
      />
    </div>
  )
}
