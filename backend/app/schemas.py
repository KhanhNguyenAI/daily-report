from datetime import date as date_type
from datetime import datetime

from pydantic import BaseModel, Field, field_validator


def today_str() -> str:
    return date_type.today().isoformat()


class NoteCreate(BaseModel):
    content: str = Field(min_length=1, max_length=10_000)
    mood: int | None = Field(default=None, ge=1, le=5)
    tags: list[str] = Field(default_factory=list)
    date: str = Field(default_factory=today_str)

    @field_validator("date")
    @classmethod
    def valid_date(cls, v: str) -> str:
        date_type.fromisoformat(v)
        return v

    @field_validator("tags")
    @classmethod
    def clean_tags(cls, v: list[str]) -> list[str]:
        return [t.strip() for t in v if t.strip()][:10]


class NoteUpdate(BaseModel):
    content: str | None = Field(default=None, min_length=1, max_length=10_000)
    mood: int | None = Field(default=None, ge=1, le=5)
    tags: list[str] | None = None


class Note(BaseModel):
    id: str
    content: str
    mood: int | None = None
    tags: list[str] = Field(default_factory=list)
    date: str
    created_at: datetime
