import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { toast } from "sonner"

import { listNotes, type Note } from "@/api/notes"
import { listReports, type Report, type ReportLanguage } from "@/api/reports"
import { moodEmoji } from "@/components/note-card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"

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
  const [language, setLanguage] = useState<ReportLanguage>(
    () => (localStorage.getItem("reportLanguage") as ReportLanguage) ?? "en",
  )
  const [selected, setSelected] = useState<Report | null>(null)

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
      setSelected((cur) => cur ?? r[0] ?? null)
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
            <SectionTitle>Generate a report</SectionTitle>
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
            <div className="flex flex-wrap gap-2">
              <Button
                className="rounded-full shadow-sm"
                onClick={() => toast.info("AI daily reports arrive in Phase 2 ✨")}
              >
                ✨ Daily report
              </Button>
              <Button
                variant="outline"
                className="rounded-full"
                onClick={() => toast.info("AI weekly reports arrive in Phase 2 ✨")}
              >
                🗓 Weekly report
              </Button>
            </div>
          </CardContent>
        </Card>

        <div>
          <SectionTitle>
            Past reports · {reports.length}
          </SectionTitle>
          {reports.length === 0 ? (
            <Card className="border-dashed shadow-none">
              <CardContent className="py-12 text-center">
                <div className="mb-2 text-3xl">📄</div>
                <p className="text-sm text-muted-foreground">
                  No reports yet. Write some notes, then generate your first one.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-3">
              {reports.map((r) => (
                <Card
                  key={r.id}
                  className={`cursor-pointer py-4 shadow-none transition hover:shadow-md ${
                    selected?.id === r.id ? "ring-2 ring-primary" : ""
                  }`}
                  onClick={() => setSelected(r)}
                >
                  <CardContent className="px-5">
                    <div className="mb-1 flex items-center gap-2 text-xs text-muted-foreground">
                      <Badge className="rounded-full uppercase">{r.type}</Badge>
                      <span>
                        {r.period_start}
                        {r.period_end !== r.period_start && ` → ${r.period_end}`}
                      </span>
                      <span className="ml-auto uppercase">{r.language}</span>
                    </div>
                    {selected?.id === r.id ? (
                      <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed">
                        {r.content}
                      </pre>
                    ) : (
                      <p className="truncate text-sm text-muted-foreground">{r.content}</p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
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
    </div>
  )
}
