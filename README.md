# Opal

**Google Images for your own hard drive.**

You saved the quote. You screenshotted the layout. You dumped a camera roll into a folder named `ref`. Six months later you need that one image and Windows Search is useless.

Opal indexes a private library of photos, screenshots, and moodboards — then finds them in seconds. Search by mood (`warm sunset`, `lonely rain`) or by the words in the image (`"be yourself"`). Files stay where you left them. Nothing leaves the machine.

Built for designers, photographers, and collectors sitting at a desktop with tens of thousands of images. The grid is the product. Chrome gets out of the way.

### Why bother

- **Local.** No upload, no account, no cloud quota. Your archive never leaves the disk.
- **Two ways to find.** Visual similarity (SigLIP 2) for vibes. OCR (PaddleOCR) for exact phrases in screenshots.
- **Doesn't rearrange your life.** Watches folders in place. No import ritual, no renamed files, no second copy of the library. Drop a file in; Opal indexes it. Delete one; it leaves the library.
- **Scales past “a few albums.”** Comfortable around ~25k images. Index once; incremental runs only touch what’s new.
- **Desktop-native.** Dense justified grid, keyboard search (`/`), albums, favorites, Discover when you want a random hit.

Desktop app (Tauri) or browser in development.

---

## How it works

```
your image folders (unchanged)
        │
        ▼
  Python indexer  →  SQLite (paths, OCR, albums)
                  →  Chroma (embeddings)
                  →  thumbnail cache
        ▼
  FastAPI :8000
        ▼
  React UI (Tauri or browser)
```

| Layer | Tech |
|-------|------|
| UI | React 19, Vite, Tailwind 4, Tauri 2 |
| API | FastAPI |
| Catalog | SQLite |
| Vectors | ChromaDB + [SigLIP 2 Base](https://huggingface.co/google/siglip2-base-patch16-256) |
| OCR | [RapidOCR](https://github.com/RapidAI/RapidOCR) (PaddleOCR ONNX) |

---

## Requirements

- **Python 3.11+**
- **Node 18+**
- **Rust** (only for the Tauri desktop shell)
- GPU optional — CUDA or Apple MPS makes indexing much faster; CPU works

First CLIP run downloads SigLIP weights (~350 MB). OCR models download on the first OCR pass.

---

## Setup

```bash
git clone https://github.com/imjimil/photo-organizer.git
cd photo-organizer

pip install -r backend/requirements.txt
npm install
npm install --prefix frontend

cp opal.env.example opal.env
```

Edit `opal.env`:

```ini
OPAL_PYTHON=python          # or full path to python.exe
IMAGE_FOLDER=/path/to/photos
MANIFEST_PATH=./data/manifest.db
CHROMA_PATH=./my_quote_library
```

Use the same Python for `OPAL_PYTHON` and `pip install`. Mixing interpreters is a common cause of `ModuleNotFoundError: torch`.

### Index

CLIP first, then OCR. OCR only runs on photos that finished the visual pass.

```bash
npm run index:clip   # SigLIP embeddings
npm run index:ocr    # text extraction
```

Or both:

```bash
npm run index:full
```

Later, only new/changed files:

```bash
npm run index
```

Formats: `.png` `.jpg` `.jpeg` `.webp` `.gif` `.bmp`

Rough timing for ~24k images on an NVIDIA GPU: CLIP ~5–10 min, OCR ~30–90 min. CPU is a lot slower.

---

## Run

**Desktop**

```bash
npm run dev:desktop
```

First launch compiles Rust (slow once). Tauri starts Vite and the Python API on port 8000. Empty library → folder picker.

**Browser (no Tauri)**

```bash
# terminal 1
npm run dev:api

# terminal 2
npm run dev
```

API: `http://127.0.0.1:8000` · UI: `http://localhost:5173`

Web mode has no onboarding; it uses whatever is already in `data/manifest.db`.

**Ship**

```bash
npm run build:frontend
npm run build:desktop
```

---

## What you get

| | |
|--|--|
| **Search** | Default screen. Vibe queries, exact OCR phrases, folder/date filters. |
| **Library** | Full justified mosaic of everything indexed. |
| **Collections** | Albums and Favorites. Drag to reorder. |
| **Discover** | One random image. Arrow keys to skip. |
| **Sources** | Multiple folders, each indexed on its own. Remove a source to hide it without deleting the index. |
| **Lightbox** | Full OCR text, copy quote, find similar, add to album, reveal in Finder/Explorer. |

`/` focuses search from anywhere. Esc clears selection.

---

## Search

Bare words are vibe queries (embedding similarity):

```
melancholy rain
golden hour portrait
```

| Syntax | Example | Meaning |
|--------|---------|---------|
| `"…"` | `"be yourself"` | Exact OCR phrase |
| `exact:` | `exact:hello` | Same without quotes |
| `+word` | `+warmth` | Must appear in OCR or path |
| `-word` | `-screenshot` | Must not appear |
| `in:` | `in:2024` | Path contains folder segment |
| `-in:` | `-in:archive` | Path must not |
| `has:text` | `has:text sunset` | OCR found text |
| `visual:` | `visual: gradient` | No OCR text |
| `after:` / `before:` | `after:2024-01-01` | EXIF or file date |
| `during:` | `during:2024` | Year or `YYYY-MM` |
| `match:` | `match:strict warmth` | `broad` \| `balanced` \| `strict` |

Hybrid:

```
warmth "be yourself"
```

---

## Config (`opal.env`)

| Variable | Default | Notes |
|----------|---------|-------|
| `OPAL_PYTHON` | — | Interpreter for npm scripts / Tauri |
| `IMAGE_FOLDER` | (see `config.py`) | Default source path |
| `MANIFEST_PATH` | `./data/manifest.db` | SQLite |
| `CHROMA_PATH` | `./my_quote_library` | Vectors |
| `THUMB_CACHE_PATH` | `./.cache/thumbs` | Thumbnails |
| `DEVICE` | auto | `cuda` / `mps` / `cpu` |
| `FOLDER_WATCH` | `1` | Auto-index on folder changes while API runs |
| `FOLDER_WATCH_DEBOUNCE_SEC` | `2.5` | Wait after last FS event before indexing |
| `CLIP_MODEL` | `google/siglip2-base-patch16-256` | HF id |
| `OCR_ENGINE` | `rapidocr` | Stored on each photo for upgrades |
| `OCR_LANGUAGES` | `en` | Comma-separated |
| `CLIP_BATCH_SIZE` | 16 / 8 / 4 | CUDA / MPS / CPU |
| `DUPLICATE_THRESHOLD` | `0.95` | Near-dupe cosine cutoff |

Changing `CLIP_MODEL` recreates the Chroma collection and re-queues embeddings. Albums and sources are kept. Do not use `--reset` unless you want a wipe.

Heavier visual model (more VRAM):

```ini
CLIP_MODEL=google/siglip2-so400m-patch16-384
```

Then `npm run index:clip`.

---

## Commands

| Script | What it does |
|--------|----------------|
| `npm run dev:api` | FastAPI on :8000 |
| `npm run dev` | Vite UI |
| `npm run dev:desktop` | Tauri + API + UI |
| `npm run index` | Incremental index |
| `npm run index:clip` | Embeddings only |
| `npm run index:ocr` | OCR only |
| `npm run index:full` | Full pass |
| `npm run duplicates` | Near-duplicate report |
| `npm run dimensions` | Backfill width/height |

```bash
npm run index -- --mode dedup
npm run index -- --reset          # deletes manifest, chroma, thumbs
npm run index -- --no-thumbnails
```

Same via Python:

```bash
python backend/run.py api
python backend/run.py index --mode clip
python backend/run.py duplicates
```

---

## Layout

```
photo-organizer/
├── backend/
│   ├── opal/
│   │   ├── api/              # FastAPI
│   │   ├── cli/              # index, dedup, dimensions
│   │   ├── embedder.py       # SigLIP 2
│   │   ├── ocr_worker.py     # RapidOCR
│   │   ├── manifest.py       # SQLite
│   │   ├── chroma_store.py
│   │   ├── search.py
│   │   └── index_service.py  # background jobs for the UI
│   ├── requirements.txt
│   └── run.py
├── frontend/                 # React app
├── src-tauri/                # desktop shell
├── scripts/run-backend.mjs
├── opal.env.example
├── PRODUCT.md
└── DESIGN.md
```

Runtime data (gitignored):

| Path | Contents |
|------|----------|
| `data/manifest.db` | Paths, OCR, status, albums, sources |
| `my_quote_library/` | Chroma vectors |
| `.cache/thumbs/` | Grid thumbnails |

Delete those folders to drop the index, not your photos. Rebuild with `npm run index:full`.

---

## Troubleshooting

**`ECONNREFUSED 127.0.0.1:8000` on desktop**  
UI can boot before the API. Wait for the window, then refresh.

**`ModuleNotFoundError: torch` (or rapidocr)**  
Install with the interpreter in `OPAL_PYTHON`:

```bash
/path/to/python -m pip install -r backend/requirements.txt
```

**CLIP/OCR seems to skip everything**  
Incremental mode only processes new work. After changing models, run `index:clip` or `index:ocr` explicitly — mismatch detection re-queues stale rows.

**Vibe search broken, quotes still work**  
Run `npm run index:clip`.

**Quotes weak, vibes fine**  
Run `npm run index:ocr`.

**Add or remove files in a folder**  
With the API running, folders are watched automatically. Drop a photo in → CLIP + OCR for that file only. Delete one → it disappears from search (after a short debounce). Disable with `FOLDER_WATCH=0`.

**OCR stuck at ~1 image/sec on CUDA**  
You likely have CPU-only `onnxruntime`, or a too-new `onnxruntime-gpu` (1.29+ wants CUDA 13 while Torch is often CUDA 12). Use `onnxruntime-gpu==1.20.2`, uninstall plain `onnxruntime`, and restart `index:ocr`. Startup should log `RapidOCR / PaddleOCR (CUDA, …)`.

---

## License

Not decided yet. Ask before redistributing.
