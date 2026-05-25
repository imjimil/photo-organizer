"""Opal backend launcher — sets import path and project-root cwd."""

from __future__ import annotations

import os
import runpy
import sys
from pathlib import Path

BACKEND = Path(__file__).resolve().parent
ROOT = BACKEND.parent

sys.path.insert(0, str(BACKEND))
os.chdir(ROOT)

COMMANDS = {
    "api": "opal.api.main",
    "index": "opal.cli.index_library",
    "duplicates": "opal.cli.find_duplicates",
}


def main() -> None:
    if len(sys.argv) < 2 or sys.argv[1] not in COMMANDS:
        names = ", ".join(sorted(COMMANDS))
        print(f"Usage: python backend/run.py <{names}> [args...]")
        sys.exit(1)

    module = COMMANDS[sys.argv[1]]
    sys.argv = [module, *sys.argv[2:]]
    runpy.run_module(module, run_name="__main__")


if __name__ == "__main__":
    main()
