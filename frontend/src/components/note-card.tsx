import { useState } from "react"

import type { Note, NoteInput } from "@/api/notes"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"

export const MOODS = [
  { value: 1, emoji: "😫", label: "Rough" },
  { value: 2, emoji: "🙁", label: "Meh" },
  { value: 3, emoji: "😐", label: "Okay" },
  { value: 4, emoji: "🙂", label: "Good" },
  { value: 5, emoji: "😄", label: "Great" },
]

export function moodEmoji(value: number | null | undefined) {
  return MOODS.find((m) => m.value === value)?.emoji
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
}

interface NoteCardProps {
  note: Note
  onDelete?: (id: string) => void
  onUpdate?: (id: string, changes: Partial<NoteInput>) => Promise<void>
}

export function NoteCard({ note, onDelete, onUpdate }: NoteCardProps) {
  const [editing, setEditing] = useState(false)
  const [content, setContent] = useState(note.content)
  const [mood, setMood] = useState<number | null>(note.mood)
  const [tags, setTags] = useState(note.tags.join(", "))
  const [saving, setSaving] = useState(false)

  function startEdit() {
    setContent(note.content)
    setMood(note.mood)
    setTags(note.tags.join(", "))
    setEditing(true)
  }

  async function save() {
    if (!content.trim() || !onUpdate) return
    setSaving(true)
    try {
      await onUpdate(note.id, {
        content: content.trim(),
        mood,
        tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
      })
      setEditing(false)
    } finally {
      setSaving(false)
    }
  }

  if (editing) {
    return (
      <Card className="py-4 shadow-none ring-2 ring-primary/50">
        <CardContent className="grid gap-3 px-5">
          <Textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="min-h-24 text-[15px] leading-relaxed"
            aria-label="Edit note content"
          />
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex gap-1" role="group" aria-label="Mood">
              {MOODS.map((m) => (
                <button
                  key={m.value}
                  type="button"
                  title={m.label}
                  aria-pressed={mood === m.value}
                  onClick={() => setMood(mood === m.value ? null : m.value)}
                  className={`grid size-8 place-items-center rounded-full text-base transition-all duration-150 ${
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
              className="h-8 max-w-48 flex-1 rounded-full border-none bg-muted px-4 text-sm shadow-none"
            />
            <div className="ml-auto flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                className="rounded-full"
                onClick={() => setEditing(false)}
                disabled={saving}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                className="rounded-full"
                onClick={save}
                disabled={saving || !content.trim()}
              >
                {saving ? "Saving…" : "Save"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="group py-4 shadow-none transition-shadow hover:shadow-md">
      <CardContent className="px-5">
        <div className="mb-1.5 flex items-center gap-2 text-xs text-muted-foreground">
          <span className="font-medium tabular-nums">{formatTime(note.created_at)}</span>
          {note.mood && <span className="text-sm">{moodEmoji(note.mood)}</span>}
          {note.tags.map((t) => (
            <Badge key={t} variant="secondary" className="rounded-full font-normal">
              {t}
            </Badge>
          ))}
          <span className="ml-auto flex gap-1">
            {onUpdate && (
              <button
                type="button"
                onClick={startEdit}
                className="rounded-full px-1.5 text-muted-foreground opacity-0 transition group-hover:opacity-100 hover:text-primary focus-visible:opacity-100"
                aria-label="Edit note"
              >
                ✎
              </button>
            )}
            {onDelete && (
              <button
                type="button"
                onClick={() => onDelete(note.id)}
                className="rounded-full px-1.5 text-muted-foreground opacity-0 transition group-hover:opacity-100 hover:text-destructive focus-visible:opacity-100"
                aria-label="Delete note"
              >
                ✕
              </button>
            )}
          </span>
        </div>
        <p className="whitespace-pre-wrap text-[15px] leading-relaxed">{note.content}</p>
      </CardContent>
    </Card>
  )
}
