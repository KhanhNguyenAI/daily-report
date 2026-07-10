from fastapi import APIRouter, HTTPException

from ..firebase import get_db
from ..schemas import Report

router = APIRouter(prefix="/reports", tags=["reports"])

COLLECTION = "reports"


def _to_report(doc) -> Report:
    return Report(id=doc.id, **doc.to_dict())


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
