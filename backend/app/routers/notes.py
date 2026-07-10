from fastapi import APIRouter, HTTPException, Query
from firebase_admin import firestore

from ..firebase import get_db
from ..schemas import Note, NoteCreate, NoteUpdate

router = APIRouter(prefix="/notes", tags=["notes"])

COLLECTION = "notes"


def _to_note(doc) -> Note:
    data = doc.to_dict()
    return Note(id=doc.id, **data)


@router.post("", response_model=Note, status_code=201)
def create_note(payload: NoteCreate):
    db = get_db()
    data = payload.model_dump()
    data["created_at"] = firestore.SERVER_TIMESTAMP
    ref = db.collection(COLLECTION).document()
    ref.set(data)
    return _to_note(ref.get())


@router.get("", response_model=list[Note])
def list_notes(
    date: str | None = Query(default=None, description="YYYY-MM-DD"),
    start: str | None = Query(default=None, description="YYYY-MM-DD"),
    end: str | None = Query(default=None, description="YYYY-MM-DD"),
):
    db = get_db()
    query = db.collection(COLLECTION)
    if date:
        query = query.where(filter=firestore.firestore.FieldFilter("date", "==", date))
    else:
        if start:
            query = query.where(filter=firestore.firestore.FieldFilter("date", ">=", start))
        if end:
            query = query.where(filter=firestore.firestore.FieldFilter("date", "<=", end))
    notes = [_to_note(doc) for doc in query.stream()]
    # Sắp xếp trong Python để không cần composite index của Firestore
    notes.sort(key=lambda n: (n.date, n.created_at), reverse=True)
    return notes


@router.put("/{note_id}", response_model=Note)
def update_note(note_id: str, payload: NoteUpdate):
    db = get_db()
    ref = db.collection(COLLECTION).document(note_id)
    if not ref.get().exists:
        raise HTTPException(status_code=404, detail="Note not found")
    changes = payload.model_dump(exclude_unset=True)
    if changes:
        ref.update(changes)
    return _to_note(ref.get())


@router.delete("/{note_id}", status_code=204)
def delete_note(note_id: str):
    db = get_db()
    ref = db.collection(COLLECTION).document(note_id)
    if not ref.get().exists:
        raise HTTPException(status_code=404, detail="Note not found")
    ref.delete()
