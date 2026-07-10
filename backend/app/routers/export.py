import io
import json
import zipfile
from collections import defaultdict
from datetime import date

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from firebase_admin import firestore

from ..auth import require_user
from ..firebase import get_db

router = APIRouter(tags=["export"])

MOOD_LABELS = {1: "😫 1/5", 2: "🙁 2/5", 3: "😐 3/5", 4: "🙂 4/5", 5: "😄 5/5"}


def _serialize(doc) -> dict:
    data = doc.to_dict()
    data.pop("uid", None)
    data["id"] = doc.id
    if "created_at" in data and data["created_at"] is not None:
        data["created_at"] = data["created_at"].isoformat()
    return data


def _day_markdown(day: str, notes: list[dict]) -> str:
    lines = [f"# {day}", ""]
    for n in sorted(notes, key=lambda x: x.get("created_at") or ""):
        time = (n.get("created_at") or "")[11:16]
        mood = MOOD_LABELS.get(n.get("mood"), "")
        tags = " ".join(f"#{t}" for t in n.get("tags", []))
        header = " · ".join(x for x in [time, mood, tags] if x)
        if header:
            lines.append(f"## {header}")
        lines.append(n.get("content", ""))
        lines.append("")
    return "\n".join(lines)


@router.get("/export")
def export_backup(user: dict = Depends(require_user)):
    db = get_db()
    uid_filter = firestore.firestore.FieldFilter("uid", "==", user["uid"])
    notes = [
        _serialize(d) for d in db.collection("notes").where(filter=uid_filter).stream()
    ]
    reports = [
        _serialize(d) for d in db.collection("reports").where(filter=uid_filter).stream()
    ]

    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.writestr(
            "data.json",
            json.dumps({"notes": notes, "reports": reports}, ensure_ascii=False, indent=2),
        )
        by_day: dict[str, list[dict]] = defaultdict(list)
        for n in notes:
            by_day[n.get("date", "unknown")].append(n)
        for day, day_notes in by_day.items():
            zf.writestr(f"notes/{day}.md", _day_markdown(day, day_notes))
        for r in reports:
            name = f"reports/{r.get('type', 'report')}-{r.get('period_start', r['id'])}.md"
            zf.writestr(name, r.get("content", ""))

    buffer.seek(0)
    filename = f"takenote-backup-{date.today().isoformat()}.zip"
    return StreamingResponse(
        buffer,
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
