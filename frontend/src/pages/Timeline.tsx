import { useCallback, useEffect, useMemo, useState } from "react"
import { createPortal } from "react-dom"
import ReactMarkdown from "react-markdown"
import { toast } from "sonner"

import { createNote, deleteNote, listNotes, updateNote, type Note, type NoteInput } from "@/api/notes"
import {
  createCustomReport,
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
import { ConfirmDialog } from "@/components/confirm-dialog"
import { MOODS, moodEmoji, NoteCard } from "@/components/note-card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
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

function dayLabel(date: string) {
  return new Date(`${date}T00:00:00`).toLocaleDateString("en-US", {
    weekday: "short",
    day: "2-digit",
    month: "short",
  })
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
  // Note mặc định thu gọn để nhìn tổng quát cả ngày; set chứa id các note đang mở
  const [openNotes, setOpenNotes] = useState<Set<string>>(new Set())
  const [reportOpen, setReportOpen] = useState(true)
  // Chế độ chọn nhiều ngày cho custom report
  const [selectMode, setSelectMode] = useState(false)
  const [pickedNotes, setPickedNotes] = useState<Set<string>>(new Set())
  // Snapshot note của từng ngày lúc chọn — vẫn đúng khi người dùng chuyển tháng
  const [pickedDayNotes, setPickedDayNotes] = useState<Map<string, Note[]>>(new Map())
  const [openPickDays, setOpenPickDays] = useState<Set<string>>(new Set())
  // Thêm note trực tiếp vào ngày đang chọn (kể cả ngày đã qua)
  const [addingNote, setAddingNote] = useState(false)
  const [newContent, setNewContent] = useState("")
  const [newMood, setNewMood] = useState<number | null>(null)
  const [newTags, setNewTags] = useState("")
  const [savingNote, setSavingNote] = useState(false)
  const [confirmDailyReport, setConfirmDailyReport] = useState(false)
  const [confirmCustomReport, setConfirmCustomReport] = useState(false)
  const [confirmSaveNote, setConfirmSaveNote] = useState(false)

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
    setOpenNotes(new Set())
    setReportOpen(true)
    setAddingNote(false)
    setNewContent("")
    setNewMood(null)
    setNewTags("")
  }

  function toggleNote(id: string) {
    setOpenNotes((cur) => {
      const next = new Set(cur)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const anyNoteOpen = dayNotes.some((n) => openNotes.has(n.id))

  function toggleAllNotes() {
    setOpenNotes(anyNoteOpen ? new Set() : new Set(dayNotes.map((n) => n.id)))
  }

  /* ----- custom report: chọn nhiều ngày trên lịch ----- */

  function toggleSelectMode() {
    setSelectMode((v) => !v)
    setPickedNotes(new Set())
    setPickedDayNotes(new Map())
    setOpenPickDays(new Set())
  }

  function togglePickDay(date: string) {
    const nextDays = new Map(pickedDayNotes)
    const nextIds = new Set(pickedNotes)
    const picked = nextDays.get(date)
    if (picked) {
      for (const n of picked) nextIds.delete(n.id)
      nextDays.delete(date)
    } else {
      const notesOfDay = byDay.get(date)
      if (!notesOfDay?.length) return
      nextDays.set(date, notesOfDay)
      for (const n of notesOfDay) nextIds.add(n.id) // mặc định lấy cả ngày
    }
    setPickedDayNotes(nextDays)
    setPickedNotes(nextIds)
  }

  function togglePickNote(date: string, id: string) {
    const nextIds = new Set(pickedNotes)
    if (nextIds.has(id)) nextIds.delete(id)
    else nextIds.add(id)
    // bỏ note cuối cùng của ngày → bỏ luôn ngày
    const notesOfDay = pickedDayNotes.get(date) ?? []
    if (!notesOfDay.some((n) => nextIds.has(n.id))) {
      const nextDays = new Map(pickedDayNotes)
      nextDays.delete(date)
      setPickedDayNotes(nextDays)
    }
    setPickedNotes(nextIds)
  }

  function toggleOpenPickDay(date: string) {
    setOpenPickDays((cur) => {
      const next = new Set(cur)
      if (next.has(date)) next.delete(date)
      else next.add(date)
      return next
    })
  }

  const pickedDates = [...pickedDayNotes.keys()].sort()

  async function generateCustom() {
    setGenerating(true)
    try {
      saveInstructions(instructions)
      const ids = pickedDates.flatMap((d) =>
        (pickedDayNotes.get(d) ?? []).filter((n) => pickedNotes.has(n.id)).map((n) => n.id),
      )
      const report = await createCustomReport(ids, language, instructions.trim())
      toast.success("Custom report created ✨ — see the Reports tab")
      setReports((cur) => [report, ...cur])
      toggleSelectMode()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to create report")
    } finally {
      setGenerating(false)
    }
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

  async function addNote() {
    if (!newContent.trim()) return
    setSavingNote(true)
    try {
      await createNote({
        content: newContent.trim(),
        mood: newMood,
        tags: newTags.split(",").map((t) => t.trim()).filter(Boolean),
        date: selected,
      })
      toast.success("Note saved")
      setAddingNote(false)
      setNewContent("")
      setNewMood(null)
      setNewTags("")
      await refresh()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save note")
    } finally {
      setSavingNote(false)
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
          onClick={() => setConfirmDailyReport(true)}
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
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={toggleSelectMode}
                className={`mr-1 rounded-full border px-3 py-1 text-xs transition ${
                  selectMode
                    ? "border-primary bg-accent font-medium text-accent-foreground"
                    : "border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                {selectMode ? "✕ Exit selection" : "☑ Custom report"}
              </button>
              <Button variant="ghost" size="icon" aria-label="Previous month" onClick={() => shiftMonth(-1)}>
                ‹
              </Button>
              <Button variant="ghost" size="icon" aria-label="Next month" onClick={() => shiftMonth(1)}>
                ›
              </Button>
            </div>
          </div>
          {selectMode && (
            <p className="mb-2 text-xs text-muted-foreground">
              Selection mode — click days with notes to include them in the report.
            </p>
          )}
          <div className="grid grid-cols-7 gap-1 text-center">
            {DOW.map((d) => (
              <span key={d} className="py-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                {d}
              </span>
            ))}
            {cells.map((c) => {
              const has = byDay.has(c.date)
              const hasReport = reportByDay.has(c.date)
              const isSelected = selectMode ? pickedDayNotes.has(c.date) : c.date === selected
              return (
                <button
                  key={c.date}
                  type="button"
                  disabled={selectMode && !has}
                  onClick={() => (selectMode ? togglePickDay(c.date) : pickDay(c.date))}
                  className={`relative rounded-lg border-2 py-2 text-sm tabular-nums transition ${
                    !c.inMonth ? "text-muted-foreground/40" : has ? "font-semibold" : "text-muted-foreground"
                  } ${has ? "bg-accent text-accent-foreground" : "hover:bg-muted"} ${
                    hasReport ? "border-primary" : "border-transparent"
                  } ${isSelected ? "ring-2 ring-primary/50" : ""} ${
                    selectMode && !has ? "cursor-not-allowed opacity-40" : ""
                  }`}
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
        {selectMode ? (
          <Card className="shadow-none">
            <CardContent>
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Custom report · {pickedDates.length} {pickedDates.length === 1 ? "day" : "days"}
              </h2>
              {pickedDates.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  👈 Click days with notes on the calendar to start.
                </p>
              ) : (
                <div className="grid gap-4">
                  <div className="grid gap-2">
                    {pickedDates.map((date) => {
                      const notesOfDay = pickedDayNotes.get(date) ?? []
                      const nPicked = notesOfDay.filter((n) => pickedNotes.has(n.id)).length
                      const isOpen = openPickDays.has(date)
                      return (
                        <div key={date} className="rounded-xl border bg-background/40">
                          <div className="flex items-center gap-2 px-3 py-2 text-sm">
                            <span className="font-medium">{dayLabel(date)}</span>
                            <span className="text-xs text-muted-foreground">
                              {nPicked}/{notesOfDay.length} {notesOfDay.length === 1 ? "note" : "notes"}
                            </span>
                            {notesOfDay.length > 1 && (
                              <button
                                type="button"
                                onClick={() => toggleOpenPickDay(date)}
                                className="ml-auto rounded-full px-2 py-0.5 text-xs text-primary transition hover:bg-accent"
                              >
                                {isOpen ? "▾ hide notes" : "▸ pick notes"}
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => togglePickDay(date)}
                              className={`rounded-full px-1.5 text-muted-foreground transition hover:text-destructive ${
                                notesOfDay.length > 1 ? "" : "ml-auto"
                              }`}
                              aria-label="Remove this day"
                            >
                              ✕
                            </button>
                          </div>
                          {isOpen && (
                            <div className="grid gap-1.5 border-t px-3 py-2">
                              {notesOfDay.map((n) => (
                                <label
                                  key={n.id}
                                  className="flex cursor-pointer items-start gap-2 text-xs text-muted-foreground"
                                >
                                  <input
                                    type="checkbox"
                                    checked={pickedNotes.has(n.id)}
                                    onChange={() => togglePickNote(date, n.id)}
                                    className="mt-0.5 accent-primary"
                                  />
                                  <span className="truncate">
                                    {new Date(n.created_at).toLocaleTimeString([], {
                                      hour: "2-digit",
                                      minute: "2-digit",
                                    })}
                                    {" — "}
                                    {n.content.slice(0, 70)}
                                    {n.content.length > 70 ? "…" : ""}
                                  </span>
                                </label>
                              ))}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
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
                    placeholder="Format request (optional) — e.g. follow the company template 業務内容／進捗／所感…"
                    value={instructions}
                    onChange={(e) => setInstructions(e.target.value)}
                    maxLength={500}
                    className="min-h-16 bg-muted/50 text-sm"
                    aria-label="Report format instructions"
                  />
                  <div className="flex items-center gap-3">
                    <Button
                      className="rounded-full shadow-sm"
                      disabled={generating || pickedNotes.size === 0}
                      onClick={() => setConfirmCustomReport(true)}
                    >
                      {generating ? "Writing report…" : "✨ Create custom report"}
                    </Button>
                    <span className="text-xs font-medium text-primary">
                      {pickedNotes.size} {pickedNotes.size === 1 ? "note" : "notes"} selected
                    </span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ) : (
          <>
        <div>
          <div className="mb-3 flex items-baseline gap-2 px-1">
            <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
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
            <div className="ml-auto flex items-center gap-2">
              {!addingNote && (
                <button
                  type="button"
                  onClick={() => setAddingNote(true)}
                  className="rounded-full px-2 py-0.5 text-xs text-primary transition hover:bg-accent"
                >
                  + Add note
                </button>
              )}
              {dayNotes.length > 0 && (
                <button
                  type="button"
                  onClick={toggleAllNotes}
                  className="rounded-full px-2 py-0.5 text-xs text-primary transition hover:bg-accent"
                >
                  {anyNoteOpen ? "▾ Collapse all" : "▸ Expand all"}
                </button>
              )}
            </div>
          </div>
          {addingNote && (
            <Card className="mb-3 shadow-none ring-2 ring-primary/50">
              <CardContent className="grid gap-3 px-5">
                <Textarea
                  placeholder={`Add a note for ${selectedLabel}…`}
                  value={newContent}
                  onChange={(e) => setNewContent(e.target.value)}
                  className="min-h-24 text-[15px] leading-relaxed"
                  aria-label="New note content"
                  autoFocus
                />
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex gap-1" role="group" aria-label="Mood">
                    {MOODS.map((m) => (
                      <button
                        key={m.value}
                        type="button"
                        title={m.label}
                        aria-pressed={newMood === m.value}
                        onClick={() => setNewMood(newMood === m.value ? null : m.value)}
                        className={`grid size-8 place-items-center rounded-full text-base transition-all duration-150 ${
                          newMood === m.value
                            ? "scale-110 bg-accent ring-2 ring-primary/60"
                            : "opacity-45 grayscale hover:scale-110 hover:opacity-100 hover:grayscale-0"
                        }`}
                      >
                        {m.emoji}
                      </button>
                    ))}
                  </div>
                  <Input
                    placeholder="tags, comma separated"
                    value={newTags}
                    onChange={(e) => setNewTags(e.target.value)}
                    className="h-8 max-w-48 flex-1 rounded-full border-none bg-muted px-4 text-sm shadow-none"
                  />
                  <div className="ml-auto flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="rounded-full"
                      onClick={() => {
                        setAddingNote(false)
                        setNewContent("")
                        setNewMood(null)
                        setNewTags("")
                      }}
                      disabled={savingNote}
                    >
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      className="rounded-full"
                      onClick={() => setConfirmSaveNote(true)}
                      disabled={savingNote || !newContent.trim()}
                    >
                      {savingNote ? "Saving…" : "Save"}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
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
                <NoteCard
                  key={n.id}
                  note={n}
                  onDelete={remove}
                  onUpdate={update}
                  collapsed={!openNotes.has(n.id)}
                  onToggleCollapse={() => toggleNote(n.id)}
                />
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
              <div className="overflow-hidden rounded-xl border border-l-4 border-l-primary bg-background/40">
                <button
                  type="button"
                  onClick={() => setReportOpen((v) => !v)}
                  aria-expanded={reportOpen}
                  className="flex w-full items-center gap-2 p-4 text-left text-xs text-muted-foreground"
                >
                  <span
                    aria-hidden
                    className={`text-[10px] text-primary transition-transform ${reportOpen ? "rotate-90" : ""}`}
                  >
                    ▶
                  </span>
                  <Badge className="rounded-full uppercase">daily</Badge>
                  <span className="uppercase">{dayReport.language}</span>
                  {!reportOpen && (
                    <span className="truncate">
                      {markdownToPlain(dayReport.content).split("\n")[0]}
                    </span>
                  )}
                </button>
                {reportOpen && (
                  <div className="px-4 pb-4">
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
                )}
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
          </>
        )}
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

      <ConfirmDialog
        open={confirmDailyReport}
        onOpenChange={setConfirmDailyReport}
        title="Create report for this day?"
        description="This will generate a report from this day's notes using AI."
        confirmLabel="Create report"
        onConfirm={generate}
      />
      <ConfirmDialog
        open={confirmCustomReport}
        onOpenChange={setConfirmCustomReport}
        title="Create custom report?"
        description={`This will generate a report from ${pickedNotes.size} selected ${
          pickedNotes.size === 1 ? "note" : "notes"
        } using AI.`}
        confirmLabel="Create report"
        onConfirm={generateCustom}
      />
      <ConfirmDialog
        open={confirmSaveNote}
        onOpenChange={setConfirmSaveNote}
        title="Save this note?"
        description={`It will be added to ${selectedLabel}.`}
        confirmLabel="Save"
        onConfirm={addNote}
      />
    </div>
  )
}
