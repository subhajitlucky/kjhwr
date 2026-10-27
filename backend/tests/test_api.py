from __future__ import annotations

from fastapi.testclient import TestClient

from app.main import create_app


def client_for(db_path):
    return TestClient(create_app(db_path))


def test_health_and_meta(sample_db):
    client = client_for(sample_db)
    health = client.get("/api/health")
    assert health.status_code == 200
    assert health.json()["status"] == "ok"
    assert health.json()["actual_rows"] == 192

    meta = client.get("/api/meta")
    assert meta.status_code == 200
    body = meta.json()
    assert body["default_cutoff_time"] == "09:15"
    assert body["counts"]["forecast_vintages"] == 8


def test_latest_forecast_and_calibrated_view(sample_db):
    client = client_for(sample_db)
    raw = client.get("/api/forecast/latest?delivery_date=2026-01-03").json()
    assert raw["vintage"] == "2026-01-02T07:30:00Z"
    assert raw["summary"]["mae_mw"] == 1000.0
    assert raw["calibrated"] is False

    calibrated = client.get(
        "/api/forecast/latest?delivery_date=2026-01-03&calibrated=true"
    ).json()
    assert calibrated["calibrated"] is True
    assert calibrated["summary"]["mae_mw"] == 0.0
    assert calibrated["calibration"]["bias_mw"] == 1000.0


def test_accuracy_endpoint(sample_db):
    client = client_for(sample_db)
    response = client.get("/api/accuracy?start=2026-01-01&end=2026-01-05")
    assert response.status_code == 200
    body = response.json()
    assert body["summary"]["matched_hours"] == 96
    assert body["calibration_impact"]["improvement_pct"] == 50.0
    assert len(body["daily"]) == 4


def test_procurement_endpoint(sample_db):
    client = client_for(sample_db)
    response = client.get(
        "/api/procurement?delivery_date=2026-01-03&demand_gw=35&calibrated=true"
    )
    assert response.status_code == 200
    body = response.json()
    assert body["calibrated"] is True
    assert body["summary"]["demand_mwh"] == 840_000.0


def test_validation_errors_are_explicit(sample_db):
    client = client_for(sample_db)
    bad_date = client.get("/api/forecast/latest?delivery_date=2025-12-01")
    assert bad_date.status_code == 400
    assert "delivery_date" in bad_date.json()["detail"]

    bad_cutoff = client.get("/api/forecast/latest?delivery_date=2026-01-03&cutoff=25:00")
    assert bad_cutoff.status_code == 400

    bad_window = client.get("/api/accuracy?start=2026-01-05&end=2026-01-01")
    assert bad_window.status_code == 400


def test_csv_exports(sample_db):
    client = client_for(sample_db)
    forecast = client.get("/api/export/forecast.csv?delivery_date=2026-01-03")
    assert forecast.status_code == 200
    assert forecast.text.splitlines()[0].startswith("start_time,forecast_mw")

    accuracy = client.get("/api/export/accuracy.csv?start=2026-01-01&end=2026-01-05")
    assert accuracy.status_code == 200
    header = accuracy.text.splitlines()[0]
    assert "delivery_date" in header
    assert "mae_calibrated_mw" in header
