"""Sinh báo cáo từ note nhật ký bằng Gemini.

Tư duy 2 bước ép trong prompt: (1) phân tích note thô — tách công việc / kết quả /
khó khăn / bài học / cảm xúc; (2) viết lại thành báo cáo chuyên nghiệp cho người
khác đọc, đúng ngôn ngữ yêu cầu, không bịa thông tin.
"""

import json

from google import genai
from google.genai import errors as genai_errors

from ..config import settings

# Model chính hay 503 lúc cao điểm → thử lần lượt
MODELS = ["gemini-3.5-flash", "gemini-3.1-flash-lite"]

LANGUAGES = {
    "en": "English",
    "ja": "Japanese, polite business style (です/ます体)",
    "vi": "Vietnamese",
}

DAILY_SECTIONS = """- Day summary (2-3 sentences)
- Work completed (bullet points)
- Difficulties & how they were handled
- Lessons learned / new knowledge
- Next plans (only if mentioned in the notes)"""

WEEKLY_SECTIONS = """- Week summary (3-4 sentences)
- Work completed (bullet points, grouped logically)
- Difficulties & how they were handled
- Lessons learned / new knowledge
- Progress made this week
- Goals for next week (only if mentioned in the notes)"""

PROMPT_TEMPLATE = """You are an assistant helping a software engineering intern turn their personal diary notes into a professional {kind} report for their mentor.

Step 1 — analyze silently. The notes are informal, possibly messy, emotional, and may mix languages. Separate: (a) work done, (b) results/progress, (c) difficulties encountered, (d) lessons learned, (e) emotions.

Step 2 — write the report in {language}. Rules:
- Polite first person, professional tone a mentor/manager can read.
- Never invent information that is not in the notes.
- Keep technical terms accurate (do not translate library/tool names).
- Filter out raw personal emotions and informal expressions; a brief, professional reflection is fine.
- Markdown format. Section headings written in {language}, following this structure:
{sections}
- Skip a section entirely if the notes contain nothing for it.

Return ONLY a valid JSON object, no other text:
{{"report": "<the markdown report>", "insights": {{"mood": "<one-line mood summary in {language}>", "difficulties": ["<recurring or notable difficulties, in {language}>"], "suggestions": ["<1-2 short improvement suggestions, in {language}>"]}}}}

The diary notes:
{notes}"""


class AIReportError(Exception):
    """Lỗi khi gọi Gemini — router chuyển thành HTTP error."""


def _client() -> genai.Client:
    if not settings.gemini_api_key:
        raise AIReportError("GEMINI_API_KEY is not configured")
    return genai.Client(api_key=settings.gemini_api_key)


def _format_notes(notes: list[dict]) -> str:
    lines = []
    for n in sorted(notes, key=lambda x: (x.get("date", ""), str(x.get("created_at", "")))):
        mood = f" (mood {n['mood']}/5)" if n.get("mood") else ""
        tags = f" [tags: {', '.join(n['tags'])}]" if n.get("tags") else ""
        lines.append(f"- {n.get('date', '')}{mood}{tags}: {n.get('content', '')}")
    return "\n".join(lines)


def generate_report(
    notes: list[dict], kind: str, language: str
) -> tuple[str, dict]:
    """Trả về (report_markdown, insights)."""
    prompt = PROMPT_TEMPLATE.format(
        kind=kind,
        language=LANGUAGES.get(language, LANGUAGES["ja"]),
        sections=DAILY_SECTIONS if kind == "daily" else WEEKLY_SECTIONS,
        notes=_format_notes(notes),
    )

    client = _client()
    last_error: Exception | None = None
    for model in MODELS:
        try:
            response = client.models.generate_content(
                model=model,
                contents=prompt,
                config={"response_mime_type": "application/json"},
            )
            break
        except genai_errors.APIError as e:
            last_error = e
            continue
    else:
        raise AIReportError(f"All Gemini models failed: {last_error}")

    try:
        data = json.loads(response.text)
        report = data["report"]
        insights = data.get("insights", {})
    except (json.JSONDecodeError, KeyError, TypeError):
        # Model trả text không đúng JSON — vẫn dùng được phần text làm báo cáo
        report = response.text or ""
        insights = {}
    if not report.strip():
        raise AIReportError("Gemini returned an empty report")
    return report, insights
