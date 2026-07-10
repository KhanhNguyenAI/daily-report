import { useCallback, useEffect, useMemo, useState } from "react"
import { toast } from "sonner"

import { deleteNote, listNotes, type Note } from "@/api/notes"
import { moodEmoji, NoteCard } from "@/components/note-card"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"

const DOW = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"]

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

  const refresh = useCallback(async () => {
    const start = iso(new Date(year, month, 1))
    const end = iso(new Date(year, month + 1, 0))
    try {
      setNotes(await listNotes({ start, end }))
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

  const cells = useMemo(() => buildGrid(year, month), [year, month])
  const dayNotes = byDay.get(selected) ?? []
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

  async function remove(id: string) {
    try {
      await deleteNote(id)
      toast.success("Note deleted")
      await refresh()
    } catch {
      toast.error("Failed to delete note")
    }
  }

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
              const isSelected = c.date === selected
              return (
                <button
                  key={c.date}
                  type="button"
                  onClick={() => setSelected(c.date)}
                  className={`relative rounded-lg py-2 text-sm tabular-nums transition ${
                    !c.inMonth ? "text-muted-foreground/40" : has ? "font-semibold" : "text-muted-foreground"
                  } ${has ? "bg-accent text-accent-foreground" : "hover:bg-muted"} ${
                    isSelected ? "ring-2 ring-primary" : ""
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
          <p className="mt-3 text-xs text-muted-foreground">● days with notes — click to review</p>
        </CardContent>
      </Card>

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
              <NoteCard key={n.id} note={n} onDelete={remove} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
