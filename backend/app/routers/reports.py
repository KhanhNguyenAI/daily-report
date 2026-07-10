from datetime import date as date_type
from datetime import timedelta

from fastapi import APIRouter, HTTPException
from firebase_admin import firestore
from pydantic import BaseModel, Field, field_validator

from ..firebase import get_db
from ..schemas import Report
from ..services.ai_report import AIReportError, generate_report

router = APIRouter(prefix="/reports", tags=["reports"])

COLLECTION = "reports"


def _to_report(doc) -> Report:
    return Report(id=doc.id, **doc.to_dict())


class GenerateRequest(BaseModel):
    date: str | None = None  # ngày neo; mặc định hôm nay
    language: str = Field(default="ja")

    @field_validator("date")
    @classmethod
    def valid_date(cls, v: str | None) -> str | None:
        if v is not None:
            date_type.fromisoformat(v)
        return v

    @field_validator("language")
    @classmethod
    def valid_language(cls, v: str) -> str:
        if v not in {"en", "ja", "vi"}:
            raise ValueError("language must be one of: en, ja, vi")
        return v


def _fetch_notes(start: str, end: str) -> list[dict]:
    db = get_db()
    query = (
        db.collection("notes")
        .where(filter=firestore.firestore.FieldFilter("date", ">=", start))
        .where(filter=firestore.firestore.FieldFilter("date", "<=", end))
    )
    return [doc.to_dict() for doc in query.stream()]


def _create(kind: str, start: str, end: str, language: str) -> Report:
    notes = _fetch_notes(start, end)
    if not notes:
        raise HTTPException(status_code=400, detail="No notes in this period to report on")
    try:
        content, insights = generate_report(notes, kind, language)
    except AIReportError as e:
        raise HTTPException(status_code=502, detail=str(e))
    db = get_db()
    ref = db.collection(COLLECTION).document()
    ref.set(
        {
            "type": kind,
            "language": language,
            "period_start": start,
            "period_end": end,
            "content": content,
            "insights": insights,
            "created_at": firestore.SERVER_TIMESTAMP,
        }
    )
    return _to_report(ref.get())


@router.post("/daily", response_model=Report, status_code=201)
def create_daily_report(payload: GenerateRequest):
    day = payload.date or date_type.today().isoformat()
    return _create("daily", day, day, payload.language)


@router.post("/weekly", response_model=Report, status_code=201)
def create_weekly_report(payload: GenerateRequest):
    anchor = date_type.fromisoformat(payload.date) if payload.date else date_type.today()
    monday = anchor - timedelta(days=anchor.weekday())
    end = min(monday + timedelta(days=6), date_type.today())
    return _create("weekly", monday.isoformat(), end.isoformat(), payload.language)


@router.get("", response_model=list[Report])
def list_reports():
    db = get_db()
    reports = [_to_report(d) for d in db.collection(COLLECTION).stream()]
    reports.sort(key=lambda r: r.created_at, reverse=True)
    return reports


@router.get("/{report_id}", response_model=Report)
def get_report(report_id: str):
    db = get_db()
    doc = db.collection(COLLECTION).document(report_id).get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="Report not found")
    return _to_report(doc)


@router.delete("/{report_id}", status_code=204)
def delete_report(report_id: str):
    db = get_db()
    ref = db.collection(COLLECTION).document(report_id)
    if not ref.get().exists:
        raise HTTPException(status_code=404, detail="Report not found")
    ref.delete()
