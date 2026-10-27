"""Vercel entrypoint.

Vercel looks for a FastAPI instance named ``app`` in supported entrypoints.
Keeping this shim at the repository root lets the platform deploy the same
application that runs in Docker, without duplicating any routing logic.
"""

from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT / "backend"))

from app.main import app  # noqa: E402  (path setup must happen first)

__all__ = ["app"]
