"""SQLite manifest — source of truth for indexed photos."""

import hashlib
import logging
import sqlite3
from contextlib import contextmanager
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterator

from config import CLIP_MODEL, IMAGE_FOLDER, MANIFEST_PATH, ensure_dirs
from scanner import ScannedFile, with_content_hash

logger = logging.getLogger("photo_organizer.manifest")

STATUS_PENDING = "pending"
STATUS_CLIP_DONE = "clip_done"
STATUS_OCR_DONE = "ocr_done"
STATUS_INDEXED = "indexed"
STATUS_FAILED = "failed"
STATUS_MISSING = "missing"


def path_id(rel_path: str) -> str:
    """Stable manifest id per file path."""
    return hashlib.sha256(rel_path.encode()).hexdigest()


@dataclass
class PhotoRecord:
    id: str
    rel_path: str
    file_size: int
    mtime: float
    content_hash: str
    ocr_text: str
    has_text: bool
    clip_model: str
    indexed_at: str | None
    status: str
    error_msg: str | None
    duplicate_of: str | None
    exif_date: str | None


SCHEMA = """
CREATE TABLE IF NOT EXISTS photos (
    id TEXT PRIMARY KEY,
    rel_path TEXT UNIQUE NOT NULL,
    file_size INTEGER NOT NULL,
    mtime REAL NOT NULL,
    content_hash TEXT NOT NULL,
    ocr_text TEXT DEFAULT '',
    has_text INTEGER DEFAULT 0,
    clip_model TEXT DEFAULT '',
    indexed_at TEXT,
    status TEXT DEFAULT 'pending',
    error_msg TEXT,
    duplicate_of TEXT,
    exif_date TEXT
);
CREATE INDEX IF NOT EXISTS idx_photos_status ON photos(status);
CREATE INDEX IF NOT EXISTS idx_photos_rel_path ON photos(rel_path);
CREATE INDEX IF NOT EXISTS idx_photos_content_hash ON photos(content_hash);
"""


class Manifest:
    def __init__(self, db_path: Path | None = None):
        ensure_dirs()
        self.db_path = db_path or MANIFEST_PATH
        self._init_db()

    def _init_db(self) -> None:
        with self._connect() as conn:
            conn.executescript(SCHEMA)

    @contextmanager
    def _connect(self) -> Iterator[sqlite3.Connection]:
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        try:
            yield conn
            conn.commit()
        finally:
            conn.close()

    def _row_to_record(self, row: sqlite3.Row) -> PhotoRecord:
        return PhotoRecord(
            id=row["id"],
            rel_path=row["rel_path"],
            file_size=row["file_size"],
            mtime=row["mtime"],
            content_hash=row["content_hash"],
            ocr_text=row["ocr_text"] or "",
            has_text=bool(row["has_text"]),
            clip_model=row["clip_model"] or "",
            indexed_at=row["indexed_at"],
            status=row["status"],
            error_msg=row["error_msg"],
            duplicate_of=row["duplicate_of"],
            exif_date=row["exif_date"],
        )

    def get_by_id(self, photo_id: str) -> PhotoRecord | None:
        with self._connect() as conn:
            row = conn.execute(
                "SELECT * FROM photos WHERE id = ?", (photo_id,)
            ).fetchone()
            if not row:
                row = conn.execute(
                    "SELECT * FROM photos WHERE content_hash = ? AND duplicate_of IS NULL LIMIT 1",
                    (photo_id,),
                ).fetchone()
            if not row:
                row = conn.execute(
                    "SELECT * FROM photos WHERE content_hash = ? LIMIT 1",
                    (photo_id,),
                ).fetchone()
        return self._row_to_record(row) if row else None

    def get_canonical_by_content_hash(self, content_hash: str) -> PhotoRecord | None:
        with self._connect() as conn:
            rows = conn.execute(
                "SELECT * FROM photos WHERE content_hash = ? AND duplicate_of IS NULL "
                "ORDER BY rel_path",
                (content_hash,),
            ).fetchall()
        for row in rows:
            record = self._row_to_record(row)
            if self._record_is_alive(record):
                return record
        return None

    def _record_is_alive(self, record: PhotoRecord) -> bool:
        """True if the record still exists on disk and is not marked missing."""
        if record.status == STATUS_MISSING:
            return False
        return (IMAGE_FOLDER / record.rel_path).exists()

    def get_all_rel_paths(self) -> set[str]:
        with self._connect() as conn:
            rows = conn.execute("SELECT rel_path FROM photos").fetchall()
        return {row["rel_path"] for row in rows}

    def get_by_rel_path(self, rel_path: str) -> PhotoRecord | None:
        with self._connect() as conn:
            row = conn.execute(
                "SELECT * FROM photos WHERE rel_path = ?", (rel_path,)
            ).fetchone()
        return self._row_to_record(row) if row else None

    def get_by_status(self, status: str) -> list[PhotoRecord]:
        with self._connect() as conn:
            rows = conn.execute(
                "SELECT * FROM photos WHERE status = ? ORDER BY rel_path", (status,)
            ).fetchall()
        return [self._row_to_record(r) for r in rows]

    def get_all_indexed(self) -> list[PhotoRecord]:
        with self._connect() as conn:
            rows = conn.execute(
                "SELECT * FROM photos WHERE status IN ('indexed', 'ocr_done', 'clip_done') "
                "ORDER BY rel_path"
            ).fetchall()
        return [self._row_to_record(r) for r in rows]

    def upsert_scanned(
        self, scanned: ScannedFile
    ) -> tuple[PhotoRecord, bool, str | None, bool]:
        """Returns (record, needs_reindex, stale_chroma_id, is_identical_duplicate)."""
        existing = self.get_by_rel_path(scanned.rel_path)
        needs_reindex = False
        stale_chroma_id: str | None = None
        file_id = path_id(scanned.rel_path)

        if existing is None:
            scanned = with_content_hash(scanned)
            canonical = self.get_canonical_by_content_hash(scanned.content_hash)

            if canonical:
                record = PhotoRecord(
                    id=file_id,
                    rel_path=scanned.rel_path,
                    file_size=scanned.file_size,
                    mtime=scanned.mtime,
                    content_hash=scanned.content_hash,
                    ocr_text=canonical.ocr_text,
                    has_text=canonical.has_text,
                    clip_model=canonical.clip_model,
                    indexed_at=canonical.indexed_at,
                    status=canonical.status,
                    error_msg=None,
                    duplicate_of=canonical.id,
                    exif_date=canonical.exif_date,
                )
                self._insert(record)
                logger.debug(
                    "Identical bytes: %s == %s",
                    scanned.rel_path,
                    canonical.rel_path,
                )
                return record, False, None, True

            record = PhotoRecord(
                id=file_id,
                rel_path=scanned.rel_path,
                file_size=scanned.file_size,
                mtime=scanned.mtime,
                content_hash=scanned.content_hash,
                ocr_text="",
                has_text=False,
                clip_model="",
                indexed_at=None,
                status=STATUS_PENDING,
                error_msg=None,
                duplicate_of=None,
                exif_date=None,
            )
            needs_reindex = True
            self._insert(record)
            return record, needs_reindex, stale_chroma_id, False

        if existing.file_size != scanned.file_size or existing.mtime != scanned.mtime:
            scanned = with_content_hash(scanned)
            if existing.content_hash != scanned.content_hash:
                needs_reindex = True
                stale_chroma_id = existing.content_hash
                self._update_changed(file_id, scanned)
                existing = self.get_by_rel_path(scanned.rel_path)
                assert existing is not None
                return existing, needs_reindex, stale_chroma_id, False
            self._update_stats(file_id, scanned.file_size, scanned.mtime)

        return existing, False, stale_chroma_id, False

    def _insert(self, record: PhotoRecord) -> None:
        with self._connect() as conn:
            conn.execute(
                """
                INSERT INTO photos (
                    id, rel_path, file_size, mtime, content_hash,
                    ocr_text, has_text, clip_model, indexed_at, status,
                    error_msg, duplicate_of, exif_date
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    record.id,
                    record.rel_path,
                    record.file_size,
                    record.mtime,
                    record.content_hash,
                    record.ocr_text,
                    int(record.has_text),
                    record.clip_model,
                    record.indexed_at,
                    record.status,
                    record.error_msg,
                    record.duplicate_of,
                    record.exif_date,
                ),
            )

    def _update_changed(self, file_id: str, scanned: ScannedFile) -> None:
        with self._connect() as conn:
            conn.execute(
                """
                UPDATE photos SET
                    file_size = ?, mtime = ?, content_hash = ?,
                    ocr_text = '', has_text = 0, clip_model = '',
                    indexed_at = NULL, status = ?, error_msg = NULL,
                    duplicate_of = NULL, exif_date = NULL
                WHERE id = ?
                """,
                (
                    scanned.file_size,
                    scanned.mtime,
                    scanned.content_hash,
                    STATUS_PENDING,
                    file_id,
                ),
            )

    def _update_stats(self, file_id: str, file_size: int, mtime: float) -> None:
        with self._connect() as conn:
            conn.execute(
                "UPDATE photos SET file_size = ?, mtime = ? WHERE id = ?",
                (file_size, mtime, file_id),
            )

    def _sync_status_for_content_hash(self, content_hash: str, conn: sqlite3.Connection) -> None:
        canonical = conn.execute(
            "SELECT * FROM photos WHERE content_hash = ? AND duplicate_of IS NULL LIMIT 1",
            (content_hash,),
        ).fetchone()
        if not canonical:
            return
        conn.execute(
            """
            UPDATE photos SET
                status = ?, clip_model = ?, indexed_at = ?,
                ocr_text = ?, has_text = ?, exif_date = ?
            WHERE content_hash = ? AND id != ?
            """,
            (
                canonical["status"],
                canonical["clip_model"],
                canonical["indexed_at"],
                canonical["ocr_text"],
                canonical["has_text"],
                canonical["exif_date"],
                content_hash,
                canonical["id"],
            ),
        )

    def mark_clip_done(self, photo_id: str) -> None:
        now = datetime.now(timezone.utc).isoformat()
        with self._connect() as conn:
            row = conn.execute(
                "SELECT content_hash FROM photos WHERE id = ?", (photo_id,)
            ).fetchone()
            conn.execute(
                """
                UPDATE photos SET status = ?, clip_model = ?, indexed_at = ?
                WHERE id = ?
                """,
                (STATUS_CLIP_DONE, CLIP_MODEL, now, photo_id),
            )
            if row:
                self._sync_status_for_content_hash(row["content_hash"], conn)

    def mark_ocr_done(
        self, photo_id: str, ocr_text: str, exif_date: str | None = None
    ) -> None:
        has_text = bool(ocr_text.strip())
        now = datetime.now(timezone.utc).isoformat()
        with self._connect() as conn:
            row = conn.execute(
                "SELECT content_hash FROM photos WHERE id = ?", (photo_id,)
            ).fetchone()
            conn.execute(
                """
                UPDATE photos SET
                    ocr_text = ?, has_text = ?, status = ?,
                    indexed_at = ?, exif_date = COALESCE(?, exif_date),
                    error_msg = NULL
                WHERE id = ?
                """,
                (ocr_text, int(has_text), STATUS_INDEXED, now, exif_date, photo_id),
            )
            if row:
                self._sync_status_for_content_hash(row["content_hash"], conn)

    def mark_failed(self, photo_id: str, error_msg: str) -> None:
        with self._connect() as conn:
            conn.execute(
                "UPDATE photos SET status = ?, error_msg = ? WHERE id = ?",
                (STATUS_FAILED, error_msg[:500], photo_id),
            )

    def mark_duplicate(self, photo_id: str, duplicate_of: str) -> None:
        with self._connect() as conn:
            conn.execute(
                "UPDATE photos SET duplicate_of = ? WHERE id = ?",
                (duplicate_of, photo_id),
            )

    def mark_missing(self, rel_paths: set[str]) -> int:
        if not rel_paths:
            return 0
        placeholders = ",".join("?" * len(rel_paths))
        with self._connect() as conn:
            cursor = conn.execute(
                f"UPDATE photos SET status = ? WHERE rel_path IN ({placeholders}) "
                f"AND status != ?",
                [STATUS_MISSING, *rel_paths, STATUS_MISSING],
            )
            return cursor.rowcount

    def get_pending_clip(self) -> list[PhotoRecord]:
        with self._connect() as conn:
            rows = conn.execute(
                """
                SELECT * FROM photos
                WHERE status IN (?, ?) AND duplicate_of IS NULL
                ORDER BY rel_path
                """,
                (STATUS_PENDING, STATUS_FAILED),
            ).fetchall()
        return [self._row_to_record(r) for r in rows]

    def get_pending_ocr(self) -> list[PhotoRecord]:
        with self._connect() as conn:
            rows = conn.execute(
                """
                SELECT * FROM photos
                WHERE status = ? AND duplicate_of IS NULL
                ORDER BY rel_path
                """,
                (STATUS_CLIP_DONE,),
            ).fetchall()
        return [self._row_to_record(r) for r in rows]

    def count_by_status(self) -> dict[str, int]:
        with self._connect() as conn:
            rows = conn.execute(
                "SELECT status, COUNT(*) as cnt FROM photos GROUP BY status"
            ).fetchall()
        return {row["status"]: row["cnt"] for row in rows}

    def total_count(self) -> int:
        with self._connect() as conn:
            row = conn.execute("SELECT COUNT(*) as cnt FROM photos").fetchone()
        return row["cnt"] if row else 0

    def get_ocr_text_map(self) -> dict[str, str]:
        with self._connect() as conn:
            rows = conn.execute(
                "SELECT id, ocr_text FROM photos WHERE ocr_text != ''"
            ).fetchall()
        return {row["id"]: row["ocr_text"] for row in rows}
