import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"

import { createNote, deleteNote, listNotes, updateNote, type Note, type NoteInput } from "@/api/notes"
import { createDailyReport, savedLanguage } from "@/api/reports"
import { MOODS, moodEmoji, NoteCard } from "@/components/note-card"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"

function localISO(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`
}

function todayISO() {
  return localISO(new Date())
}

function mondayISO() {
  const d = new Date()
  const day = d.getDay() || 7 // CN = 7
  d.setDate(d.getDate() - day + 1)
  return localISO(d)
}

function dayLabel(iso: string) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("en-US", {
    weekday: "long",
    day: "2-digit",
    month: "short",
  })
}

interface DaySummary {
  date: string
  count: number
  mood: number | null
  excerpt: string
}

function summarizeWeek(notes: Note[], today: string): DaySummary[] {
  const byDay = new Map<string, Note[]>()
  for (const n of notes) {
    if (n.date === today) continue
    byDay.set(n.date, [...(byDay.get(n.date) ?? []), n])
  }
  return [...byDay.entries()]
    .sort(([a], [b]) => (a < b ? 1 : -1))
    .map(([date, dayNotes]) => {
      const moods = dayNotes.filter((n) => n.mood != null).map((n) => n.mood as number)
      const latest = dayNotes.reduce((a, b) => (a.created_at > b.created_at ? a : b))
      return {
        date,
        count: dayNotes.length,
        mood: moods.length
          ? Math.round(moods.reduce((s, m) => s + m, 0) / moods.length)
          : null,
        excerpt: latest.content.length > 60 ? `${latest.content.slice(0, 60)}…` : latest.content,
      }
    })
}

export function Journal({ onReportCreated }: { onReportCreated?: () => void }) {
  const [reporting, setReporting] = useState(false)
  const [notes, setNotes] = useState<Note[]>([])
  const [week, setWeek] = useState<DaySummary[]>([])
  const [content, setContent] = useState("")
  const [mood, setMood] = useState<number | null>(null)
  const [tags, setTags] = useState("")
  const [saving, setSaving] = useState(false)

  const refresh = useCallback(async () => {
    try {
      const today = todayISO()
      const [todayNotes, weekNotes] = await Promise.all([
        listNotes({ date: today }),
        listNotes({ start: mondayISO(), end: today }),
      ])
      setNotes(todayNotes)
      setWeek(summarizeWeek(weekNotes, today))
    } catch {
      toast.error("Could not load notes. Is the backend running?")
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  async function save() {
    if (!content.trim()) return
    setSaving(true)
    try {
      await createNote({
        content: content.trim(),
        mood,
        tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
        date: todayISO(),
      })
      setContent("")
      setMood(null)
      setTags("")
      toast.success("Note saved")
      await refresh()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save note")
    } finally {
      setSaving(false)
    }
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

  return (
    <div className="grid items-start gap-5 lg:grid-cols-[1.15fr_0.85fr]">
      <div className="grid gap-5">
      <Card className="shadow-sm">
        <CardContent className="grid gap-4 pt-6">
          <Textarea
            placeholder="What did you do? How did it go? Write it like a diary…"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="min-h-32 resize-none border-none bg-transparent p-0 text-[15px] leading-relaxed shadow-none focus-visible:ring-0 dark:bg-transparent"
          />
          <div className="flex flex-wrap items-center gap-3 border-t pt-4">
            <div className="flex gap-1" role="group" aria-label="Mood">
              {MOODS.map((m) => (
                <button
                  key={m.value}
                  type="button"
                  title={m.label}
                  aria-pressed={mood === m.value}
                  onClick={() => setMood(mood === m.value ? null : m.value)}
                  className={`grid size-9 place-items-center rounded-full text-lg transition-all duration-150 ${
                    mood === m.value
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
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              className="h-9 max-w-52 flex-1 rounded-full border-none bg-muted px-4 text-sm shadow-none"
            />
            <Button
              onClick={save}
              disabled={saving || !content.trim()}
              className="ml-auto rounded-full px-5 shadow-sm"
            >
              {saving ? "Saving…" : "Save note"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <div>
        <h2 className="mb-3 px-1 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Today · {notes.length} {notes.length === 1 ? "note" : "notes"}
        </h2>
        {notes.length === 0 ? (
          <Card className="border-dashed shadow-none">
            <CardContent className="py-12 text-center">
              <div className="mb-2 text-3xl">☕</div>
              <p className="text-sm text-muted-foreground">
                No notes yet today. Write your first one above.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3">
            {notes.map((n) => (
              <NoteCard key={n.id} note={n} onDelete={remove} onUpdate={update} />
            ))}
          </div>
        )}
      </div>
      </div>

      <div className="grid gap-5">
        <Card className="shadow-none">
          <CardContent>
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              This week
            </h2>
            {week.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nothing earlier this week — today is where it starts 🌱
              </p>
            ) : (
              <div className="grid gap-2.5">
                {week.map((d) => (
                  <div key={d.date} className="rounded-xl border bg-background/40 p-3">
                    <div className="mb-1 flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="font-medium">{dayLabel(d.date)}</span>
                      <span>
                        · {d.count} {d.count === 1 ? "note" : "notes"}
                      </span>
                      {d.mood && <span className="text-sm">{moodEmoji(d.mood)}</span>}
                    </div>
                    <p className="truncate text-sm text-foreground/85">{d.excerpt}</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-none">
          <CardContent>
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              End of day
            </h2>
            <p className="mb-4 text-sm text-muted-foreground">
              {notes.length === 0
                ? "Write a few notes first, then turn them into a report."
                : `You have ${notes.length} ${notes.length === 1 ? "note" : "notes"} today. Turn them into a polished report for your mentor?`}
            </p>
            <Button
              className="rounded-full shadow-sm"
              disabled={notes.length === 0 || reporting}
              onClick={async () => {
                setReporting(true)
                try {
                  await createDailyReport(savedLanguage())
                  toast.success("Daily report created ✨")
                  onReportCreated?.()
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : "Failed to create report")
                } finally {
                  setReporting(false)
                }
              }}
            >
              {reporting ? "Writing report…" : "✨ Create daily report"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
