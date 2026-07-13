from datetime import date as date_type
from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from firebase_admin import firestore
from pydantic import BaseModel, Field, field_validator

from ..auth import require_user
from ..firebase import get_db
from ..schemas import Report
from ..services.ai_report import AIReportError, generate_report
from ..services.docx_export import report_to_docx

router = APIRouter(prefix="/reports", tags=["reports"])

COLLECTION = "reports"


def _to_report(doc) -> Report:
    data = doc.to_dict()
    data.pop("uid", None)
    return Report(id=doc.id, **data)


def _owned_report(db, report_id: str, uid: str):
    ref = db.collection(COLLECTION).document(report_id)
    snap = ref.get()
    if not snap.exists or snap.to_dict().get("uid") != uid:
        raise HTTPException(status_code=404, detail="Report not found")
    return snap


class GenerateRequest(BaseModel):
    date: str | None = None  # ngày neo; mặc định hôm nay
    language: str = Field(default="ja")
    instructions: str | None = Field(default=None, max_length=500)  # yêu cầu định dạng

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


class ReportUpdate(BaseModel):
    content: str = Field(min_length=1, max_length=20_000)


class CustomRequest(BaseModel):
    note_ids: list[str] = Field(min_length=1, max_length=200)
    language: str = Field(default="ja")
    instructions: str | None = Field(default=None, max_length=500)

    @field_validator("language")
    @classmethod
    def valid_language(cls, v: str) -> str:
        if v not in {"en", "ja", "vi"}:
            raise ValueError("language must be one of: en, ja, vi")
        return v


def _fetch_notes(uid: str, start: str, end: str) -> list[dict]:
    db = get_db()
    query = db.collection("notes").where(
        filter=firestore.firestore.FieldFilter("uid", "==", uid)
    )
    return [
        n for n in (doc.to_dict() for doc in query.stream())
        if start <= n.get("date", "") <= end
    ]


def _create(
    uid: str, kind: str, start: str, end: str, language: str, instructions: str | None = None
) -> Report:
    notes = _fetch_notes(uid, start, end)
    if not notes:
        raise HTTPException(status_code=400, detail="No notes in this period to report on")
    try:
        content, insights = generate_report(notes, kind, language, instructions)
    except AIReportError as e:
        raise HTTPException(status_code=502, detail=str(e))
    db = get_db()
    ref = db.collection(COLLECTION).document()
    ref.set(
        {
            "uid": uid,
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
def create_daily_report(payload: GenerateRequest, user: dict = Depends(require_user)):
    day = payload.date or date_type.today().isoformat()
    return _create(user["uid"], "daily", day, day, payload.language, payload.instructions)


@router.post("/weekly", response_model=Report, status_code=201)
def create_weekly_report(payload: GenerateRequest, user: dict = Depends(require_user)):
    anchor = date_type.fromisoformat(payload.date) if payload.date else date_type.today()
    monday = anchor - timedelta(days=anchor.weekday())
    end = min(monday + timedelta(days=6), date_type.today())
    return _create(
        user["uid"], "weekly", monday.isoformat(), end.isoformat(), payload.language, payload.instructions
    )


@router.post("/custom", response_model=Report, status_code=201)
def create_custom_report(payload: CustomRequest, user: dict = Depends(require_user)):
    """Báo cáo từ các note do người dùng tự chọn (gom nhiều ngày, lọc từng note)."""
    db = get_db()
    notes: list[dict] = []
    for nid in dict.fromkeys(payload.note_ids):  # bỏ id trùng, giữ thứ tự
        snap = db.collection("notes").document(nid).get()
        data = snap.to_dict() if snap.exists else None
        if not data or data.get("uid") != user["uid"]:
            raise HTTPException(status_code=404, detail="Note not found")
        notes.append(data)
    dates = sorted(n.get("date", "") for n in notes)
    try:
        content, insights = generate_report(notes, "custom", payload.language, payload.instructions)
    except AIReportError as e:
        raise HTTPException(status_code=502, detail=str(e))
    ref = db.collection(COLLECTION).document()
    ref.set(
        {
            "uid": user["uid"],
            "type": "custom",
            "language": payload.language,
            "period_start": dates[0],
            "period_end": dates[-1],
            "content": content,
            "insights": insights,
            "created_at": firestore.SERVER_TIMESTAMP,
        }
    )
    return _to_report(ref.get())


@router.get("", response_model=list[Report])
def list_reports(user: dict = Depends(require_user)):
    db = get_db()
    query = db.collection(COLLECTION).where(
        filter=firestore.firestore.FieldFilter("uid", "==", user["uid"])
    )
    reports = [_to_report(d) for d in query.stream()]
    reports.sort(key=lambda r: r.created_at, reverse=True)
    return reports


@router.get("/{report_id}", response_model=Report)
def get_report(report_id: str, user: dict = Depends(require_user)):
    db = get_db()
    return _to_report(_owned_report(db, report_id, user["uid"]))


@router.get("/{report_id}/docx")
def download_report_docx(report_id: str, user: dict = Depends(require_user)):
    db = get_db()
    data = _owned_report(db, report_id, user["uid"]).to_dict()
    content = report_to_docx(data)
    filename = f"takenote-{data.get('type', 'report')}-{data.get('period_start', report_id)}-{data.get('language', '')}.docx"
    return Response(
        content,
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.patch("/{report_id}", response_model=Report)
def update_report(report_id: str, payload: ReportUpdate, user: dict = Depends(require_user)):
    """Cho phép người dùng chỉnh tay nội dung báo cáo đã sinh."""
    db = get_db()
    _owned_report(db, report_id, user["uid"])
    ref = db.collection(COLLECTION).document(report_id)
    ref.update({"content": payload.content})
    return _to_report(ref.get())


@router.delete("/{report_id}", status_code=204)
def delete_report(report_id: str, user: dict = Depends(require_user)):
    db = get_db()
    _owned_report(db, report_id, user["uid"])
    db.collection(COLLECTION).document(report_id).delete()
