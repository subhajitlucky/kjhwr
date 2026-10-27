"""HTTP API for the Windcast dashboard."""

from __future__ import annotations

import csv
import io
from datetime import date, time
from pathlib import Path
from typing import Iterator

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import Response

from ..config import (
    ANALYSIS_END,
    ANALYSIS_START,
    DEFAULT_CUTOFF_LABEL,
    DEFAULT_CUTOFF_TIME,
)
from ..db import connect, get_meta
from ..services import analytics

router = APIRouter(prefix="/api", tags=["windcast"])


def get_conn(request: Request) -> Iterator:
    conn = connect(request.app.state.db_path)
    try:
        yield conn
    finally:
        conn.close()


def parse_cutoff(value: str) -> time:
    try:
        cutoff = time.fromisoformat(value)
    except ValueError as exc:
        raise HTTPException(
            status_code=400, detail="cutoff must be a 24-hour time such as 09:15"
        ) from exc
    if cutoff.tzinfo is not None:
        raise HTTPException(status_code=400, detail="cutoff must not include a timezone")
    return cutoff


def ensure_window(start: date, end: date) -> None:
    if start >= end:
        raise HTTPException(status_code=400, detail="start must be before end")
    if start < ANALYSIS_START or end > ANALYSIS_END:
        raise HTTPException(
            status_code=400,
            detail=(
                f"window must fall inside {ANALYSIS_START.isoformat()} to "
                f"{ANALYSIS_END.isoformat()} (exclusive)"
            ),
        )


def ensure_day(day: date) -> None:
    if not (ANALYSIS_START <= day < ANALYSIS_END):
        raise HTTPException(
            status_code=400,
            detail=(
                f"delivery_date must be on or after {ANALYSIS_START.isoformat()} "
                f"and before {ANALYSIS_END.isoformat()}"
            ),
        )


@router.get("/health")
def health(conn=Depends(get_conn)) -> dict:
    actual = conn.execute("SELECT COUNT(*) AS n FROM actual_wind").fetchone()["n"]
    forecast = conn.execute("SELECT COUNT(*) AS n FROM wind_forecast").fetchone()["n"]
    return {
        "status": "ok" if actual and forecast else "empty",
        "actual_rows": actual,
        "forecast_rows": forecast,
    }


@router.get("/meta")
def meta(conn=Depends(get_conn)) -> dict:
    stored = get_meta(conn)
    counts = {
        "actual_rows": conn.execute("SELECT COUNT(*) AS n FROM actual_wind").fetchone()["n"],
        "forecast_rows": conn.execute("SELECT COUNT(*) AS n FROM wind_forecast").fetchone()["n"],
        "forecast_vintages": conn.execute(
            "SELECT COUNT(DISTINCT publish_time) AS n FROM wind_forecast"
        ).fetchone()["n"],
    }
    bounds = conn.execute(
        "SELECT MIN(start_time) AS first, MAX(start_time) AS last FROM actual_wind"
    ).fetchone()
    last_run = conn.execute(
        "SELECT started_at, finished_at, status FROM ingest_runs ORDER BY id DESC LIMIT 1"
    ).fetchone()

    return {
        "product": "Windcast",
        "dataset": stored.get("dataset", "GB national wind, January 2026"),
        "source": stored.get("source", "Elexon BMRS"),
        "analysis_start": stored.get("analysis_start", ANALYSIS_START.isoformat()),
        "analysis_end": stored.get("analysis_end", ANALYSIS_END.isoformat()),
        "actual_first": bounds["first"],
        "actual_last": bounds["last"],
        "counts": counts,
        "default_cutoff_time": DEFAULT_CUTOFF_TIME.strftime("%H:%M"),
        "default_cutoff_label": DEFAULT_CUTOFF_LABEL,
        "default_demand_gw": 35.0,
        "ingested_at": stored.get("ingested_at"),
        "last_ingest": dict(last_run) if last_run else None,
    }


@router.get("/forecast/latest")
def latest_forecast(
    delivery_date: date = Query(..., alias="delivery_date"),
    cutoff: str = Query(DEFAULT_CUTOFF_TIME.strftime("%H:%M")),
    calibrated: bool = Query(False),
    conn=Depends(get_conn),
) -> dict:
    ensure_day(delivery_date)
    cutoff_time = parse_cutoff(cutoff)
    bundle = analytics.day_bundle(
        conn, delivery_date, cutoff_time, calibrated=calibrated
    )
    bundle["cutoff_label"] = DEFAULT_CUTOFF_LABEL
    bundle["forecast_available"] = bundle["summary"]["hours_with_forecast"] > 0
    return bundle


@router.get("/forecast/revisions")
def forecast_revisions(
    delivery_date: date = Query(..., alias="delivery_date"),
    cutoff: str = Query(DEFAULT_CUTOFF_TIME.strftime("%H:%M")),
    conn=Depends(get_conn),
) -> dict:
    ensure_day(delivery_date)
    bundle = analytics.revisions_bundle(conn, delivery_date, parse_cutoff(cutoff))
    bundle["cutoff_label"] = DEFAULT_CUTOFF_LABEL
    return bundle


@router.get("/accuracy")
def accuracy(
    start: date = Query(ANALYSIS_START),
    end: date = Query(ANALYSIS_END),
    cutoff: str = Query(DEFAULT_CUTOFF_TIME.strftime("%H:%M")),
    conn=Depends(get_conn),
) -> dict:
    ensure_window(start, end)
    bundle = analytics.accuracy_bundle(conn, start, end, parse_cutoff(cutoff))
    bundle["cutoff_label"] = DEFAULT_CUTOFF_LABEL
    return bundle


@router.get("/procurement")
def procurement(
    delivery_date: date = Query(..., alias="delivery_date"),
    demand_gw: float = Query(35.0, ge=5, le=80),
    cutoff: str = Query(DEFAULT_CUTOFF_TIME.strftime("%H:%M")),
    buffer_mw: float | None = Query(None, ge=0, le=15000),
    calibrated: bool = Query(True),
    conn=Depends(get_conn),
) -> dict:
    ensure_day(delivery_date)
    return analytics.procurement_bundle(
        conn,
        delivery_date,
        demand_gw,
        parse_cutoff(cutoff),
        buffer_mw,
        calibrated=calibrated,
    )


@router.get("/export/accuracy.csv")
def export_accuracy(
    start: date = Query(ANALYSIS_START),
    end: date = Query(ANALYSIS_END),
    cutoff: str = Query(DEFAULT_CUTOFF_TIME.strftime("%H:%M")),
    conn=Depends(get_conn),
) -> Response:
    ensure_window(start, end)
    bundle = analytics.accuracy_bundle(conn, start, end, parse_cutoff(cutoff))
    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow(
        [
            "delivery_date",
            "vintage",
            "vintage_lag_minutes",
            "coverage_pct",
            "mae_mw",
            "rmse_mw",
            "bias_mw",
            "p90_abs_error_mw",
            "mae_calibrated_mw",
            "calibration_applied",
            "calibration_bias_mw",
            "forecast_total_mwh",
            "actual_total_mwh",
        ]
    )
    keys = [
        "date",
        "vintage",
        "vintage_lag_minutes",
        "coverage_pct",
        "mae_mw",
        "rmse_mw",
        "bias_mw",
        "p90_abs_error_mw",
        "mae_calibrated_mw",
        "calibration_applied",
        "calibration_bias_mw",
        "forecast_total_mwh",
        "actual_total_mwh",
    ]
    for row in bundle["daily"]:
        writer.writerow([row.get(key) for key in keys])
    return Response(
        content=buffer.getvalue(),
        media_type="text/csv",
        headers={
            "Content-Disposition": (
                f'attachment; filename="windcast-accuracy-{start}-to-{end}.csv"'
            )
        },
    )


@router.get("/export/forecast.csv")
def export_forecast(
    delivery_date: date = Query(..., alias="delivery_date"),
    cutoff: str = Query(DEFAULT_CUTOFF_TIME.strftime("%H:%M")),
    conn=Depends(get_conn),
) -> Response:
    ensure_day(delivery_date)
    bundle = analytics.day_bundle(conn, delivery_date, parse_cutoff(cutoff))
    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow(
        [
            "start_time",
            "forecast_mw",
            "actual_mw",
            "error_mw",
            "abs_error_mw",
            "vintage",
            "lead_hours",
        ]
    )
    for row in bundle["series"]:
        writer.writerow([row.get(key) for key in row])
    return Response(
        content=buffer.getvalue(),
        media_type="text/csv",
        headers={
            "Content-Disposition": (
                f'attachment; filename="windcast-forecast-{delivery_date}.csv"'
            )
        },
    )
