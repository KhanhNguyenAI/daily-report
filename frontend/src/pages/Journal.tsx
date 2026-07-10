import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"

import { createNote, deleteNote, listNotes, type Note } from "@/api/notes"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"

const MOODS = [
  { value: 1, emoji: "😫", label: "Rough" },
  { value: 2, emoji: "🙁", label: "Meh" },
  { value: 3, emoji: "😐", label: "Okay" },
  { value: 4, emoji: "🙂", label: "Good" },
  { value: 5, emoji: "😄", label: "Great" },
]

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
}

export function Journal() {
  const [notes, setNotes] = useState<Note[]>([])
  const [content, setContent] = useState("")
  const [mood, setMood] = useState<number | null>(null)
  const [tags, setTags] = useState("")
  const [saving, setSaving] = useState(false)

  const refresh = useCallback(async () => {
    try {
      setNotes(await listNotes({ date: todayISO() }))
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

  return (
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
              <Card key={n.id} className="group py-4 shadow-none transition-shadow hover:shadow-md">
                <CardContent className="px-5">
                  <div className="mb-1.5 flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="font-medium tabular-nums">{formatTime(n.created_at)}</span>
                    {n.mood && (
                      <span className="text-sm">
                        {MOODS.find((m) => m.value === n.mood)?.emoji}
                      </span>
                    )}
                    {n.tags.map((t) => (
                      <Badge key={t} variant="secondary" className="rounded-full font-normal">
                        {t}
                      </Badge>
                    ))}
                    <button
                      type="button"
                      onClick={() => remove(n.id)}
                      className="ml-auto rounded-full px-1.5 text-muted-foreground opacity-0 transition group-hover:opacity-100 hover:text-destructive focus-visible:opacity-100"
                      aria-label="Delete note"
                    >
                      ✕
                    </button>
                  </div>
                  <p className="whitespace-pre-wrap text-[15px] leading-relaxed">{n.content}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
