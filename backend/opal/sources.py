"""Library source (folder) management."""

from __future__ import annotations

import uuid
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path


DEFAULT_SOURCE_ID = "00000000-0000-4000-8000-000000000001"


def normalize_source_path(path: str | Path) -> str:
    """Return a stable absolute path string for storage and lookup."""
    return str(Path(path).expanduser().resolve())


def default_source_name(path: str) -> str:
    return Path(path).name or "Library"


@dataclass
class SourceRecord:
    id: str
    name: str
    path: str
    enabled: bool
    created_at: str
    last_scan_at: str | None
    removed_at: str | None

    @property
    def root(self) -> Path:
        return Path(self.path)


def new_source_id() -> str:
    return str(uuid.uuid4())


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()
