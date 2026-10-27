"""Build the local SQLite snapshot from the Elexon public API."""

from __future__ import annotations

import argparse
import json
import logging
from dataclasses import asdict, dataclass
from datetime import date, datetime, time, timedelta, timezone
from pathlib import Path

from ..config import (
    ANALYSIS_END,
    ANALYSIS_START,
    DB_PATH,
    RAW_DIR,
)
from ..db import connect, init_db, set_meta
from .elexon import ElexonClient, iso_z, parse_iso

log = logging.getLogger(__name__)


@dataclass
class IngestResult:
    actual_rows: int
    forecast_rows: int
    actual_start: str | None
    actual_end: str | None
    forecast_publish_start: str | None
    forecast_publish_end: str | None
    ingested_at: str


def _utc_midnight(day: date) -> datetime:
    return datetime.combine(day, time.min, tzinfo=timezone.utc)


def _clean_actuals(rows: list[dict], start: datetime, end: datetime) -> list[dict]:
    """Filter to WIND, the delivery window, and one row per settlement period."""
    by_start: dict[str, dict] = {}
    for row in rows:
        if row.get("fuelType") != "WIND":
            continue
        try:
            start_time = parse_iso(row["startTime"])
            generation = float(row["generation"])
        except (KeyError, TypeError, ValueError):
            continue
        if not (start <= start_time < end):
            continue
        key = iso_z(start_time)
        existing = by_start.get(key)
        if existing is None or row.get("publishTime", "") >= existing.get("publishTime", ""):
            by_start[key] = {
                "start_time": key,
                "publish_time": row.get("publishTime", ""),
                "settlement_date": row.get("settlementDate", ""),
                "settlement_period": int(row.get("settlementPeriod") or 0),
                "generation_mw": generation,
            }
    return sorted(by_start.values(), key=lambda item: item["start_time"])


def _clean_forecasts(rows: list[dict], start: datetime, end: datetime) -> list[dict]:
    """Keep only forecasts genuinely published before their delivery period."""
    by_key: dict[tuple[str, str], dict] = {}
    for row in rows:
        try:
            start_time = parse_iso(row["startTime"])
            publish_time = parse_iso(row["publishTime"])
            generation = float(row["generation"])
        except (KeyError, TypeError, ValueError):
            continue
        if not (start <= start_time < end):
            continue
        lead_minutes = int((start_time - publish_time).total_seconds() // 60)
        if lead_minutes < 0:
            continue
        key = (iso_z(publish_time), iso_z(start_time))
        by_key[key] = {
            "publish_time": key[0],
            "start_time": key[1],
            "generation_mw": generation,
            "lead_minutes": lead_minutes,
        }
    return sorted(by_key.values(), key=lambda item: (item["publish_time"], item["start_time"]))


def ingest(
    start: date = ANALYSIS_START,
    end: date = ANALYSIS_END,
    *,
    force: bool = False,
    db_path: Path = DB_PATH,
    raw_dir: Path = RAW_DIR,
) -> IngestResult:
    """Download the January 2026 wind actuals/forecasts and persist a snapshot."""
    if end <= start:
        raise ValueError("end must be after start")

    start_dt = _utc_midnight(start)
    end_dt = _utc_midnight(end)

    # Actuals are published shortly after each half hour; fetch a little past
    # the window so the final settlement period is included.
    actual_from = start_dt
    actual_to = end_dt + timedelta(hours=3)

    # A forecast for 1 Jan can be published up to ~3 days earlier. Fetch from
    # four days before the window and one day after it.
    forecast_from = start_dt - timedelta(days=4)
    forecast_to = end_dt + timedelta(days=1)

    with ElexonClient(raw_dir=raw_dir, force=force) as client:
        raw_actuals = client.fuelhh(actual_from, actual_to)
        raw_forecasts = client.windfor(forecast_from, forecast_to)

    actuals = _clean_actuals(raw_actuals, start_dt, end_dt)
    forecasts = _clean_forecasts(raw_forecasts, start_dt, end_dt)

    if not actuals:
        raise RuntimeError("No actual WIND rows returned; refusing to write an empty snapshot")
    if not forecasts:
        raise RuntimeError("No valid WINDFOR rows returned; refusing to write an empty snapshot")

    conn = connect(db_path)
    init_db(conn)
    started_at = datetime.now(timezone.utc)
    cursor = conn.execute(
        "INSERT INTO ingest_runs(started_at, status) VALUES (?, 'running')",
        (iso_z(started_at),),
    )
    run_id = cursor.lastrowid
    try:
        with conn:
            conn.execute(
                "DELETE FROM actual_wind WHERE start_time >= ? AND start_time < ?",
                (iso_z(start_dt), iso_z(end_dt)),
            )
            conn.execute(
                "DELETE FROM wind_forecast WHERE start_time >= ? AND start_time < ?",
                (iso_z(start_dt), iso_z(end_dt)),
            )
            conn.executemany(
                """
                INSERT INTO actual_wind
                    (start_time, publish_time, settlement_date,
                     settlement_period, generation_mw)
                VALUES (:start_time, :publish_time, :settlement_date,
                        :settlement_period, :generation_mw)
                ON CONFLICT(start_time) DO UPDATE SET
                    publish_time = excluded.publish_time,
                    settlement_date = excluded.settlement_date,
                    settlement_period = excluded.settlement_period,
                    generation_mw = excluded.generation_mw
                """,
                actuals,
            )
            conn.executemany(
                """
                INSERT INTO wind_forecast
                    (publish_time, start_time, generation_mw, lead_minutes)
                VALUES (:publish_time, :start_time, :generation_mw, :lead_minutes)
                ON CONFLICT(publish_time, start_time) DO UPDATE SET
                    generation_mw = excluded.generation_mw,
                    lead_minutes = excluded.lead_minutes
                """,
                forecasts,
            )

            publish_times = sorted({row["publish_time"] for row in forecasts})
            set_meta(
                conn,
                {
                    "analysis_start": start.isoformat(),
                    "analysis_end": end.isoformat(),
                    "actual_count": str(len(actuals)),
                    "forecast_count": str(len(forecasts)),
                    "actual_min": actuals[0]["start_time"],
                    "actual_max": actuals[-1]["start_time"],
                    "forecast_publish_min": publish_times[0],
                    "forecast_publish_max": publish_times[-1],
                    "source": "Elexon BMRS FUELHH (WIND) + WINDFOR",
                    "ingested_at": iso_z(datetime.now(timezone.utc)),
                    "dataset": "GB national wind, January 2026",
                },
            )
            conn.execute(
                """
                UPDATE ingest_runs
                SET finished_at = ?, status = 'success',
                    actual_rows = ?, forecast_rows = ?
                WHERE id = ?
                """,
                (
                    iso_z(datetime.now(timezone.utc)),
                    len(actuals),
                    len(forecasts),
                    run_id,
                ),
            )
    except Exception as exc:  # noqa: BLE001 - recorded for the operator
        conn.execute(
            "UPDATE ingest_runs SET finished_at = ?, status = 'failed', message = ? WHERE id = ?",
            (iso_z(datetime.now(timezone.utc)), str(exc)[:1000], run_id),
        )
        conn.commit()
        raise
    finally:
        conn.close()

    result = IngestResult(
        actual_rows=len(actuals),
        forecast_rows=len(forecasts),
        actual_start=actuals[0]["start_time"],
        actual_end=actuals[-1]["start_time"],
        forecast_publish_start=publish_times[0],
        forecast_publish_end=publish_times[-1],
        ingested_at=iso_z(datetime.now(timezone.utc)),
    )
    return result


def main() -> None:
    parser = argparse.ArgumentParser(description="Ingest Elexon wind data into SQLite")
    parser.add_argument("--start", type=date.fromisoformat, default=ANALYSIS_START)
    parser.add_argument("--end", type=date.fromisoformat, default=ANALYSIS_END)
    parser.add_argument("--force", action="store_true", help="ignore the raw-response cache")
    parser.add_argument("--db", type=Path, default=DB_PATH)
    args = parser.parse_args()

    logging.basicConfig(
        level=logging.INFO, format="%(asctime)s  %(levelname)-7s %(message)s"
    )
    result = ingest(args.start, args.end, force=args.force, db_path=args.db)
    print(json.dumps(asdict(result), indent=2))


if __name__ == "__main__":
    main()
