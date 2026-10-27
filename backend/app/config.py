"""Application configuration and analysis constants.

The product is deliberately scope-limited to national wind generation in
Great Britain for January 2026, as specified in the assessment brief.
"""

from __future__ import annotations

import os
from datetime import date, time
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]

DATA_DIR = Path(os.environ.get("WINDCAST_DATA_DIR", REPO_ROOT / "data"))
DB_PATH = Path(os.environ.get("WINDCAST_DB_PATH", DATA_DIR / "windcast.db"))
if os.environ.get("VERCEL"):
    # Vercel's FastAPI runtime keeps the static mount directory inside the
    # function bundle. The build copies the snapshot there so it survives the
    # serverless package step.
    _serverless_snapshot = (
        REPO_ROOT / "frontend" / "dist" / "assets" / "windcast-snapshot.db"
    )
    if _serverless_snapshot.exists():
        DB_PATH = _serverless_snapshot
RAW_DIR = Path(os.environ.get("WINDCAST_RAW_DIR", DATA_DIR / "raw"))

# The delivery window covered by this pilot.
ANALYSIS_START = date(2026, 1, 1)
ANALYSIS_END = date(2026, 2, 1)  # exclusive

# GB day-ahead gate closure is 09:15 London time. January is GMT, so the
# UTC and local wall clocks are identical for the whole analysis window.
DEFAULT_CUTOFF_TIME = time(9, 15)
DEFAULT_CUTOFF_LABEL = "Day-ahead gate closure (09:15 UTC)"

# Elexon's public API rejects date ranges longer than 7 days.
ELEXON_BASE_URL = os.environ.get(
    "WINDCAST_ELEXON_BASE_URL", "https://data.elexon.co.uk/bmrs/api/v1"
)
ELEXON_CHUNK_DAYS = 6

# Wind speed / generation values below this are treated as noise for
# percentage-error calculations (MW).
MAPE_FLOOR_MW = 500.0

# Trailing window used to calibrate the procurement buffer.
BUFFER_LOOKBACK_DAYS = 14
