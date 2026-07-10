const API = import.meta.env.VITE_API_URL ?? "http://localhost:8000"

export type ReportLanguage = "en" | "ja" | "vi"

export interface Report {
  id: string
  type: "daily" | "weekly"
  language: ReportLanguage
  period_start: string
  period_end: string
  content: string
  insights: Record<string, unknown>
  created_at: string
}

export async function listReports(): Promise<Report[]> {
  const res = await fetch(`${API}/reports`)
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
  return res.json()
}
