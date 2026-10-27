from __future__ import annotations

from datetime import date, datetime, time, timedelta, timezone

import pytest

from app.db import connect, init_db
from app.services.analytics import iso_z


@pytest.fixture()
def sample_db(tmp_path):
    """Four days of perfectly-predictable wind, with a known +1000 MW bias.

    A second forecast run at 09:30 is 900 MW better. It must never be selected
    for the 09:15 gate closure, which is the core leakage test.
    """
    db_path = tmp_path / "sample.db"
    conn = connect(db_path)
    init_db(conn)

    actual_rows = []
    forecast_rows = []

    for day_index in range(4):
        day = date(2026, 1, day_index + 1)
        for hour in range(24):
            actual = 10000.0 + 100.0 * hour + 500.0 * day_index
            hour_start = datetime.combine(day, time(hour), tzinfo=timezone.utc)

            for half in (0, 30):
                start = hour_start + timedelta(minutes=half)
                actual_rows.append(
                    (
                        iso_z(start),
                        iso_z(start + timedelta(minutes=30)),
                        day.isoformat(),
                        hour * 2 + half // 30 + 1,
                        actual,
                    )
                )

            for publish_hour, offset in ((7, 1000.0), (9, 100.0)):
                publish = datetime.combine(
                    day - timedelta(days=1),
                    time(publish_hour, 30),
                    tzinfo=timezone.utc,
                )
                forecast_rows.append(
                    (
                        iso_z(publish),
                        iso_z(hour_start),
                        actual + offset,
                        int((hour_start - publish).total_seconds() // 60),
                    )
                )

    with conn:
        conn.executemany(
            """
            INSERT INTO actual_wind
                (start_time, publish_time, settlement_date, settlement_period, generation_mw)
            VALUES (?, ?, ?, ?, ?)
            """,
            actual_rows,
        )
        conn.executemany(
            """
            INSERT INTO wind_forecast
                (publish_time, start_time, generation_mw, lead_minutes)
            VALUES (?, ?, ?, ?)
            """,
            forecast_rows,
        )
    conn.close()
    return db_path
