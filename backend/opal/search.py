"""Search query parsing and execution."""

from __future__ import annotations

import re
from dataclasses import asdict, dataclass, field
from datetime import datetime, timedelta, timezone
from typing import Any, Literal

MatchLevel = Literal["broad", "balanced", "strict"]
SearchMode = Literal["vibe", "exact", "hybrid", "filter_only"]
MatchKind = Literal["exact", "include", "similar"]

MATCH_THRESHOLDS: dict[MatchLevel, float] = {
    "broad": 0.0,
    "balanced": 0.25,
    "strict": 0.45,
}

TOKEN_RE = re.compile(r'"[^"]*"|\'[^\']*\'|\S+')


@dataclass
class SearchPlan:
    raw: str = ""
    vibe_text: str = ""
    exact_phrases: list[str] = field(default_factory=list)
    include_words: list[str] = field(default_factory=list)
    exclude_words: list[str] = field(default_factory=list)
    include_folders: list[str] = field(default_factory=list)
    exclude_folders: list[str] = field(default_factory=list)
    has_text: bool | None = None
    date_after: str | None = None
    date_before: str | None = None
    match: MatchLevel = "balanced"
    mode: SearchMode = "vibe"

    def to_summary(self) -> dict[str, Any]:
        return asdict(self)

    @classmethod
    def from_summary(cls, data: dict[str, Any]) -> SearchPlan:
        plan = cls()
        for key, value in data.items():
            if hasattr(plan, key):
                setattr(plan, key, value)
        return plan


def _strip_quotes(value: str) -> str:
    if len(value) >= 2 and value[0] == value[-1] and value[0] in "\"'":
        return value[1:-1]
    return value


def _during_range(value: str) -> tuple[str, str]:
    value = value.strip()
    if re.fullmatch(r"\d{4}", value):
        return f"{value}-01-01", f"{int(value) + 1}-01-01"
    if re.fullmatch(r"\d{4}-\d{2}", value):
        year, month = value.split("-")
        month_int = int(month)
        if month_int == 12:
            return f"{value}-01", f"{int(year) + 1}-01-01"
        return f"{value}-01", f"{year}-{month_int + 1:02d}-01"
    if re.fullmatch(r"\d{4}-\d{2}-\d{2}", value):
        dt = datetime.strptime(value, "%Y-%m-%d")
        end = (dt + timedelta(days=1)).strftime("%Y-%m-%d")
        return value, end
    return value, value


def parse_search(raw: str) -> SearchPlan:
    plan = SearchPlan(raw=raw.strip())
    vibe_parts: list[str] = []

    for token in TOKEN_RE.findall(raw):
        if not token:
            continue

        if (token.startswith('"') and token.endswith('"')) or (
            token.startswith("'") and token.endswith("'")
        ):
            phrase = _strip_quotes(token).strip()
            if phrase:
                plan.exact_phrases.append(phrase)
            continue

        lower = token.lower()

        if lower.startswith("exact:"):
            phrase = token[6:].strip()
            if phrase:
                plan.exact_phrases.append(_strip_quotes(phrase))
            continue

        if lower.startswith("include:"):
            word = token[8:].strip()
            if word:
                plan.include_words.append(word)
            continue

        if token.startswith("+") and len(token) > 1:
            plan.include_words.append(token[1:])
            continue

        if lower.startswith("-in:"):
            folder = token[4:].strip()
            if folder:
                plan.exclude_folders.append(folder)
            continue

        if lower.startswith("in:"):
            folder = token[3:].strip()
            if folder:
                plan.include_folders.append(folder)
            continue

        if token.startswith("-") and not lower.startswith("-in:"):
            word = token[1:].strip()
            if word:
                plan.exclude_words.append(word)
            continue

        if lower.startswith("after:"):
            plan.date_after = token[6:].strip() or plan.date_after
            continue

        if lower.startswith("before:"):
            plan.date_before = token[7:].strip() or plan.date_before
            continue

        if lower.startswith("during:"):
            start, end = _during_range(token[7:])
            plan.date_after = start
            plan.date_before = end
            continue

        if lower in ("has:text", "has_text"):
            plan.has_text = True
            continue

        if lower in ("visual:", "type:visual", "visual"):
            plan.has_text = False
            continue

        if lower.startswith("match:"):
            level = token[6:].strip().lower()
            if level in MATCH_THRESHOLDS:
                plan.match = level  # type: ignore[assignment]
            continue

        vibe_parts.append(token)

    plan.vibe_text = " ".join(vibe_parts).strip()

    if plan.exact_phrases or plan.include_words:
        plan.mode = "hybrid" if plan.vibe_text else "exact"
    elif plan.vibe_text:
        plan.mode = "vibe"
    else:
        plan.mode = "filter_only"

    return plan


def merge_plan(
    plan: SearchPlan,
    *,
    match: MatchLevel | None = None,
    has_text: bool | None = None,
    folder: str | None = None,
) -> SearchPlan:
    if match:
        plan.match = match
    if has_text is not None:
        plan.has_text = has_text
    if folder and folder not in plan.include_folders:
        plan.include_folders.append(folder)
    return plan


def _passes_excludes(record, plan: SearchPlan) -> bool:
    hay = f"{record.ocr_text} {record.rel_path}".lower()
    for word in plan.exclude_words:
        if word.lower() in hay:
            return False
    for folder in plan.exclude_folders:
        prefix = folder.lower()
        rel = record.rel_path.lower()
        if rel == prefix or rel.startswith(f"{prefix}/"):
            return False
    return True


def _passes_folder_includes(record, plan: SearchPlan) -> bool:
    if not plan.include_folders:
        return True
    rel = record.rel_path.lower()
    for folder in plan.include_folders:
        prefix = folder.lower()
        if rel == prefix or rel.startswith(f"{prefix}/"):
            return True
    return False


def _photo_date(record) -> str | None:
    if record.exif_date:
        return record.exif_date[:10]
    if record.mtime:
        return datetime.fromtimestamp(record.mtime, tz=timezone.utc).strftime("%Y-%m-%d")
    return None


def _passes_dates(record, plan: SearchPlan) -> bool:
    photo_date = _photo_date(record)
    if not photo_date:
        return plan.date_after is None and plan.date_before is None
    if plan.date_after and photo_date < plan.date_after[:10]:
        return False
    if plan.date_before and photo_date >= plan.date_before[:10]:
        return False
    return True


def execute_search(plan: SearchPlan, manifest, chroma, embedder, limit: int = 48):
    """Return list of (PhotoRecord, match_kind, similarity)."""
    threshold = MATCH_THRESHOLDS[plan.match]
    ranked: list[tuple[Any, MatchKind, float | None]] = []
    seen: set[str] = set()

    def add(record, kind: MatchKind, similarity: float | None = None) -> None:
        if record.id in seen:
            return
        if not manifest.record_in_active_library(record):
            return
        if not _passes_excludes(record, plan):
            return
        if not _passes_folder_includes(record, plan):
            return
        if not _passes_dates(record, plan):
            return
        if plan.has_text is True and not record.has_text:
            return
        if plan.has_text is False and record.has_text:
            return
        if kind == "similar" and similarity is not None and similarity < threshold:
            return
        seen.add(record.id)
        ranked.append((record, kind, similarity))

    ocr_hits = manifest.search_ocr_filtered(
        exact_phrases=plan.exact_phrases,
        include_words=plan.include_words,
        include_folders=plan.include_folders,
        has_text=plan.has_text,
        date_after=plan.date_after,
        date_before=plan.date_before,
        limit=min(limit * 3, 200),
    )
    for record, kind in ocr_hits:
        add(record, kind, 1.0 if kind == "exact" else 0.9)

    if plan.vibe_text:
        where: dict | None = None
        if plan.has_text is True:
            where = {"has_text": True}
        elif plan.has_text is False:
            where = {"has_text": False}

        query_vector = embedder.embed_text(plan.vibe_text)
        raw = chroma.query(
            query_embedding=query_vector,
            query_text=plan.vibe_text,
            n_results=min(limit * 4, 120),
            where=where,
        )
        if raw.get("metadatas") and raw["metadatas"][0]:
            for cid, meta, dist in zip(
                raw["ids"][0],
                raw["metadatas"][0],
                raw.get("distances", [[]])[0],
            ):
                similarity = round(1.0 - dist, 4)
                record = manifest.get_by_id(cid)
                if record:
                    add(record, "similar", similarity)

    if not ranked and plan.mode == "filter_only":
        for record in manifest.list_filtered(
            include_folders=plan.include_folders,
            has_text=plan.has_text,
            date_after=plan.date_after,
            date_before=plan.date_before,
            limit=limit,
        ):
            add(record, "include", None)

    kind_order = {"exact": 0, "include": 1, "similar": 2}
    ranked.sort(key=lambda item: (kind_order[item[1]], -(item[2] or 0)))
    return ranked[:limit]
