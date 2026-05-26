# Opal Desktop (Tauri)

Native Mac and Windows app wrapping the same React UI and local FastAPI backend.

## Stack

| Layer | Tech |
|-------|------|
| UI | React + Vite (`frontend/`) |
| Shell | Tauri v2 (system WebView) |
| API | Python FastAPI (`python backend/run.py api` on port 8000) |

The desktop app **starts the API automatically** when you open Opal and stops it when you quit.

## Prerequisites

### All platforms

- **Python 3.11+** with dependencies: `pip install -r backend/requirements.txt`
- **Node.js 20+**
- **Rust** via [rustup](https://rustup.rs/)

### Windows

- [WebView2](https://developer.microsoft.com/en-us/microsoft-edge/webview2/) (usually preinstalled on Windows 11)
- MSVC build tools (installed by rustup with the default profile)

### macOS

- Xcode Command Line Tools: `xcode-select --install`
- **Apple Silicon:** CLIP indexing/search uses **Metal (MPS)** when PyTorch supports it. OCR stays on **CPU** (EasyOCR GPU is CUDA-only).
- If CLIP runs out of memory, lower batch size in `opal.env`: `CLIP_BATCH_SIZE=8`

## Install tooling (once)

```powershell
# Rust (Windows — restart terminal after)
winget install Rustlang.Rustup.MSVC

# Root + frontend deps
cd photo-organizer
npm install
npm install --prefix frontend
```

```bash
# Rust (macOS / Linux)
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
```

## Development

From the **project root**:

```powershell
npm run dev:desktop
```

This will:

1. Start Vite on `http://localhost:5173`
2. Spawn `python backend/run.py api` (OPAL_DESKTOP=1)
3. Open the native Opal window

### Manual split (debugging)

```powershell
# Terminal 1 — API
python backend/run.py api

# Terminal 2 — web UI only
npm run dev --prefix frontend
```

## Production build

```powershell
npm run build:desktop
```

Installers are written to `src-tauri/target/release/bundle/`.

**Note:** The current build expects Python and your library data on the machine (same as dev). Bundled Python is a later packaging step.

## Environment

| Variable | Purpose |
|----------|---------|
| `OPAL_PYTHON` | Python executable (default: `python` / `python3`) |
| `OPAL_DESKTOP` | Set by Tauri shell; relaxes CORS for local WebView |
| `IMAGE_FOLDER` | Image library path (see `backend/opal/config.py`) |
| `MANIFEST_PATH` | SQLite manifest path |
| `CHROMA_PATH` | ChromaDB folder |
| `DEVICE` | Force `cuda`, `mps`, or `cpu` (auto if unset) |
| `CLIP_BATCH_SIZE` | CLIP batch size (default: 32 CUDA, 16 MPS, 8 CPU) |
| `PYTORCH_ENABLE_MPS_FALLBACK` | Set to `1` on macOS for unsupported MPS ops (Tauri sets this automatically) |

## Native commands

Rust exposes Tauri commands for future UI hooks:

- `reveal_in_file_manager(path)` — Reveal in Explorer (Windows) or Finder (macOS)

## Icons

Regenerate from the SVG mark:

```powershell
npm run tauri icon frontend/public/icons.svg
```

On macOS this also produces `icon.icns`.

## Troubleshooting

| Issue | Fix |
|-------|-----|
| `rustc` not found | Install Rust, restart terminal |
| API timeout on launch | Run `python backend/run.py api` manually and check errors |
| Blank window / API errors | In Tauri, API base is `http://127.0.0.1:8000/api` (not Vite proxy) |
| WebView2 missing (Windows) | Install Edge WebView2 runtime |
| Indexing slow on Mac | Check API logs for `Compute device: mps`; if `cpu`, install PyTorch with MPS support |
| CLIP OOM on Mac | Set `CLIP_BATCH_SIZE=8` in `opal.env` and restart the API |
