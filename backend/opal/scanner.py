"""Recursive image scanner with content hashing."""

import hashlib
from dataclasses import dataclass
from pathlib import Path

from config import IMAGE_EXTENSIONS, IMAGE_FOLDER


@dataclass(frozen=True)
class ScannedFile:
    abs_path: Path
    rel_path: str
    file_size: int
    mtime: float
    content_hash: str = ""


def compute_content_hash(path: Path, chunk_size: int = 65536) -> str:
    """Return SHA-256 hex digest of file contents."""
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        while chunk := handle.read(chunk_size):
            digest.update(chunk)
    return digest.hexdigest()


def scan_images(root: Path | None = None) -> list[ScannedFile]:
    """Recursively scan for image files under root."""
    root = (root or IMAGE_FOLDER).resolve()
    if not root.is_dir():
        raise FileNotFoundError(f"Image folder not found: {root}")

    results: list[ScannedFile] = []
    for path in sorted(root.rglob("*")):
        if not path.is_file():
            continue
        if path.suffix.lower() not in IMAGE_EXTENSIONS:
            continue

        stat = path.stat()
        rel_path = path.relative_to(root).as_posix()
        results.append(
            ScannedFile(
                abs_path=path,
                rel_path=rel_path,
                file_size=stat.st_size,
                mtime=stat.st_mtime,
            )
        )
    return results


def with_content_hash(scanned: ScannedFile) -> ScannedFile:
    """Return a copy of scanned file with content_hash populated."""
    if scanned.content_hash:
        return scanned
    return ScannedFile(
        abs_path=scanned.abs_path,
        rel_path=scanned.rel_path,
        file_size=scanned.file_size,
        mtime=scanned.mtime,
        content_hash=compute_content_hash(scanned.abs_path),
    )
