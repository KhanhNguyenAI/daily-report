import { authHeader } from "@/lib/auth"

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

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...(await authHeader()), ...init?.headers },
  })
  if (!res.ok) {
    let detail = ""
    try {
      detail = (await res.json()).detail ?? ""
    } catch {
      /* ignore */
    }
    throw new Error(detail || `${res.status} ${res.statusText}`)
  }
  return res.status === 204 ? (undefined as T) : res.json()
}

export function listReports() {
  return request<Report[]>("/reports")
}

export function createDailyReport(language: ReportLanguage, date?: string) {
  return request<Report>("/reports/daily", {
    method: "POST",
    body: JSON.stringify({ language, date }),
  })
}

export function createWeeklyReport(language: ReportLanguage, date?: string) {
  return request<Report>("/reports/weekly", {
    method: "POST",
    body: JSON.stringify({ language, date }),
  })
}

export function deleteReport(id: string) {
  return request<void>(`/reports/${id}`, { method: "DELETE" })
}

export async function downloadReportDocx(report: Report) {
  const res = await fetch(`${API}/reports/${report.id}/docx`, { headers: await authHeader() })
  if (!res.ok) throw new Error(`Download failed: ${res.status}`)
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = `takenote-${report.type}-${report.period_start}-${report.language}.docx`
  a.click()
  URL.revokeObjectURL(url)
}

/** Bản text sạch để dán vào email/chat — bỏ hết ký tự markdown. */
export function markdownToPlain(md: string): string {
  return md
    .replace(/^#{1,6}\s*/gm, "")
    .replace(/^\s*[-*+]\s+/gm, "• ")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .trim()
}

export function savedLanguage(): ReportLanguage {
  return (localStorage.getItem("reportLanguage") as ReportLanguage) ?? "ja"
}
