"""SQLite storage for the Windcast snapshot.

A single-file SQLite database is deliberate: the assessment dataset is small
(~1.5k actual half-hours and ~20k forecast rows), it makes the deployable
artefact reproducible, and it keeps the local/Docker setup dependency-free.
"""

from __future__ import annotations

import os
import sqlite3
from pathlib import Path

from .config import DB_PATH

READ_ONLY = (
    os.environ.get("WINDCAST_READ_ONLY") == "1"
    or os.environ.get("VERCEL") == "1"
)

SCHEMA = """
CREATE TABLE IF NOT EXISTS actual_wind (
    start_time        TEXT PRIMARY KEY,
    publish_time      TEXT NOT NULL,
    settlement_date   TEXT NOT NULL,
    settlement_period INTEGER NOT NULL,
    generation_mw     REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS wind_forecast (
    publish_time  TEXT NOT NULL,
    start_time    TEXT NOT NULL,
    generation_mw REAL NOT NULL,
    lead_minutes  INTEGER NOT NULL,
    PRIMARY KEY (publish_time, start_time)
);

CREATE INDEX IF NOT EXISTS idx_forecast_lookup
    ON wind_forecast (start_time, publish_time DESC);

CREATE TABLE IF NOT EXISTS ingest_runs (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    started_at    TEXT NOT NULL,
    finished_at   TEXT,
    status        TEXT NOT NULL,
    actual_rows   INTEGER NOT NULL DEFAULT 0,
    forecast_rows INTEGER NOT NULL DEFAULT 0,
    message       TEXT
);

CREATE TABLE IF NOT EXISTS meta (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
);
"""


def connect(db_path: Path | str | None = None) -> sqlite3.Connection:
    """Open a connection with sensible defaults for a read-mostly app."""
    path = Path(db_path) if db_path else DB_PATH
    if READ_ONLY:
        # `immutable=1` is essential on serverless filesystems: the snapshot is
        # static and the platform's read-only mount cannot service SQLite locks.
        uri = f"{path.resolve().as_uri()}?mode=ro&immutable=1"
        conn = sqlite3.connect(
            uri,
            uri=True,
            timeout=30.0,
            check_same_thread=False,
        )
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA foreign_keys=ON")
        return conn

    path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(path, timeout=30.0, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


def init_db(conn: sqlite3.Connection) -> None:
    conn.executescript(SCHEMA)
    conn.commit()


def get_meta(conn: sqlite3.Connection) -> dict[str, str]:
    rows = conn.execute("SELECT key, value FROM meta").fetchall()
    return {row["key"]: row["value"] for row in rows}


def set_meta(conn: sqlite3.Connection, values: dict[str, str]) -> None:
    conn.executemany(
        "INSERT INTO meta(key, value) VALUES (?, ?) "
        "ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        list(values.items()),
    )
