from fastapi import APIRouter, Depends, HTTPException, Query
from firebase_admin import firestore

from ..auth import require_user
from ..firebase import get_db
from ..schemas import Note, NoteCreate, NoteUpdate

router = APIRouter(prefix="/notes", tags=["notes"])

COLLECTION = "notes"


def _to_note(doc) -> Note:
    data = doc.to_dict()
    data.pop("uid", None)
    return Note(id=doc.id, **data)


def _owned(db, note_id: str, uid: str):
    """Lấy document note nếu thuộc về user, ngược lại 404 (không lộ note người khác)."""
    ref = db.collection(COLLECTION).document(note_id)
    snap = ref.get()
    if not snap.exists or snap.to_dict().get("uid") != uid:
        raise HTTPException(status_code=404, detail="Note not found")
    return ref


@router.post("", response_model=Note, status_code=201)
def create_note(payload: NoteCreate, user: dict = Depends(require_user)):
    db = get_db()
    data = payload.model_dump()
    data["uid"] = user["uid"]
    data["created_at"] = firestore.SERVER_TIMESTAMP
    ref = db.collection(COLLECTION).document()
    ref.set(data)
    return _to_note(ref.get())


@router.get("", response_model=list[Note])
def list_notes(
    user: dict = Depends(require_user),
    date: str | None = Query(default=None, description="YYYY-MM-DD"),
    start: str | None = Query(default=None, description="YYYY-MM-DD"),
    end: str | None = Query(default=None, description="YYYY-MM-DD"),
):
    db = get_db()
    # Lọc theo user ở Firestore (equality), lọc ngày trong Python để khỏi cần composite index
    query = db.collection(COLLECTION).where(
        filter=firestore.firestore.FieldFilter("uid", "==", user["uid"])
    )
    notes = [_to_note(doc) for doc in query.stream()]
    if date:
        notes = [n for n in notes if n.date == date]
    else:
        if start:
            notes = [n for n in notes if n.date >= start]
        if end:
            notes = [n for n in notes if n.date <= end]
    notes.sort(key=lambda n: (n.date, n.created_at), reverse=True)
    return notes


@router.put("/{note_id}", response_model=Note)
def update_note(note_id: str, payload: NoteUpdate, user: dict = Depends(require_user)):
    db = get_db()
    ref = _owned(db, note_id, user["uid"])
    changes = payload.model_dump(exclude_unset=True)
    if changes:
        ref.update(changes)
    return _to_note(ref.get())


@router.delete("/{note_id}", status_code=204)
def delete_note(note_id: str, user: dict = Depends(require_user)):
    db = get_db()
    ref = _owned(db, note_id, user["uid"])
    ref.delete()
