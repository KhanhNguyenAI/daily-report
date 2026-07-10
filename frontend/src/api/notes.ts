const API = import.meta.env.VITE_API_URL ?? "http://localhost:8000"

export interface Note {
  id: string
  content: string
  mood: number | null
  tags: string[]
  date: string
  created_at: string
}

export interface NoteInput {
  content: string
  mood?: number | null
  tags?: string[]
  date?: string
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
  })
  if (!res.ok) {
    const detail = await res.text().catch(() => "")
    throw new Error(`${res.status} ${res.statusText}${detail ? ` — ${detail}` : ""}`)
  }
  return res.status === 204 ? (undefined as T) : res.json()
}

export function listNotes(params: { date?: string; start?: string; end?: string }) {
  const qs = new URLSearchParams(
    Object.entries(params).filter(([, v]) => v != null) as [string, string][],
  )
  return request<Note[]>(`/notes?${qs}`)
}

export function createNote(input: NoteInput) {
  return request<Note>("/notes", { method: "POST", body: JSON.stringify(input) })
}

export function updateNote(id: string, changes: Partial<NoteInput>) {
  return request<Note>(`/notes/${id}`, { method: "PUT", body: JSON.stringify(changes) })
}

export function deleteNote(id: string) {
  return request<void>(`/notes/${id}`, { method: "DELETE" })
}

export async function downloadBackup() {
  const res = await fetch(`${API}/export`)
  if (!res.ok) throw new Error(`Export failed: ${res.status}`)
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = `takenote-backup-${new Date().toISOString().slice(0, 10)}.zip`
  a.click()
  URL.revokeObjectURL(url)
}
