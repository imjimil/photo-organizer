"""SQLite manifest — source of truth for indexed photos."""

import hashlib
import json
import logging
import os
import sqlite3
import uuid
from contextlib import contextmanager
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterator, Literal

from opal.config import CLIP_MODEL, IMAGE_FOLDER, MANIFEST_PATH, ensure_dirs
from opal.scanner import ScannedFile, with_content_hash
from opal.sources import (
    DEFAULT_SOURCE_ID,
    SourceRecord,
    default_source_name,
    new_source_id,
    normalize_source_path,
    now_iso,
)

logger = logging.getLogger("photo_organizer.manifest")

STATUS_PENDING = "pending"
STATUS_CLIP_DONE = "clip_done"
STATUS_OCR_DONE = "ocr_done"
STATUS_INDEXED = "indexed"
STATUS_FAILED = "failed"
STATUS_MISSING = "missing"

FAVORITES_ALBUM_ID = "00000000-0000-4000-8000-000000000001"
FAVORITES_ALBUM_NAME = "Favorites"
RESERVED_ALBUM_NAMES = frozenset({FAVORITES_ALBUM_NAME.casefold()})


def path_id(rel_path: str, source_id: str | None = None) -> str:
    """Stable manifest id per file path (scoped by source when provided)."""
    if source_id:
        payload = f"{source_id}:{rel_path}"
        return hashlib.sha256(payload.encode()).hexdigest()
    return hashlib.sha256(rel_path.encode()).hexdigest()


@dataclass
class AlbumRecord:
    id: str
    name: str
    created_at: str
    updated_at: str
    cover_photo_id: str | None
    count: int = 0
    is_system: bool = False


@dataclass
class PhotoRecord:
    id: str
    source_id: str
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
    width: int | None = None
    height: int | None = None


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
    exif_date TEXT,
    width INTEGER,
    height INTEGER
);
CREATE INDEX IF NOT EXISTS idx_photos_status ON photos(status);
CREATE INDEX IF NOT EXISTS idx_photos_rel_path ON photos(rel_path);
CREATE INDEX IF NOT EXISTS idx_photos_content_hash ON photos(content_hash);
CREATE TABLE IF NOT EXISTS albums (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL COLLATE NOCASE UNIQUE,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    cover_photo_id TEXT
);
CREATE TABLE IF NOT EXISTS album_items (
    album_id TEXT NOT NULL REFERENCES albums(id) ON DELETE CASCADE,
    photo_id TEXT NOT NULL,
    added_at TEXT NOT NULL,
    sort_order INTEGER DEFAULT 0,
    PRIMARY KEY (album_id, photo_id)
);
CREATE INDEX IF NOT EXISTS idx_album_items_album ON album_items(album_id);
"""


class Manifest:
    def __init__(self, db_path: Path | None = None):
        ensure_dirs()
        self.db_path = db_path or MANIFEST_PATH
        self._init_db()

    def _init_db(self) -> None:
        with self._connect() as conn:
            conn.executescript(SCHEMA)
            self._migrate_albums(conn)
            self._migrate_search_history(conn)
            self._migrate_sources(conn)
            self._migrate_dimensions(conn)

    def _migrate_dimensions(self, conn: sqlite3.Connection) -> None:
        cols = {row[1] for row in conn.execute("PRAGMA table_info(photos)")}
        if "width" not in cols:
            conn.execute("ALTER TABLE photos ADD COLUMN width INTEGER")
        if "height" not in cols:
            conn.execute("ALTER TABLE photos ADD COLUMN height INTEGER")

    def _migrate_search_history(self, conn: sqlite3.Connection) -> None:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS search_history (
                id TEXT PRIMARY KEY,
                query TEXT NOT NULL,
                plan_json TEXT NOT NULL,
                searched_at TEXT NOT NULL
            )
            """
        )

    def _migrate_sources(self, conn: sqlite3.Connection) -> None:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS sources (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                path TEXT NOT NULL UNIQUE,
                enabled INTEGER NOT NULL DEFAULT 1,
                created_at TEXT NOT NULL,
                last_scan_at TEXT,
                removed_at TEXT
            )
            """
        )
        photo_cols = {row[1] for row in conn.execute("PRAGMA table_info(photos)")}
        if "source_id" not in photo_cols:
            conn.execute(
                f"ALTER TABLE photos ADD COLUMN source_id TEXT NOT NULL DEFAULT '{DEFAULT_SOURCE_ID}'"
            )
            conn.execute(
                "CREATE UNIQUE INDEX IF NOT EXISTS idx_photos_source_rel "
                "ON photos(source_id, rel_path)"
            )
        self._ensure_default_source(conn)

    def _ensure_default_source(self, conn: sqlite3.Connection) -> None:
        photo_count = conn.execute("SELECT COUNT(*) AS cnt FROM photos").fetchone()["cnt"]
        if photo_count == 0 and os.getenv("OPAL_DESKTOP") == "1":
            return
        path = normalize_source_path(IMAGE_FOLDER)
        now = now_iso()
        conn.execute(
            """
            INSERT OR IGNORE INTO sources
              (id, name, path, enabled, created_at, last_scan_at, removed_at)
            VALUES (?, ?, ?, 1, ?, NULL, NULL)
            """,
            (DEFAULT_SOURCE_ID, default_source_name(path), path, now),
        )
        conn.execute(
            "UPDATE photos SET source_id = ? WHERE source_id IS NULL OR source_id = ''",
            (DEFAULT_SOURCE_ID,),
        )

    def _source_from_row(self, row: sqlite3.Row) -> SourceRecord:
        return SourceRecord(
            id=row["id"],
            name=row["name"],
            path=row["path"],
            enabled=bool(row["enabled"]),
            created_at=row["created_at"],
            last_scan_at=row["last_scan_at"],
            removed_at=row["removed_at"],
        )

    def list_sources(
        self,
        *,
        include_removed: bool = False,
        enabled_only: bool = False,
    ) -> list[SourceRecord]:
        clauses = ["1=1"]
        if not include_removed:
            clauses.append("removed_at IS NULL")
        if enabled_only:
            clauses.append("enabled = 1")
        where = " AND ".join(clauses)
        with self._connect() as conn:
            rows = conn.execute(
                f"SELECT * FROM sources WHERE {where} ORDER BY created_at ASC"
            ).fetchall()
        return [self._source_from_row(r) for r in rows]

    def get_source(self, source_id: str) -> SourceRecord | None:
        with self._connect() as conn:
            row = conn.execute(
                "SELECT * FROM sources WHERE id = ?", (source_id,)
            ).fetchone()
        return self._source_from_row(row) if row else None

    def get_source_by_path(self, path: str) -> SourceRecord | None:
        normalized = normalize_source_path(path)
        with self._connect() as conn:
            row = conn.execute(
                "SELECT * FROM sources WHERE path = ?", (normalized,)
            ).fetchone()
        return self._source_from_row(row) if row else None

    def get_source_root(self, source_id: str) -> Path | None:
        source = self.get_source(source_id)
        if not source:
            return None
        return source.root

    def resolve_absolute_path(self, record: PhotoRecord) -> str | None:
        root = self.get_source_root(record.source_id)
        if root is None:
            return str((IMAGE_FOLDER / record.rel_path).resolve())
        return str((root / record.rel_path).resolve())

    def source_photo_count(self, source_id: str, *, browse_ready_only: bool = False) -> int:
        where = "source_id = ?"
        params: list = [source_id]
        if browse_ready_only:
            where += (
                " AND status IN ('indexed', 'ocr_done', 'clip_done', 'pending') "
                "AND duplicate_of IS NULL"
            )
        with self._connect() as conn:
            row = conn.execute(
                f"SELECT COUNT(*) AS cnt FROM photos WHERE {where}", params
            ).fetchone()
        return row["cnt"] if row else 0

    def add_or_restore_source(self, path: str, name: str | None = None) -> SourceRecord:
        normalized = normalize_source_path(path)
        if not Path(normalized).is_dir():
            raise ValueError(f"Folder not found: {normalized}")
        existing = self.get_source_by_path(normalized)
        now = now_iso()
        if existing:
            with self._connect() as conn:
                conn.execute(
                    """
                    UPDATE sources
                    SET enabled = 1, removed_at = NULL, name = COALESCE(?, name)
                    WHERE id = ?
                    """,
                    (name, existing.id),
                )
            restored = self.get_source(existing.id)
            assert restored is not None
            return restored

        source_id = new_source_id()
        label = (name or default_source_name(normalized)).strip() or default_source_name(
            normalized
        )
        with self._connect() as conn:
            conn.execute(
                """
                INSERT INTO sources
                  (id, name, path, enabled, created_at, last_scan_at, removed_at)
                VALUES (?, ?, ?, 1, ?, NULL, NULL)
                """,
                (source_id, label, normalized, now),
            )
        created = self.get_source(source_id)
        assert created is not None
        return created

    def soft_remove_source(self, source_id: str) -> bool:
        now = now_iso()
        with self._connect() as conn:
            cur = conn.execute(
                """
                UPDATE sources
                SET enabled = 0, removed_at = ?
                WHERE id = ? AND id != ?
                """,
                (now, source_id, DEFAULT_SOURCE_ID),
            )
            if cur.rowcount == 0:
                cur = conn.execute(
                    """
                    UPDATE sources
                    SET enabled = 0, removed_at = ?
                    WHERE id = ?
                    """,
                    (now, source_id),
                )
            return cur.rowcount > 0

    def update_source(
        self,
        source_id: str,
        *,
        name: str | None = None,
        enabled: bool | None = None,
    ) -> SourceRecord | None:
        fields: list[str] = []
        params: list = []
        if name is not None:
            trimmed = name.strip()
            if trimmed:
                fields.append("name = ?")
                params.append(trimmed)
        if enabled is not None:
            fields.append("enabled = ?")
            params.append(1 if enabled else 0)
            if enabled:
                fields.append("removed_at = NULL")
        if not fields:
            return self.get_source(source_id)
        params.append(source_id)
        with self._connect() as conn:
            conn.execute(
                f"UPDATE sources SET {', '.join(fields)} WHERE id = ?",
                params,
            )
        return self.get_source(source_id)

    def touch_source_scan(self, source_id: str) -> None:
        now = now_iso()
        with self._connect() as conn:
            conn.execute(
                "UPDATE sources SET last_scan_at = ? WHERE id = ?",
                (now, source_id),
            )

    def has_enabled_sources(self) -> bool:
        with self._connect() as conn:
            row = conn.execute(
                "SELECT COUNT(*) AS cnt FROM sources WHERE enabled = 1 AND removed_at IS NULL"
            ).fetchone()
        return bool(row and row["cnt"] > 0)

    def _migrate_albums(self, conn: sqlite3.Connection) -> None:
        cols = {row[1] for row in conn.execute("PRAGMA table_info(albums)")}
        if "is_system" not in cols:
            conn.execute(
                "ALTER TABLE albums ADD COLUMN is_system INTEGER NOT NULL DEFAULT 0"
            )
        if "sort_order" not in cols:
            conn.execute(
                "ALTER TABLE albums ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0"
            )
            rows = conn.execute(
                """
                SELECT id FROM albums
                WHERE is_system = 0
                ORDER BY updated_at DESC, name ASC
                """
            ).fetchall()
            for index, row in enumerate(rows):
                conn.execute(
                    "UPDATE albums SET sort_order = ? WHERE id = ?",
                    (index, row["id"]),
                )
            conn.execute(
                "UPDATE albums SET sort_order = -1 WHERE is_system = 1"
            )
        now = self._now_iso()
        conn.execute(
            """
            INSERT OR IGNORE INTO albums
              (id, name, created_at, updated_at, cover_photo_id, is_system)
            VALUES (?, ?, ?, ?, NULL, 1)
            """,
            (FAVORITES_ALBUM_ID, FAVORITES_ALBUM_NAME, now, now),
        )

    def _album_from_row(self, row: sqlite3.Row) -> AlbumRecord:
        return AlbumRecord(
            id=row["id"],
            name=row["name"],
            created_at=row["created_at"],
            updated_at=row["updated_at"],
            cover_photo_id=row["cover_photo_id"],
            count=row["cnt"],
            is_system=bool(row["is_system"]),
        )

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
        source_id = row["source_id"] if "source_id" in row.keys() else DEFAULT_SOURCE_ID
        keys = row.keys()
        width = row["width"] if "width" in keys else None
        height = row["height"] if "height" in keys else None
        return PhotoRecord(
            id=row["id"],
            source_id=source_id,
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
            width=width,
            height=height,
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
        root = self.get_source_root(record.source_id)
        if root is None:
            return (IMAGE_FOLDER / record.rel_path).exists()
        return (root / record.rel_path).exists()

    def _enabled_source_clause(self, alias: str = "") -> tuple[str, list]:
        prefix = f"{alias}." if alias else ""
        return (
            f"{prefix}source_id IN ("
            "SELECT id FROM sources WHERE enabled = 1 AND removed_at IS NULL"
            ")",
            [],
        )

    def is_source_active(self, source_id: str) -> bool:
        with self._connect() as conn:
            row = conn.execute(
                """
                SELECT 1 FROM sources
                WHERE id = ? AND enabled = 1 AND removed_at IS NULL
                """,
                (source_id,),
            ).fetchone()
        return row is not None

    def record_in_active_library(self, record: PhotoRecord) -> bool:
        return self.is_source_active(record.source_id)

    def get_all_rel_paths(self, source_id: str | None = None) -> set[str]:
        with self._connect() as conn:
            if source_id:
                rows = conn.execute(
                    "SELECT rel_path FROM photos WHERE source_id = ?", (source_id,)
                ).fetchall()
            else:
                rows = conn.execute("SELECT rel_path FROM photos").fetchall()
        return {row["rel_path"] for row in rows}

    def get_by_rel_path(
        self, rel_path: str, source_id: str | None = None
    ) -> PhotoRecord | None:
        with self._connect() as conn:
            if source_id:
                row = conn.execute(
                    "SELECT * FROM photos WHERE rel_path = ? AND source_id = ?",
                    (rel_path, source_id),
                ).fetchone()
            else:
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
                "AND duplicate_of IS NULL "
                "ORDER BY rel_path"
            ).fetchall()
        return [self._row_to_record(r) for r in rows]

    def browse(
        self,
        offset: int = 0,
        limit: int = 40,
        sort: str = "date",
        folder: str | None = None,
        source_id: str | None = None,
    ) -> list[PhotoRecord]:
        """Paginated feed of gallery-ready canonical images."""
        order = "mtime DESC" if sort == "date" else "RANDOM()"
        where = (
            "status IN ('indexed', 'ocr_done', 'clip_done', 'pending') "
            "AND duplicate_of IS NULL"
        )
        src_clause, src_params = self._enabled_source_clause()
        where += f" AND {src_clause}"
        params: list = list(src_params)
        if source_id:
            where += " AND source_id = ?"
            params.append(source_id)
        if folder:
            where += " AND (rel_path LIKE ? OR rel_path = ?)"
            params.extend([f"{folder}/%", folder])
        with self._connect() as conn:
            rows = conn.execute(
                f"""
                SELECT * FROM photos
                WHERE {where}
                ORDER BY {order}
                LIMIT ? OFFSET ?
                """,
                (*params, limit, offset),
            ).fetchall()
        return [self._row_to_record(r) for r in rows]

    def browse_count(
        self,
        folder: str | None = None,
        source_id: str | None = None,
    ) -> int:
        where = (
            "status IN ('indexed', 'ocr_done', 'clip_done', 'pending') "
            "AND duplicate_of IS NULL"
        )
        src_clause, src_params = self._enabled_source_clause()
        where += f" AND {src_clause}"
        params: list = list(src_params)
        if source_id:
            where += " AND source_id = ?"
            params.append(source_id)
        if folder:
            where += " AND (rel_path LIKE ? OR rel_path = ?)"
            params.extend([f"{folder}/%", folder])
        with self._connect() as conn:
            row = conn.execute(
                f"SELECT COUNT(*) AS cnt FROM photos WHERE {where}",
                params,
            ).fetchone()
        return row["cnt"] if row else 0

    def list_collections(self, limit: int = 24) -> list[tuple[str, int]]:
        """Top-level folder names with image counts."""
        src_clause, src_params = self._enabled_source_clause()
        with self._connect() as conn:
            rows = conn.execute(
                f"""
                SELECT
                  CASE
                    WHEN instr(rel_path, '/') > 0
                      THEN substr(rel_path, 1, instr(rel_path, '/') - 1)
                    ELSE ''
                  END AS collection,
                  COUNT(*) AS cnt
                FROM photos
                WHERE status IN ('indexed', 'ocr_done', 'clip_done', 'pending')
                  AND duplicate_of IS NULL
                  AND {src_clause}
                GROUP BY collection
                ORDER BY cnt DESC, collection ASC
                LIMIT ?
                """,
                (*src_params, limit),
            ).fetchall()
        return [(r["collection"], r["cnt"]) for r in rows]

    def _now_iso(self) -> str:
        return datetime.now(timezone.utc).isoformat()

    def list_albums(self) -> list[AlbumRecord]:
        with self._connect() as conn:
            rows = conn.execute(
                """
                SELECT
                  a.id,
                  a.name,
                  a.created_at,
                  a.updated_at,
                  a.cover_photo_id,
                  a.is_system,
                  COUNT(ai.photo_id) AS cnt
                FROM albums a
                LEFT JOIN album_items ai ON ai.album_id = a.id
                GROUP BY a.id
                ORDER BY a.is_system DESC, a.sort_order ASC, a.name ASC
                """
            ).fetchall()
        return [self._album_from_row(r) for r in rows]

    def get_album(self, album_id: str) -> AlbumRecord | None:
        with self._connect() as conn:
            row = conn.execute(
                """
                SELECT
                  a.id,
                  a.name,
                  a.created_at,
                  a.updated_at,
                  a.cover_photo_id,
                  a.is_system,
                  COUNT(ai.photo_id) AS cnt
                FROM albums a
                LEFT JOIN album_items ai ON ai.album_id = a.id
                WHERE a.id = ?
                GROUP BY a.id
                """,
                (album_id,),
            ).fetchone()
        if not row:
            return None
        return self._album_from_row(row)

    def create_album(self, name: str) -> AlbumRecord:
        trimmed = name.strip()
        if not trimmed:
            raise ValueError("Album name required")
        if trimmed.casefold() in RESERVED_ALBUM_NAMES:
            raise ValueError("Album name reserved")
        now = self._now_iso()
        album_id = str(uuid.uuid4())
        with self._connect() as conn:
            max_order = conn.execute(
                "SELECT COALESCE(MAX(sort_order), -1) FROM albums WHERE is_system = 0"
            ).fetchone()[0]
            conn.execute(
                """
                INSERT INTO albums (id, name, created_at, updated_at, cover_photo_id, sort_order)
                VALUES (?, ?, ?, ?, NULL, ?)
                """,
                (album_id, trimmed, now, now, max_order + 1),
            )
        album = self.get_album(album_id)
        assert album is not None
        return album

    def reorder_albums(self, album_ids: list[str]) -> None:
        if not album_ids:
            return
        with self._connect() as conn:
            user_albums = conn.execute(
                "SELECT id FROM albums WHERE is_system = 0 ORDER BY sort_order ASC, name ASC"
            ).fetchall()
            user_ids = {row["id"] for row in user_albums}
            if set(album_ids) != user_ids:
                raise ValueError("Album order must include every user album exactly once")
            for index, album_id in enumerate(album_ids):
                conn.execute(
                    "UPDATE albums SET sort_order = ? WHERE id = ? AND is_system = 0",
                    (index, album_id),
                )

    def rename_album(self, album_id: str, name: str) -> AlbumRecord | None:
        trimmed = name.strip()
        if not trimmed:
            raise ValueError("Album name required")
        if trimmed.casefold() in RESERVED_ALBUM_NAMES:
            raise ValueError("Album name reserved")
        album = self.get_album(album_id)
        if not album or album.is_system:
            return None
        now = self._now_iso()
        with self._connect() as conn:
            cur = conn.execute(
                "UPDATE albums SET name = ?, updated_at = ? WHERE id = ?",
                (trimmed, now, album_id),
            )
            if cur.rowcount == 0:
                return None
        return self.get_album(album_id)

    def set_album_cover(self, album_id: str, photo_id: str | None) -> AlbumRecord | None:
        now = self._now_iso()
        with self._connect() as conn:
            cur = conn.execute(
                "UPDATE albums SET cover_photo_id = ?, updated_at = ? WHERE id = ?",
                (photo_id, now, album_id),
            )
            if cur.rowcount == 0:
                return None
        return self.get_album(album_id)

    def delete_album(self, album_id: str) -> bool:
        album = self.get_album(album_id)
        if not album or album.is_system:
            return False
        with self._connect() as conn:
            cur = conn.execute("DELETE FROM albums WHERE id = ?", (album_id,))
            return cur.rowcount > 0

    def add_to_album(self, album_id: str, photo_id: str) -> bool:
        if not self.get_by_path_id(photo_id):
            return False
        now = self._now_iso()
        with self._connect() as conn:
            album = conn.execute(
                "SELECT id, cover_photo_id FROM albums WHERE id = ?", (album_id,)
            ).fetchone()
            if not album:
                return False
            conn.execute(
                """
                INSERT OR IGNORE INTO album_items (album_id, photo_id, added_at, sort_order)
                VALUES (?, ?, ?, 0)
                """,
                (album_id, photo_id, now),
            )
            if not album["cover_photo_id"]:
                conn.execute(
                    "UPDATE albums SET cover_photo_id = ?, updated_at = ? WHERE id = ?",
                    (photo_id, now, album_id),
                )
            else:
                conn.execute(
                    "UPDATE albums SET updated_at = ? WHERE id = ?",
                    (now, album_id),
                )
        return True

    def remove_from_album(self, album_id: str, photo_id: str) -> bool:
        with self._connect() as conn:
            cur = conn.execute(
                "DELETE FROM album_items WHERE album_id = ? AND photo_id = ?",
                (album_id, photo_id),
            )
            if cur.rowcount == 0:
                return False
            album = conn.execute(
                "SELECT cover_photo_id FROM albums WHERE id = ?", (album_id,)
            ).fetchone()
            if album and album["cover_photo_id"] == photo_id:
                next_cover = conn.execute(
                    """
                    SELECT photo_id FROM album_items
                    WHERE album_id = ?
                    ORDER BY added_at DESC
                    LIMIT 1
                    """,
                    (album_id,),
                ).fetchone()
                conn.execute(
                    "UPDATE albums SET cover_photo_id = ?, updated_at = ? WHERE id = ?",
                    (
                        next_cover["photo_id"] if next_cover else None,
                        self._now_iso(),
                        album_id,
                    ),
                )
            else:
                conn.execute(
                    "UPDATE albums SET updated_at = ? WHERE id = ?",
                    (self._now_iso(), album_id),
                )
        return True

    def albums_for_photo(self, photo_id: str) -> list[str]:
        with self._connect() as conn:
            rows = conn.execute(
                """
                SELECT album_id FROM album_items
                WHERE photo_id = ?
                ORDER BY added_at DESC
                """,
                (photo_id,),
            ).fetchall()
        return [r["album_id"] for r in rows]

    def favorites_album_id(self) -> str:
        return FAVORITES_ALBUM_ID

    def is_favorite(self, photo_id: str) -> bool:
        with self._connect() as conn:
            row = conn.execute(
                """
                SELECT 1 FROM album_items
                WHERE album_id = ? AND photo_id = ?
                LIMIT 1
                """,
                (FAVORITES_ALBUM_ID, photo_id),
            ).fetchone()
        return row is not None

    def toggle_favorite(self, photo_id: str) -> bool:
        if self.is_favorite(photo_id):
            self.remove_from_album(FAVORITES_ALBUM_ID, photo_id)
            return False
        if not self.add_to_album(FAVORITES_ALBUM_ID, photo_id):
            raise ValueError("Photo not found")
        return True

    def browse_album(
        self,
        album_id: str,
        offset: int = 0,
        limit: int = 40,
        sort: str = "date",
    ) -> list[PhotoRecord]:
        order = "p.mtime DESC" if sort == "date" else "RANDOM()"
        with self._connect() as conn:
            rows = conn.execute(
                f"""
                SELECT p.*
                FROM photos p
                INNER JOIN album_items ai ON ai.photo_id = p.id
                WHERE ai.album_id = ?
                  AND p.status IN ('indexed', 'ocr_done', 'clip_done')
                  AND p.duplicate_of IS NULL
                ORDER BY {order}
                LIMIT ? OFFSET ?
                """,
                (album_id, limit, offset),
            ).fetchall()
        return [self._row_to_record(r) for r in rows]

    def album_count(self, album_id: str) -> int:
        with self._connect() as conn:
            row = conn.execute(
                """
                SELECT COUNT(*) AS cnt
                FROM photos p
                INNER JOIN album_items ai ON ai.photo_id = p.id
                WHERE ai.album_id = ?
                  AND p.status IN ('indexed', 'ocr_done', 'clip_done')
                  AND p.duplicate_of IS NULL
                """,
                (album_id,),
            ).fetchone()
        return row["cnt"] if row else 0

    def discover_random(
        self,
        limit: int = 1,
        exclude: list[str] | None = None,
    ) -> list[PhotoRecord]:
        where = (
            "status IN ('indexed', 'ocr_done', 'clip_done', 'pending') "
            "AND duplicate_of IS NULL"
        )
        src_clause, src_params = self._enabled_source_clause()
        where += f" AND {src_clause}"
        params: list = list(src_params)
        if exclude:
            placeholders = ",".join("?" for _ in exclude)
            where += f" AND id NOT IN ({placeholders})"
            params.extend(exclude)
        with self._connect() as conn:
            rows = conn.execute(
                f"""
                SELECT * FROM photos
                WHERE {where}
                ORDER BY RANDOM()
                LIMIT ?
                """,
                (*params, limit),
            ).fetchall()
        return [self._row_to_record(r) for r in rows]

    def get_by_path_id(self, path_id_str: str) -> PhotoRecord | None:
        """Lookup by manifest id (sha256 of rel_path) — primary key."""
        with self._connect() as conn:
            row = conn.execute(
                "SELECT * FROM photos WHERE id = ?", (path_id_str,)
            ).fetchone()
        return self._row_to_record(row) if row else None

    def upsert_scanned(
        self, source_id: str, scanned: ScannedFile
    ) -> tuple[PhotoRecord, bool, str | None, bool]:
        """Returns (record, needs_reindex, stale_chroma_id, is_identical_duplicate)."""
        existing = self.get_by_rel_path(scanned.rel_path, source_id=source_id)
        needs_reindex = False
        stale_chroma_id: str | None = None
        file_id = path_id(scanned.rel_path, source_id)

        if existing is None:
            scanned = with_content_hash(scanned)
            canonical = self.get_canonical_by_content_hash(scanned.content_hash)

            if canonical:
                record = PhotoRecord(
                    id=file_id,
                    source_id=source_id,
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
                source_id=source_id,
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
                existing = self.get_by_rel_path(scanned.rel_path, source_id=source_id)
                assert existing is not None
                return existing, needs_reindex, stale_chroma_id, False
            self._update_stats(file_id, scanned.file_size, scanned.mtime)

        return existing, False, stale_chroma_id, False

    def _insert(self, record: PhotoRecord) -> None:
        with self._connect() as conn:
            conn.execute(
                """
                INSERT INTO photos (
                    id, source_id, rel_path, file_size, mtime, content_hash,
                    ocr_text, has_text, clip_model, indexed_at, status,
                    error_msg, duplicate_of, exif_date
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    record.id,
                    record.source_id,
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

    def update_dimensions(self, photo_id: str, width: int, height: int) -> None:
        if width <= 0 or height <= 0:
            return
        with self._connect() as conn:
            conn.execute(
                "UPDATE photos SET width = ?, height = ? WHERE id = ?",
                (width, height, photo_id),
            )

    def list_missing_dimensions(self, limit: int | None = None) -> list[PhotoRecord]:
        sql = (
            "SELECT * FROM photos WHERE (width IS NULL OR height IS NULL) "
            "AND status != 'missing' "
            "ORDER BY rel_path"
        )
        params: list = []
        if limit is not None:
            sql += " LIMIT ?"
            params.append(limit)
        with self._connect() as conn:
            rows = conn.execute(sql, params).fetchall()
        return [self._row_to_record(r) for r in rows]

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

    def mark_missing(self, rel_paths: set[str], source_id: str | None = None) -> int:
        if not rel_paths:
            return 0
        placeholders = ",".join("?" * len(rel_paths))
        params: list = [STATUS_MISSING, *rel_paths, STATUS_MISSING]
        query = (
            f"UPDATE photos SET status = ? WHERE rel_path IN ({placeholders}) "
            f"AND status != ?"
        )
        if source_id:
            query += " AND source_id = ?"
            params.append(source_id)
        with self._connect() as conn:
            cursor = conn.execute(query, params)
            return cursor.rowcount

    def get_pending_clip(self, source_id: str | None = None) -> list[PhotoRecord]:
        with self._connect() as conn:
            if source_id:
                rows = conn.execute(
                    """
                    SELECT * FROM photos
                    WHERE status IN (?, ?) AND duplicate_of IS NULL AND source_id = ?
                    ORDER BY rel_path
                    """,
                    (STATUS_PENDING, STATUS_FAILED, source_id),
                ).fetchall()
            else:
                rows = conn.execute(
                    """
                    SELECT * FROM photos
                    WHERE status IN (?, ?) AND duplicate_of IS NULL
                    ORDER BY rel_path
                    """,
                    (STATUS_PENDING, STATUS_FAILED),
                ).fetchall()
        return [self._row_to_record(r) for r in rows]

    def get_pending_ocr(self, source_id: str | None = None) -> list[PhotoRecord]:
        with self._connect() as conn:
            if source_id:
                rows = conn.execute(
                    """
                    SELECT * FROM photos
                    WHERE status = ? AND duplicate_of IS NULL AND source_id = ?
                    ORDER BY rel_path
                    """,
                    (STATUS_CLIP_DONE, source_id),
                ).fetchall()
            else:
                rows = conn.execute(
                    """
                    SELECT * FROM photos
                    WHERE status = ? AND duplicate_of IS NULL
                    ORDER BY rel_path
                    """,
                    (STATUS_CLIP_DONE,),
                ).fetchall()
        return [self._row_to_record(r) for r in rows]

    def get_pending_thumbnails(self, source_id: str) -> list[PhotoRecord]:
        with self._connect() as conn:
            rows = conn.execute(
                """
                SELECT * FROM photos
                WHERE source_id = ? AND status != ? AND duplicate_of IS NULL
                ORDER BY rel_path
                """,
                (source_id, STATUS_MISSING),
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

    def _indexed_where(self) -> tuple[str, list]:
        src_clause, src_params = self._enabled_source_clause()
        return (
            f"status IN ('indexed', 'ocr_done', 'clip_done') AND duplicate_of IS NULL AND {src_clause}",
            list(src_params),
        )

    def _photo_date_sql(self) -> str:
        return "COALESCE(substr(exif_date, 1, 10), date(mtime, 'unixepoch'))"

    def search_ocr_filtered(
        self,
        *,
        exact_phrases: list[str],
        include_words: list[str],
        include_folders: list[str],
        has_text: bool | None,
        date_after: str | None,
        date_before: str | None,
        limit: int,
    ) -> list[tuple[PhotoRecord, Literal["exact", "include"]]]:
        if not exact_phrases and not include_words:
            return []

        where, params = self._indexed_where()
        if has_text is True:
            where += " AND has_text = 1"
        elif has_text is False:
            where += " AND has_text = 0"

        for folder in include_folders:
            where += " AND (rel_path LIKE ? OR rel_path = ?)"
            params.extend([f"{folder}/%", folder])

        date_sql = self._photo_date_sql()
        if date_after:
            where += f" AND {date_sql} >= ?"
            params.append(date_after[:10])
        if date_before:
            where += f" AND {date_sql} < ?"
            params.append(date_before[:10])

        for phrase in exact_phrases:
            where += " AND LOWER(ocr_text) LIKE ?"
            params.append(f"%{phrase.lower()}%")

        for word in include_words:
            where += " AND LOWER(ocr_text) LIKE ?"
            params.append(f"%{word.lower()}%")

        sql = f"""
            SELECT * FROM photos
            WHERE {where}
            ORDER BY mtime DESC
            LIMIT ?
        """
        params.append(limit)

        with self._connect() as conn:
            rows = conn.execute(sql, params).fetchall()

        results: list[tuple[PhotoRecord, Literal["exact", "include"]]] = []
        for row in rows:
            record = self._row_to_record(row)
            kind: Literal["exact", "include"] = (
                "exact"
                if exact_phrases
                and all(p.lower() in record.ocr_text.lower() for p in exact_phrases)
                else "include"
            )
            results.append((record, kind))
        return results

    def list_filtered(
        self,
        *,
        include_folders: list[str],
        has_text: bool | None,
        date_after: str | None,
        date_before: str | None,
        limit: int,
    ) -> list[PhotoRecord]:
        where, params = self._indexed_where()
        if has_text is True:
            where += " AND has_text = 1"
        elif has_text is False:
            where += " AND has_text = 0"

        if len(include_folders) == 1:
            folder = include_folders[0]
            where += " AND (rel_path LIKE ? OR rel_path = ?)"
            params.extend([f"{folder}/%", folder])
        elif len(include_folders) > 1:
            clauses = []
            for folder in include_folders:
                clauses.append("(rel_path LIKE ? OR rel_path = ?)")
                params.extend([f"{folder}/%", folder])
            where += " AND (" + " OR ".join(clauses) + ")"

        date_sql = self._photo_date_sql()
        if date_after:
            where += f" AND {date_sql} >= ?"
            params.append(date_after[:10])
        if date_before:
            where += f" AND {date_sql} < ?"
            params.append(date_before[:10])

        sql = f"""
            SELECT * FROM photos
            WHERE {where}
            ORDER BY mtime DESC
            LIMIT ?
        """
        params.append(limit)
        with self._connect() as conn:
            rows = conn.execute(sql, params).fetchall()
        return [self._row_to_record(row) for row in rows]

    def save_search_history(self, query: str, plan: dict) -> None:
        now = datetime.now(timezone.utc).isoformat()
        entry_id = uuid.uuid4().hex
        plan_json = json.dumps(plan)
        with self._connect() as conn:
            conn.execute(
                "DELETE FROM search_history WHERE query = ?",
                (query,),
            )
            conn.execute(
                """
                INSERT INTO search_history (id, query, plan_json, searched_at)
                VALUES (?, ?, ?, ?)
                """,
                (entry_id, query, plan_json, now),
            )
            conn.execute(
                """
                DELETE FROM search_history
                WHERE id NOT IN (
                    SELECT id FROM search_history
                    ORDER BY searched_at DESC
                    LIMIT 50
                )
                """
            )

    def list_search_history(self, limit: int = 12) -> list[dict]:
        with self._connect() as conn:
            rows = conn.execute(
                """
                SELECT query, plan_json, searched_at
                FROM search_history
                ORDER BY searched_at DESC
                LIMIT ?
                """,
                (limit,),
            ).fetchall()
        results = []
        for row in rows:
            try:
                plan = json.loads(row["plan_json"])
            except json.JSONDecodeError:
                plan = {}
            results.append(
                {
                    "query": row["query"],
                    "plan": plan,
                    "searched_at": row["searched_at"],
                }
            )
        return results

    def clear_search_history(self) -> None:
        with self._connect() as conn:
            conn.execute("DELETE FROM search_history")
