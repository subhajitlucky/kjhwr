from __future__ import annotations

from datetime import datetime, timezone

from app.services.ingest import _clean_actuals, _clean_forecasts

START = datetime(2026, 1, 1, tzinfo=timezone.utc)
END = datetime(2026, 1, 2, tzinfo=timezone.utc)


def test_actuals_are_filtered_to_wind_and_deduplicated():
    rows = [
        {
            "fuelType": "WIND",
            "startTime": "2026-01-01T00:00:00Z",
            "publishTime": "2026-01-01T00:30:00Z",
            "settlementDate": "2026-01-01",
            "settlementPeriod": 1,
            "generation": 100,
        },
        {
            "fuelType": "WIND",
            "startTime": "2026-01-01T00:00:00Z",
            "publishTime": "2026-01-01T00:40:00Z",
            "settlementDate": "2026-01-01",
            "settlementPeriod": 1,
            "generation": 120,
        },
        {
            "fuelType": "CCGT",
            "startTime": "2026-01-01T00:30:00Z",
            "publishTime": "2026-01-01T01:00:00Z",
            "settlementDate": "2026-01-01",
            "settlementPeriod": 2,
            "generation": 999,
        },
        {
            "fuelType": "WIND",
            "startTime": "2026-01-02T00:00:00Z",
            "publishTime": "2026-01-02T00:30:00Z",
            "settlementDate": "2026-01-02",
            "settlementPeriod": 1,
            "generation": 50,
        },
    ]
    cleaned = _clean_actuals(rows, START, END)
    assert len(cleaned) == 1
    assert cleaned[0]["generation_mw"] == 120  # latest publication wins
    assert cleaned[0]["start_time"] == "2026-01-01T00:00:00Z"


def test_forecasts_reject_rows_published_after_delivery():
    rows = [
        {
            "startTime": "2026-01-01T12:00:00Z",
            "publishTime": "2025-12-31T07:30:00Z",
            "generation": 5000,
        },
        {
            "startTime": "2026-01-01T13:00:00Z",
            "publishTime": "2026-01-01T13:30:00Z",
            "generation": 5100,
        },
    ]
    cleaned = _clean_forecasts(rows, START, END)
    assert len(cleaned) == 1
    assert cleaned[0]["lead_minutes"] == 28 * 60 + 30
