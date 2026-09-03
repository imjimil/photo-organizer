"""Watch library source folders and trigger incremental indexing."""

from __future__ import annotations

import logging
import threading
from pathlib import Path

from watchdog.events import FileSystemEvent, FileSystemEventHandler
from watchdog.observers import Observer

from opal.config import FOLDER_WATCH, FOLDER_WATCH_DEBOUNCE_SEC, IMAGE_EXTENSIONS
from opal.index_service import get_index_service

logger = logging.getLogger("photo_organizer.folder_watcher")


def _is_image_path(path: str) -> bool:
    if not path:
        return False
    return Path(path).suffix.lower() in IMAGE_EXTENSIONS


class _DebouncedHandler(FileSystemEventHandler):
    def __init__(self, watcher: "FolderWatcher") -> None:
        super().__init__()
        self._watcher = watcher

    def on_any_event(self, event: FileSystemEvent) -> None:
        if event.is_directory:
            if event.event_type in ("created", "deleted", "moved"):
                self._watcher.notify(getattr(event, "src_path", None))
            return
        path = getattr(event, "src_path", None) or ""
        dest = getattr(event, "dest_path", None) or ""
        if not _is_image_path(path) and not _is_image_path(dest):
            return
        if event.event_type in ("created", "deleted", "modified", "moved"):
            self._watcher.notify(path or dest)


class FolderWatcher:
    """Debounced recursive watcher for enabled source folders."""

    def __init__(self) -> None:
        self._observer: Observer | None = None
        self._lock = threading.Lock()
        self._pending: set[str] = set()
        self._timer: threading.Timer | None = None
        self._watched: dict[str, str] = {}  # path -> source_id
        self._started = False

    @property
    def running(self) -> bool:
        return self._started

    def start(self) -> None:
        if not FOLDER_WATCH:
            logger.info("Folder watch disabled (FOLDER_WATCH=0)")
            return
        with self._lock:
            if self._started:
                return
            self._observer = Observer()
            self._observer.daemon = True
            self._observer.start()
            self._started = True
        logger.info(
            "Folder watcher started (debounce=%.1fs)", FOLDER_WATCH_DEBOUNCE_SEC
        )
        self.refresh()

    def stop(self) -> None:
        with self._lock:
            if self._timer:
                self._timer.cancel()
                self._timer = None
            observer = self._observer
            self._observer = None
            self._started = False
            self._watched.clear()
            self._pending.clear()
        if observer is not None:
            observer.stop()
            observer.join(timeout=5)
            logger.info("Folder watcher stopped")

    def refresh(self) -> None:
        """Re-sync watched paths with enabled sources."""
        if not self._started or self._observer is None:
            return
        from opal.api.deps import get_manifest

        manifest = get_manifest()
        sources = manifest.list_sources(include_removed=False, enabled_only=True)
        desired: dict[str, str] = {}
        for source in sources:
            root = Path(source.path)
            if root.is_dir():
                desired[str(root.resolve())] = source.id

        with self._lock:
            if desired == self._watched:
                return
            try:
                self._observer.unschedule_all()
            except Exception:
                pass
            self._watched = {}
            handler = _DebouncedHandler(self)
            for path, source_id in desired.items():
                try:
                    self._observer.schedule(handler, path, recursive=True)
                    self._watched[path] = source_id
                    logger.info("Watching %s (%s)", path, source_id[:8])
                except Exception as exc:
                    logger.error("Failed to watch %s: %s", path, exc)

    def notify(self, path: str | None = None) -> None:
        """Queue an index for the source that owns path (or all if unknown)."""
        source_id: str | None = None
        if path:
            try:
                resolved = str(Path(path).resolve())
            except OSError:
                resolved = path
            with self._lock:
                for root, sid in self._watched.items():
                    if (
                        resolved == root
                        or resolved.startswith(root + "\\")
                        or resolved.startswith(root + "/")
                    ):
                        source_id = sid
                        break
        with self._lock:
            if source_id:
                self._pending.add(source_id)
            else:
                self._pending.update(self._watched.values())
            if self._timer:
                self._timer.cancel()
            self._timer = threading.Timer(FOLDER_WATCH_DEBOUNCE_SEC, self._flush)
            self._timer.daemon = True
            self._timer.start()

    def _flush(self) -> None:
        with self._lock:
            pending = list(self._pending)
            self._pending.clear()
            self._timer = None
        if not pending:
            return
        from opal.api.deps import get_chroma, get_manifest

        manifest = get_manifest()
        chroma = get_chroma()
        service = get_index_service()
        for source_id in pending:
            logger.info("Folder change → index source %s", source_id[:8])
            service.request(manifest, chroma, source_id)


_watcher: FolderWatcher | None = None


def get_folder_watcher() -> FolderWatcher:
    global _watcher
    if _watcher is None:
        _watcher = FolderWatcher()
    return _watcher
