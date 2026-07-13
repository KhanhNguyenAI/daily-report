import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"

import {
  createFormat,
  deleteFormat,
  listFormats,
  setDefaultFormat,
  type ReportFormat,
} from "@/api/reports"
import { ConfirmDialog } from "@/components/confirm-dialog"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"

interface FormatPickerProps {
  value: string
  onChange: (value: string) => void
}

/** Ô yêu cầu định dạng + kho mẫu lưu sẵn trên backend.
 *  Mẫu đánh dấu mặc định được tự nạp vào ô khi mở trang. */
export function FormatPicker({ value, onChange }: FormatPickerProps) {
  const [formats, setFormats] = useState<ReportFormat[]>([])
  const [saveOpen, setSaveOpen] = useState(false)
  const [saveName, setSaveName] = useState("")
  const [saveAsDefault, setSaveAsDefault] = useState(false)
  const [saving, setSaving] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<ReportFormat | null>(null)
  const filledDefault = useRef(false)

  useEffect(() => {
    let cancelled = false
    listFormats()
      .then((list) => {
        if (cancelled) return
        setFormats(list)
        // Lần đầu mở, ô còn trống → nạp mẫu mặc định
        const def = list.find((f) => f.is_default)
        if (def && !filledDefault.current && !value.trim()) onChange(def.content)
        filledDefault.current = true
      })
      .catch(() => {
        /* không chặn việc tạo report nếu load mẫu lỗi */
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function save() {
    if (!saveName.trim() || !value.trim()) return
    setSaving(true)
    try {
      const created = await createFormat(saveName.trim(), value.trim(), saveAsDefault)
      setFormats((cur) => [
        ...cur.map((f) => (saveAsDefault ? { ...f, is_default: false } : f)),
        created,
      ])
      setSaveOpen(false)
      setSaveName("")
      setSaveAsDefault(false)
      toast.success("Format saved")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save format")
    } finally {
      setSaving(false)
    }
  }

  async function makeDefault(f: ReportFormat) {
    try {
      await setDefaultFormat(f.id)
      setFormats((cur) => cur.map((x) => ({ ...x, is_default: x.id === f.id })))
      toast.success(`"${f.name}" is now the default format`)
    } catch {
      toast.error("Failed to set default")
    }
  }

  async function remove(f: ReportFormat) {
    try {
      await deleteFormat(f.id)
      setFormats((cur) => cur.filter((x) => x.id !== f.id))
      toast.success("Format deleted")
    } catch {
      toast.error("Failed to delete format")
    }
  }

  return (
    <div className="grid gap-2">
      {formats.length > 0 && (
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Saved formats">
          {formats.map((f) => {
            const active = value.trim() === f.content
            return (
              <span
                key={f.id}
                className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs transition ${
                  active
                    ? "border-primary bg-accent font-medium text-accent-foreground"
                    : "border-border text-muted-foreground"
                }`}
              >
                <button
                  type="button"
                  onClick={() => onChange(f.content)}
                  className="transition hover:text-foreground"
                  title={f.content}
                >
                  {f.name}
                </button>
                <button
                  type="button"
                  onClick={() => !f.is_default && makeDefault(f)}
                  className={f.is_default ? "cursor-default" : "opacity-40 transition hover:opacity-100"}
                  title={f.is_default ? "Default format" : "Set as default"}
                  aria-label={f.is_default ? `${f.name} is the default format` : `Set ${f.name} as default`}
                >
                  {f.is_default ? "★" : "☆"}
                </button>
                <button
                  type="button"
                  onClick={() => setPendingDelete(f)}
                  className="text-muted-foreground transition hover:text-destructive"
                  aria-label={`Delete format ${f.name}`}
                >
                  ✕
                </button>
              </span>
            )
          })}
        </div>
      )}
      <Textarea
        placeholder="Format request (optional) — e.g. follow the company template 業務内容／進捗／所感…"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        maxLength={500}
        className="min-h-16 bg-muted/50 text-sm"
        aria-label="Report format instructions"
      />
      <div className="flex items-center gap-2">
        <p className="text-xs text-muted-foreground">
          Shapes the presentation only — content still comes from your notes.
        </p>
        <button
          type="button"
          disabled={!value.trim()}
          onClick={() => setSaveOpen(true)}
          className="ml-auto whitespace-nowrap rounded-full px-2 py-0.5 text-xs text-primary transition hover:bg-accent disabled:opacity-40"
        >
          ＋ Save format
        </button>
      </div>

      <Dialog open={saveOpen} onOpenChange={setSaveOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save this format</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <Input
              placeholder="Format name — e.g. Company template"
              value={saveName}
              maxLength={50}
              onChange={(e) => setSaveName(e.target.value)}
              autoFocus
            />
            <label className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
              <input
                type="checkbox"
                checked={saveAsDefault}
                onChange={(e) => setSaveAsDefault(e.target.checked)}
                className="accent-primary"
              />
              Use as default format
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSaveOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={save} disabled={saving || !saveName.trim()}>
              {saving ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={pendingDelete != null}
        onOpenChange={(open) => !open && setPendingDelete(null)}
        title={`Delete format "${pendingDelete?.name}"?`}
        description="This action cannot be undone."
        confirmLabel="Delete"
        destructive
        onConfirm={() => pendingDelete && remove(pendingDelete)}
      />
    </div>
  )
}
