import type { Note } from "@/api/notes"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"

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

export function NoteCard({ note, onDelete }: { note: Note; onDelete?: (id: string) => void }) {
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
          {onDelete && (
            <button
              type="button"
              onClick={() => onDelete(note.id)}
              className="ml-auto rounded-full px-1.5 text-muted-foreground opacity-0 transition group-hover:opacity-100 hover:text-destructive focus-visible:opacity-100"
              aria-label="Delete note"
            >
              ✕
            </button>
          )}
        </div>
        <p className="whitespace-pre-wrap text-[15px] leading-relaxed">{note.content}</p>
      </CardContent>
    </Card>
  )
}
