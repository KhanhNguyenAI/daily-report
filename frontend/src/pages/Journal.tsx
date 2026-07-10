import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"

import { createNote, deleteNote, listNotes, type Note } from "@/api/notes"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"

const MOODS = [
  { value: 1, emoji: "😫" },
  { value: 2, emoji: "🙁" },
  { value: 3, emoji: "😐" },
  { value: 4, emoji: "🙂" },
  { value: 5, emoji: "😄" },
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
    <div className="grid gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            New note
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3">
          <Textarea
            placeholder="What did you do? How did it go? Write it like a diary…"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="min-h-28"
          />
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex gap-1" role="group" aria-label="Mood">
              {MOODS.map((m) => (
                <button
                  key={m.value}
                  type="button"
                  aria-pressed={mood === m.value}
                  onClick={() => setMood(mood === m.value ? null : m.value)}
                  className={`rounded-md border px-2 py-1 text-lg transition ${
                    mood === m.value
                      ? "border-primary bg-primary/10"
                      : "border-transparent opacity-50 grayscale hover:opacity-100 hover:grayscale-0"
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
              className="max-w-56 flex-1"
            />
            <Button onClick={save} disabled={saving || !content.trim()}>
              {saving ? "Saving…" : "Save note"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Today · {notes.length} {notes.length === 1 ? "note" : "notes"}
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2.5">
          {notes.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No notes yet today. Write your first one above ✏️
            </p>
          )}
          {notes.map((n) => (
            <div key={n.id} className="rounded-lg border p-3">
              <div className="mb-1.5 flex items-center gap-2 text-xs text-muted-foreground">
                <span className="tabular-nums">{formatTime(n.created_at)}</span>
                {n.mood && <span>{MOODS.find((m) => m.value === n.mood)?.emoji}</span>}
                {n.tags.map((t) => (
                  <Badge key={t} variant="secondary">
                    {t}
                  </Badge>
                ))}
                <button
                  type="button"
                  onClick={() => remove(n.id)}
                  className="ml-auto text-muted-foreground transition hover:text-destructive"
                  aria-label="Delete note"
                >
                  ✕
                </button>
              </div>
              <p className="whitespace-pre-wrap text-sm">{n.content}</p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
