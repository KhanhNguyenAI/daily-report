from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import settings
from .routers import export, notes, report_formats, reports

app = FastAPI(title="TakeNote API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip().rstrip("/") for o in settings.cors_origins.split(",") if o.strip()],
    allow_origin_regex=settings.cors_origin_regex or None,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(notes.router)
app.include_router(reports.router)
app.include_router(report_formats.router)
app.include_router(export.router)


@app.api_route("/health", methods=["GET", "HEAD"])
def health():
    return {"status": "ok"}
