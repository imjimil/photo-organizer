"""Background indexing job with progress tracking."""

from __future__ import annotations

import logging
import threading
import time
from dataclasses import dataclass, field
from typing import Any

from pathlib import Path

from opal.chroma_store import ChromaStore
from opal.cli.index_library import (
    run_clip_phase,
    run_ocr_phase,
    run_thumbnails,
    sync_manifest,
    update_chroma_documents,
)
from opal.config import IMAGE_FOLDER
from opal.embedder import CLIPEmbedder
from opal.manifest import Manifest, STATUS_INDEXED, STATUS_OCR_DONE, STATUS_CLIP_DONE

logger = logging.getLogger("photo_organizer.index_service")

PHASES = ("scanning", "thumbnails", "clip", "ocr", "done", "idle")


@dataclass
class IndexJobState:
    running: bool = False
    phase: str = "idle"
    source_id: str | None = None
    current: int = 0
    total: int = 0
    message: str = ""
    started_at: float | None = None
    phase_started_at: float | None = None
    error: str | None = None
    _lock: threading.Lock = field(default_factory=threading.Lock, repr=False)

    def snapshot(self, manifest: Manifest) -> dict[str, Any]:
        with self._lock:
            running = self.running
            phase = self.phase
            current = self.current
            total = self.total
            message = self.message
            source_id = self.source_id
            error = self.error
            started = self.started_at
            phase_started = self.phase_started_at

        counts = manifest.count_by_status()
        total_photos = manifest.total_count()
        indexed = sum(
            counts.get(s, 0)
            for s in (STATUS_INDEXED, STATUS_OCR_DONE, STATUS_CLIP_DONE)
        )
        percent = (current / total * 100) if total > 0 else 0.0
        eta_seconds: int | None = None
        rate = 0.0
        if running and phase_started and current > 0 and total > current:
            elapsed = time.monotonic() - phase_started
            if elapsed > 0:
                rate = current / elapsed
                eta_seconds = int((total - current) / rate)

        search_ready_percent = (
            round(indexed / total_photos * 100, 1) if total_photos > 0 else 0.0
        )

        return {
            "running": running,
            "phase": phase,
            "source_id": source_id,
            "current": current,
            "total": total,
            "percent": round(percent, 1),
            "eta_seconds": eta_seconds,
            "rate_per_second": round(rate, 2),
            "message": message,
            "error": error,
            "counts": counts,
            "search_ready_percent": search_ready_percent,
            "browse_ready": manifest.browse_count(),
        }


class IndexJobService:
    def __init__(self) -> None:
        self._state = IndexJobState()
        self._thread: threading.Thread | None = None
        self._cancel = threading.Event()

    def status(self, manifest: Manifest) -> dict[str, Any]:
        return self._state.snapshot(manifest)

    def start(self, manifest: Manifest, chroma: ChromaStore, source_id: str | None = None) -> bool:
        with self._state._lock:
            if self._state.running:
                return False
            self._state.running = True
            self._state.phase = "scanning"
            self._state.source_id = source_id
            self._state.current = 0
            self._state.total = 0
            self._state.message = "Starting…"
            self._state.started_at = time.monotonic()
            self._state.phase_started_at = time.monotonic()
            self._state.error = None
            self._cancel.clear()

        self._thread = threading.Thread(
            target=self._run,
            args=(manifest, chroma, source_id),
            daemon=True,
            name="opal-index-job",
        )
        self._thread.start()
        return True

    def cancel(self) -> None:
        self._cancel.set()

    def _set_phase(self, phase: str, message: str = "", total: int = 0) -> None:
        with self._state._lock:
            self._state.phase = phase
            self._state.message = message
            self._state.current = 0
            self._state.total = total
            self._state.phase_started_at = time.monotonic()

    def _set_progress(self, current: int, total: int | None = None) -> None:
        with self._state._lock:
            self._state.current = current
            if total is not None:
                self._state.total = total

    def _finish(self, error: str | None = None) -> None:
        with self._state._lock:
            self._state.running = False
            self._state.phase = "done" if not error else "idle"
            self._state.error = error
            self._state.message = "Complete" if not error else error

    def _run(self, manifest: Manifest, chroma: ChromaStore, source_id: str | None) -> None:
        try:
            sources = manifest.list_sources(include_removed=False, enabled_only=False)
            if source_id:
                targets = [s for s in sources if s.id == source_id and s.enabled]
            else:
                targets = [s for s in sources if s.enabled]

            if not targets:
                self._finish("No enabled sources to index")
                return

            for source in targets:
                if self._cancel.is_set():
                    break
                self._index_source(manifest, chroma, source.id, source.root)

            self._finish(None if not self._cancel.is_set() else "Cancelled")
        except Exception as exc:
            logger.exception("Index job failed")
            self._finish(str(exc))

    def _index_source(
        self, manifest: Manifest, chroma: ChromaStore, source_id: str, root: Path
    ) -> None:
        with self._state._lock:
            self._state.source_id = source_id

        self._set_phase("scanning", "Scanning files…")
        scan_stats = sync_manifest(manifest, chroma, source_id=source_id, root=root)
        scanned = scan_stats.get("scanned", 0)
        self._set_progress(scanned, scanned)
        manifest.touch_source_scan(source_id)

        if self._cancel.is_set():
            return

        pending_thumbs = manifest.get_pending_thumbnails(source_id)
        total_thumbs = len(pending_thumbs) + scan_stats.get("new_or_changed", 0)
        self._set_phase("thumbnails", "Generating thumbnails…", max(total_thumbs, 1))
        thumb_count = run_thumbnails(manifest, source_id=source_id, root=root)
        self._set_progress(thumb_count, max(thumb_count, 1))

        if self._cancel.is_set():
            return

        pending_clip = manifest.get_pending_clip(source_id)
        if pending_clip:
            self._set_phase("clip", "Visual indexing…", len(pending_clip))
            embedder = CLIPEmbedder()
            done = 0

            def clip_progress(batch_done: int, batch_total: int) -> None:
                nonlocal done
                done = min(done + batch_done, batch_total)
                self._set_progress(done, batch_total)

            run_clip_phase(
                manifest,
                chroma,
                embedder,
                records=pending_clip,
                root=root,
                progress_callback=clip_progress,
            )
        else:
            self._set_phase("clip", "Visual indexing…", 1)
            self._set_progress(1, 1)

        if self._cancel.is_set():
            return

        pending_ocr = manifest.get_pending_ocr(source_id)
        if pending_ocr:
            self._set_phase("ocr", "Reading text…", len(pending_ocr))

            def ocr_progress(done: int, total: int) -> None:
                self._set_progress(done, total)

            run_ocr_phase(
                manifest,
                records=pending_ocr,
                root=root,
                progress_callback=ocr_progress,
            )
            update_chroma_documents(manifest, chroma)
        else:
            self._set_phase("ocr", "Reading text…", 1)
            self._set_progress(1, 1)

        self._set_phase("done", "Done")


# Fallback root for legacy single-folder mode
def legacy_image_root() -> Path:
    return IMAGE_FOLDER


_index_service: IndexJobService | None = None


def get_index_service() -> IndexJobService:
    global _index_service
    if _index_service is None:
        _index_service = IndexJobService()
    return _index_service
