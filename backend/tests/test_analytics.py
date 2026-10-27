from __future__ import annotations

import math
from datetime import date, time

from app.db import connect
from app.services import analytics as a


def test_percentile_is_linear():
    assert a.percentile([], 90) is None
    assert a.percentile([5], 90) == 5
    assert a.percentile([0, 10], 50) == 5
    assert a.percentile([0, 10], 90) == 9


def test_vintage_discipline_never_uses_the_late_run(sample_db):
    conn = connect(sample_db)
    bundle = a.day_bundle(conn, date(2026, 1, 3), time(9, 15))
    assert bundle["vintage"] == "2026-01-02T07:30:00Z"
    assert bundle["vintage_lag_minutes"] == 105
    # The 09:30 run would have been 900 MW better, but it was not available.
    assert bundle["summary"]["mae_mw"] == 1000.0
    assert bundle["summary"]["bias_mw"] == 1000.0
    assert bundle["summary"]["coverage_pct"] == 100.0
    conn.close()


def test_half_hours_are_averaged_into_hourly_actuals(sample_db):
    conn = connect(sample_db)
    bundle = a.day_bundle(conn, date(2026, 1, 1), time(9, 15))
    assert len(bundle["series"]) == 24
    assert bundle["series"][0]["actual_mw"] == 10000.0
    assert bundle["series"][23]["actual_mw"] == 12300.0
    conn.close()


def test_calibration_removes_a_known_bias(sample_db):
    conn = connect(sample_db)
    calibration = a.calibration_for_day(conn, date(2026, 1, 3), time(9, 15))
    assert calibration["applied"] is True
    assert calibration["matched_hours"] == 48
    assert calibration["bias_mw"] == 1000.0
    assert calibration["p90_abs_error_mw"] == 0.0

    calibrated = a.day_bundle(conn, date(2026, 1, 3), time(9, 15), calibrated=True)
    assert calibrated["summary"]["mae_mw"] == 0.0
    assert calibrated["summary"]["bias_mw"] == 0.0
    assert calibrated["summary_raw"]["mae_mw"] == 1000.0
    conn.close()


def test_accuracy_reports_raw_and_calibrated_metrics(sample_db):
    conn = connect(sample_db)
    bundle = a.accuracy_bundle(conn, date(2026, 1, 1), date(2026, 1, 5), time(9, 15))
    assert bundle["summary"]["matched_hours"] == 96
    assert bundle["summary"]["mae_mw"] == 1000.0
    # Days 1-2 have no history, days 3-4 are fully corrected.
    assert bundle["summary_calibrated"]["mae_mw"] == 500.0
    assert bundle["calibration_impact"]["improvement_pct"] == 50.0
    assert len(bundle["daily"]) == 4
    assert bundle["daily"][0]["calibration_applied"] is False
    assert bundle["daily"][2]["calibration_applied"] is True
    conn.close()


def test_revisions_marks_the_post_cutoff_run_as_unavailable(sample_db):
    conn = connect(sample_db)
    bundle = a.revisions_bundle(conn, date(2026, 1, 3), time(9, 15))
    by_time = {item["publish_time"]: item for item in bundle["vintages"]}
    assert by_time["2026-01-02T07:30:00Z"]["available_at_cutoff"] is True
    assert by_time["2026-01-02T09:30:00Z"]["available_at_cutoff"] is False
    conn.close()


def test_procurement_has_no_buffer_without_history(sample_db):
    conn = connect(sample_db)
    bundle = a.procurement_bundle(conn, date(2026, 1, 1), 35.0, time(9, 15))
    assert bundle["calibration"]["applied"] is False
    assert bundle["buffer_mw"] == 0.0
    assert bundle["summary"]["demand_mwh"] == 840_000.0
    assert bundle["summary"]["forecast_wind_mwh"] == 291_600.0
    conn.close()


def test_procurement_uses_trailing_calibration(sample_db):
    conn = connect(sample_db)
    bundle = a.procurement_bundle(conn, date(2026, 1, 3), 35.0, time(9, 15))
    assert bundle["calibration"]["applied"] is True
    # Corrected forecast equals actual, so the residual is exactly demand minus wind.
    assert math.isclose(
        bundle["summary"]["residual_demand_mwh"],
        bundle["summary"]["demand_mwh"] - bundle["summary"]["forecast_wind_mwh"],
        rel_tol=1e-9,
    )
    conn.close()
