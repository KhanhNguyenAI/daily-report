---
name: verify
description: Build, launch and drive TakeNote (FastAPI + Vite/React) to verify changes end-to-end
---

# Verify TakeNote

## Launch

Backend (needs `backend/.env` + `backend/serviceAccountKey.json`, already on dev machine):

```powershell
cd backend
.\.venv\Scripts\uvicorn.exe app.main:app --port 8000   # background task
```

Ready when `GET http://127.0.0.1:8000/health` → `{"status":"ok"}`.

Frontend:

```powershell
cd frontend
npm run dev   # background task, serves http://localhost:5173
```

## Drive

- API surface: plain HTTP against :8000 (`/notes` CRUD, `/export` returns a ZIP).
  Firestore is REAL cloud data — always delete notes created during testing.
- UI surface: Playwright (chromium already installed in the session scratchpad;
  otherwise `npm i playwright && npx playwright install chromium` in a temp dir).
  Key selectors: placeholder `What did you do`, role group "Mood", button "Save note",
  button /Export backup/, aria-label "Delete note", toasts "Note saved" / "Note deleted".

## Gotchas

- Windows console mangles Vietnamese output: set `PYTHONIOENCODING=utf-8` for Python scripts.
- Note list sorting is done in Python (no Firestore composite index needed).
- Gemini models 503 at peak times → fallback model `gemini-3.1-flash-lite`.
