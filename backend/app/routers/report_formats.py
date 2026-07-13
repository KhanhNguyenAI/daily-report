"""Định dạng báo cáo lưu sẵn — mẫu chỉ dẫn trình bày người dùng hay dùng lại.

Lưu ở Firestore để dùng được trên nhiều thiết bị. Người dùng mới chưa có gì
sẽ được seed 1 mẫu mặc định gồm 2 mục chính: 学習および実施事項 và 翌日の予定.
"""

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from firebase_admin import firestore
from pydantic import BaseModel, Field

from ..auth import require_user
from ..firebase import get_db

router = APIRouter(prefix="/report-formats", tags=["report-formats"])

COLLECTION = "report_formats"

DEFAULT_NAME = "Mặc định"
DEFAULT_CONTENT = (
    "Báo cáo gồm 2 mục chính: "
    "1) 学習および実施事項 — các công việc đã thực hiện và kiến thức đã học; "
    "2) 翌日の予定 — dự định cho ngày làm việc tiếp theo "
    "(dựa trên công việc dang dở hoặc kế hoạch được nhắc trong note)."
)


class ReportFormat(BaseModel):
    id: str
    name: str
    content: str
    is_default: bool = False
    created_at: datetime


class FormatCreate(BaseModel):
    name: str = Field(min_length=1, max_length=50)
    content: str = Field(min_length=1, max_length=500)
    is_default: bool = False


class FormatUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=50)
    content: str | None = Field(default=None, min_length=1, max_length=500)
    is_default: bool | None = None


def _to_format(doc) -> ReportFormat:
    data = doc.to_dict()
    data.pop("uid", None)
    return ReportFormat(id=doc.id, **data)


def _owned(db, format_id: str, uid: str):
    ref = db.collection(COLLECTION).document(format_id)
    snap = ref.get()
    if not snap.exists or snap.to_dict().get("uid") != uid:
        raise HTTPException(status_code=404, detail="Format not found")
    return ref


def _query(db, uid: str):
    return db.collection(COLLECTION).where(
        filter=firestore.firestore.FieldFilter("uid", "==", uid)
    )


def _unset_other_defaults(db, uid: str, keep_id: str | None = None) -> None:
    for doc in _query(db, uid).stream():
        if doc.id != keep_id and doc.to_dict().get("is_default"):
            doc.reference.update({"is_default": False})


@router.get("", response_model=list[ReportFormat])
def list_formats(user: dict = Depends(require_user)):
    db = get_db()
    formats = [_to_format(d) for d in _query(db, user["uid"]).stream()]
    if not formats:
        # Người dùng mới: seed mẫu mặc định để luôn có 1 định dạng dùng ngay
        ref = db.collection(COLLECTION).document()
        ref.set(
            {
                "uid": user["uid"],
                "name": DEFAULT_NAME,
                "content": DEFAULT_CONTENT,
                "is_default": True,
                "created_at": firestore.SERVER_TIMESTAMP,
            }
        )
        formats = [_to_format(ref.get())]
    formats.sort(key=lambda f: f.created_at)
    return formats


@router.post("", response_model=ReportFormat, status_code=201)
def create_format(payload: FormatCreate, user: dict = Depends(require_user)):
    db = get_db()
    ref = db.collection(COLLECTION).document()
    ref.set(
        {
            "uid": user["uid"],
            "name": payload.name.strip(),
            "content": payload.content.strip(),
            "is_default": payload.is_default,
            "created_at": firestore.SERVER_TIMESTAMP,
        }
    )
    if payload.is_default:
        _unset_other_defaults(db, user["uid"], keep_id=ref.id)
    return _to_format(ref.get())


@router.patch("/{format_id}", response_model=ReportFormat)
def update_format(format_id: str, payload: FormatUpdate, user: dict = Depends(require_user)):
    db = get_db()
    ref = _owned(db, format_id, user["uid"])
    updates = {k: v for k, v in payload.model_dump(exclude_unset=True).items() if v is not None}
    if "name" in updates:
        updates["name"] = updates["name"].strip()
    if "content" in updates:
        updates["content"] = updates["content"].strip()
    if updates:
        ref.update(updates)
    if updates.get("is_default"):
        _unset_other_defaults(db, user["uid"], keep_id=format_id)
    return _to_format(ref.get())


@router.delete("/{format_id}", status_code=204)
def delete_format(format_id: str, user: dict = Depends(require_user)):
    db = get_db()
    _owned(db, format_id, user["uid"]).delete()
