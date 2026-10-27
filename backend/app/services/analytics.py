"""Forecast selection, calibration, and accuracy analytics.

The central rule is *vintage discipline*: for a delivery period we only use
the most recent forecast published before the decision cut-off. Using a later
publication would leak information the trader did not have and would flatter
the measured accuracy.

A second, deliberate layer is *bias calibration*. The public WINDFOR series
and the FUELHH transmission-wind outturn are not perfectly like-for-like (the
former runs high in January 2026), so the app measures the trailing bias and
offers a corrected view. Raw accuracy is always reported alongside it.
"""

from __future__ import annotations

import math
from dataclasses import dataclass, replace
from datetime import date, datetime, time, timedelta, timezone
from typing import Iterable

from ..config import (
    ANALYSIS_END,
    ANALYSIS_START,
    BUFFER_LOOKBACK_DAYS,
    DEFAULT_CUTOFF_TIME,
    MAPE_FLOOR_MW,
)

LEAD_BUCKETS: list[tuple[int, int]] = [
    (0, 12),
    (12, 18),
    (18, 24),
    (24, 30),
    (30, 36),
    (36, 42),
    (42, 48),
    (48, 72),
]

MIN_CALIBRATION_HOURS = 48


# --------------------------------------------------------------------- time
def iso_z(value: datetime) -> str:
    return value.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def parse_iso(value: str) -> datetime:
    return datetime.fromisoformat(value.replace("Z", "+00:00"))


def cutoff_for(day: date, cutoff_time: time = DEFAULT_CUTOFF_TIME) -> datetime:
    """Gate closure for a delivery day: the previous day at the given time."""
    return datetime.combine(day - timedelta(days=1), cutoff_time, tzinfo=timezone.utc)


def _day_bounds(day: date) -> tuple[datetime, datetime]:
    start = datetime.combine(day, time.min, tzinfo=timezone.utc)
    return start, start + timedelta(days=1)


def _date_range(start: date, end: date) -> Iterable[date]:
    cursor = start
    while cursor < end:
        yield cursor
        cursor += timedelta(days=1)


# ------------------------------------------------------------------- maths
def percentile(values: list[float], pct: float) -> float | None:
    """Linear-interpolation percentile, pct in [0, 100]."""
    if not values:
        return None
    ordered = sorted(values)
    if len(ordered) == 1:
        return ordered[0]
    position = (len(ordered) - 1) * (pct / 100.0)
    lower = math.floor(position)
    upper = math.ceil(position)
    if lower == upper:
        return ordered[int(position)]
    fraction = position - lower
    return ordered[lower] + (ordered[upper] - ordered[lower]) * fraction


def _round(value: float | None, digits: int = 1) -> float | None:
    return None if value is None else round(value, digits)


@dataclass(frozen=True)
class HourPair:
    start_time: str
    forecast_mw: float | None
    actual_mw: float | None
    vintage: str | None
    lead_hours: float | None

    @property
    def error_mw(self) -> float | None:
        if self.forecast_mw is None or self.actual_mw is None:
            return None
        return self.forecast_mw - self.actual_mw

    def as_dict(self, bias_mw: float = 0.0) -> dict:
        raw_forecast = self.forecast_mw
        forecast = raw_forecast - bias_mw if raw_forecast is not None else None
        error = forecast - self.actual_mw if forecast is not None and self.actual_mw is not None else None
        raw_error = (
            raw_forecast - self.actual_mw
            if raw_forecast is not None and self.actual_mw is not None
            else None
        )
        return {
            "start_time": self.start_time,
            "forecast_mw": _round(forecast),
            "raw_forecast_mw": _round(raw_forecast),
            "actual_mw": _round(self.actual_mw),
            "error_mw": _round(error),
            "abs_error_mw": _round(abs(error)) if error is not None else None,
            "raw_error_mw": _round(raw_error),
            "vintage": self.vintage,
            "lead_hours": _round(self.lead_hours),
        }


@dataclass
class SeriesResult:
    pairs: list[HourPair]
    cutoff: datetime
    vintage: str | None
    expected_hours: int

    @property
    def vintage_lag_minutes(self) -> int | None:
        if not self.vintage:
            return None
        return int((self.cutoff - parse_iso(self.vintage)).total_seconds() // 60)


# --------------------------------------------------------------- selection
def _hourly_actuals(conn, start: datetime, end: datetime) -> dict[str, float]:
    rows = conn.execute(
        """
        SELECT substr(start_time, 1, 13) || ':00:00Z' AS hour_start,
               AVG(generation_mw) AS actual_mw
        FROM actual_wind
        WHERE start_time >= ? AND start_time < ?
        GROUP BY substr(start_time, 1, 13)
        """,
        (iso_z(start), iso_z(end)),
    ).fetchall()
    return {row["hour_start"]: float(row["actual_mw"]) for row in rows}


def _selected_forecasts(conn, start: datetime, end: datetime, cutoff: datetime) -> dict[str, dict]:
    rows = conn.execute(
        """
        SELECT start_time, publish_time, generation_mw, lead_minutes
        FROM (
            SELECT start_time, publish_time, generation_mw, lead_minutes,
                   ROW_NUMBER() OVER (
                       PARTITION BY start_time ORDER BY publish_time DESC
                   ) AS rn
            FROM wind_forecast
            WHERE start_time >= ? AND start_time < ? AND publish_time <= ?
        )
        WHERE rn = 1
        """,
        (iso_z(start), iso_z(end), iso_z(cutoff)),
    ).fetchall()
    return {row["start_time"]: dict(row) for row in rows}


def build_series(conn, start: datetime, end: datetime, cutoff: datetime) -> SeriesResult:
    actuals = _hourly_actuals(conn, start, end)
    forecasts = _selected_forecasts(conn, start, end, cutoff)

    hours: list[str] = []
    cursor = start
    while cursor < end:
        hours.append(iso_z(cursor))
        cursor += timedelta(hours=1)

    pairs: list[HourPair] = []
    for hour in hours:
        forecast = forecasts.get(hour)
        pairs.append(
            HourPair(
                start_time=hour,
                forecast_mw=float(forecast["generation_mw"]) if forecast else None,
                actual_mw=actuals.get(hour),
                vintage=forecast["publish_time"] if forecast else None,
                lead_hours=(float(forecast["lead_minutes"]) / 60.0 if forecast else None),
            )
        )

    vintages = [pair.vintage for pair in pairs if pair.vintage]
    return SeriesResult(
        pairs=pairs,
        cutoff=cutoff,
        vintage=max(vintages) if vintages else None,
        expected_hours=len(hours),
    )


# ------------------------------------------------------------------ summary
def summarize(pairs: list[HourPair], expected_hours: int | None = None) -> dict:
    paired = [pair for pair in pairs if pair.error_mw is not None]
    forecast_values = [pair.forecast_mw for pair in pairs if pair.forecast_mw is not None]
    actual_values = [pair.actual_mw for pair in pairs if pair.actual_mw is not None]

    errors = [pair.error_mw for pair in paired if pair.error_mw is not None]
    abs_errors = [abs(error) for error in errors]
    mape_samples = [
        abs(pair.error_mw) / pair.actual_mw
        for pair in paired
        if pair.error_mw is not None
        and pair.actual_mw is not None
        and pair.actual_mw >= MAPE_FLOOR_MW
    ]

    total_hours = expected_hours or len(pairs)
    return {
        "hours": len(pairs),
        "hours_with_forecast": len(forecast_values),
        "hours_with_actual": len(actual_values),
        "matched_hours": len(paired),
        "coverage_pct": _round(100.0 * len(paired) / total_hours) if total_hours else None,
        "mae_mw": _round(sum(abs_errors) / len(abs_errors)) if abs_errors else None,
        "rmse_mw": (
            _round(math.sqrt(sum(error * error for error in errors) / len(errors)))
            if errors
            else None
        ),
        "bias_mw": _round(sum(errors) / len(errors)) if errors else None,
        "p90_abs_error_mw": _round(percentile(abs_errors, 90)),
        "p95_abs_error_mw": _round(percentile(abs_errors, 95)),
        "max_abs_error_mw": _round(max(abs_errors)) if abs_errors else None,
        "mape_pct": _round(100.0 * sum(mape_samples) / len(mape_samples), 2)
        if mape_samples
        else None,
        "forecast_total_mwh": _round(sum(forecast_values)) if forecast_values else None,
        "actual_total_mwh": _round(sum(actual_values)) if actual_values else None,
        "mean_forecast_mw": _round(sum(forecast_values) / len(forecast_values))
        if forecast_values
        else None,
        "mean_actual_mw": _round(sum(actual_values) / len(actual_values))
        if actual_values
        else None,
        "min_forecast_mw": _round(min(forecast_values)) if forecast_values else None,
        "max_forecast_mw": _round(max(forecast_values)) if forecast_values else None,
        "min_actual_mw": _round(min(actual_values)) if actual_values else None,
        "max_actual_mw": _round(max(actual_values)) if actual_values else None,
    }


def _duration_label(minutes: int | None) -> str | None:
    if minutes is None:
        return None
    if minutes < 60:
        return f"{minutes} min"
    hours, remainder = divmod(minutes, 60)
    if remainder:
        return f"{hours}h {remainder}m"
    return f"{hours}h"


# -------------------------------------------------------------- calibration
def _confidence(matched_hours: int) -> str:
    if matched_hours >= 168:
        return "high"
    if matched_hours >= 72:
        return "medium"
    return "low"


def _empty_calibration(day: date) -> dict:
    return {
        "applied": False,
        "bias_mw": 0.0,
        "matched_hours": 0,
        "lookback_start": max(ANALYSIS_START, day - timedelta(days=BUFFER_LOOKBACK_DAYS)).isoformat(),
        "lookback_end": (day - timedelta(days=1)).isoformat(),
        "p90_abs_error_mw": None,
        "confidence": "low",
        "reason": "No prior realised forecast errors are available.",
    }


def calibration_for_day(
    conn,
    day: date,
    cutoff_time: time = DEFAULT_CUTOFF_TIME,
    lookback_days: int = BUFFER_LOOKBACK_DAYS,
) -> dict:
    """Measure the trailing signed forecast bias available before `day`."""
    start = max(ANALYSIS_START, day - timedelta(days=lookback_days))
    if start >= day:
        return _empty_calibration(day)

    history: list[HourPair] = []
    for history_day in _date_range(start, day):
        day_start, day_end = _day_bounds(history_day)
        series = build_series(conn, day_start, day_end, cutoff_for(history_day, cutoff_time))
        history.extend(series.pairs)

    errors = [pair.error_mw for pair in history if pair.error_mw is not None]
    if len(errors) < MIN_CALIBRATION_HOURS:
        result = _empty_calibration(day)
        result["matched_hours"] = len(errors)
        result["reason"] = (
            f"Only {len(errors)} prior matched hours; {MIN_CALIBRATION_HOURS} needed."
        )
        return result

    bias = sum(errors) / len(errors)
    adjusted_abs = [abs(error - bias) for error in errors]
    return {
        "applied": True,
        "bias_mw": _round(bias),
        "matched_hours": len(errors),
        "lookback_start": start.isoformat(),
        "lookback_end": (day - timedelta(days=1)).isoformat(),
        "p90_abs_error_mw": _round(percentile(adjusted_abs, 90)),
        "confidence": _confidence(len(errors)),
    }


def _with_bias(pairs: list[HourPair], bias_mw: float) -> list[HourPair]:
    if not bias_mw:
        return pairs
    return [
        replace(pair, forecast_mw=pair.forecast_mw - bias_mw)
        if pair.forecast_mw is not None
        else pair
        for pair in pairs
    ]


def _summarize_with_bias(pairs: list[HourPair], expected_hours: int, bias_mw: float) -> dict:
    return summarize(_with_bias(pairs, bias_mw), expected_hours)


# ---------------------------------------------------------------- day view
def day_bundle(
    conn,
    day: date,
    cutoff_time: time = DEFAULT_CUTOFF_TIME,
    *,
    calibrated: bool = False,
) -> dict:
    start, end = _day_bounds(day)
    cutoff = cutoff_for(day, cutoff_time)
    series = build_series(conn, start, end, cutoff)

    calibration = (
        calibration_for_day(conn, day, cutoff_time)
        if calibrated
        else _empty_calibration(day)
    )
    bias = calibration["bias_mw"] if calibration["applied"] else 0.0
    summary_raw = summarize(series.pairs, series.expected_hours)
    summary = (
        _summarize_with_bias(series.pairs, series.expected_hours, bias)
        if calibration["applied"]
        else summary_raw
    )

    vintage_lag = series.vintage_lag_minutes
    return {
        "delivery_date": day.isoformat(),
        "cutoff": iso_z(cutoff),
        "cutoff_time": cutoff_time.strftime("%H:%M"),
        "vintage": series.vintage,
        "vintage_lag_minutes": vintage_lag,
        "vintage_lag_label": _duration_label(vintage_lag),
        "calibrated": calibration["applied"],
        "calibration": calibration,
        "summary": summary,
        "summary_raw": summary_raw,
        "series": [pair.as_dict(bias) for pair in series.pairs],
    }


# ----------------------------------------------------------------- accuracy
def _lead_bucket(lead_hours: float) -> str | None:
    for low, high in LEAD_BUCKETS:
        if low <= lead_hours < high:
            return f"{low}-{high}h"
    return None


def _histogram(errors: list[float], bins: int = 15) -> list[dict]:
    if not errors:
        return []
    low, high = min(errors), max(errors)
    if math.isclose(low, high):
        return [{"from_mw": _round(low), "to_mw": _round(high), "count": len(errors)}]
    width = (high - low) / bins
    counts = [0] * bins
    for error in errors:
        index = min(int((error - low) / width), bins - 1)
        counts[index] += 1
    return [
        {
            "from_mw": _round(low + index * width),
            "to_mw": _round(low + (index + 1) * width),
            "count": counts[index],
        }
        for index in range(bins)
    ]


def accuracy_bundle(
    conn,
    start: date,
    end: date,
    cutoff_time: time = DEFAULT_CUTOFF_TIME,
) -> dict:
    if end <= start:
        raise ValueError("end must be after start")

    daily: list[dict] = []
    all_pairs: list[HourPair] = []
    calibrated_pairs: list[HourPair] = []
    history_errors: list[float] = []
    expected_hours = 0

    for day in _date_range(start, end):
        day_start, day_end = _day_bounds(day)
        series = build_series(conn, day_start, day_end, cutoff_for(day, cutoff_time))
        all_pairs.extend(series.pairs)
        expected_hours += series.expected_hours

        if len(history_errors) >= MIN_CALIBRATION_HOURS:
            bias = sum(history_errors) / len(history_errors)
        else:
            bias = 0.0

        day_calibrated = _with_bias(series.pairs, bias)
        calibrated_pairs.extend(day_calibrated)
        summary = summarize(series.pairs, series.expected_hours)
        calibrated_summary = summarize(day_calibrated, series.expected_hours)

        daily.append(
            {
                "date": day.isoformat(),
                "vintage": series.vintage,
                "vintage_lag_minutes": series.vintage_lag_minutes,
                "coverage_pct": summary["coverage_pct"],
                "mae_mw": summary["mae_mw"],
                "rmse_mw": summary["rmse_mw"],
                "bias_mw": summary["bias_mw"],
                "p90_abs_error_mw": summary["p90_abs_error_mw"],
                "mae_calibrated_mw": calibrated_summary["mae_mw"],
                "calibration_applied": bool(bias),
                "calibration_bias_mw": _round(bias) if bias else None,
                "forecast_total_mwh": summary["forecast_total_mwh"],
                "actual_total_mwh": summary["actual_total_mwh"],
            }
        )

        history_errors.extend(
            pair.error_mw for pair in series.pairs if pair.error_mw is not None
        )

    paired = [pair for pair in all_pairs if pair.error_mw is not None]
    errors = [pair.error_mw for pair in paired if pair.error_mw is not None]
    abs_errors = [abs(error) for error in errors]
    calibrated_errors = [
        pair.error_mw for pair in calibrated_pairs if pair.error_mw is not None
    ]
    calibrated_abs = [abs(error) for error in calibrated_errors]

    lead_groups: dict[str, list[float]] = {}
    for pair in paired:
        if pair.lead_hours is None or pair.error_mw is None:
            continue
        label = _lead_bucket(pair.lead_hours)
        if label:
            lead_groups.setdefault(label, []).append(pair.error_mw)

    lead_time: list[dict] = []
    for low, high in LEAD_BUCKETS:
        label = f"{low}-{high}h"
        bucket_errors = lead_groups.get(label, [])
        if not bucket_errors:
            continue
        lead_time.append(
            {
                "bucket": label,
                "hours": len(bucket_errors),
                "mae_mw": _round(sum(abs(error) for error in bucket_errors) / len(bucket_errors)),
                "bias_mw": _round(sum(bucket_errors) / len(bucket_errors)),
                "rmse_mw": _round(
                    math.sqrt(sum(error * error for error in bucket_errors) / len(bucket_errors))
                ),
            }
        )

    daily_with_error = [row for row in daily if row["mae_mw"] is not None]
    ranked = sorted(daily_with_error, key=lambda row: row["mae_mw"], reverse=True)

    raw_summary = summarize(all_pairs, expected_hours)
    calibrated_summary = summarize(calibrated_pairs, expected_hours)
    raw_mae = raw_summary["mae_mw"]
    calibrated_mae = calibrated_summary["mae_mw"]
    improvement = (
        _round(100.0 * (raw_mae - calibrated_mae) / raw_mae, 1)
        if raw_mae and calibrated_mae is not None
        else None
    )

    return {
        "start": start.isoformat(),
        "end": end.isoformat(),
        "cutoff_time": cutoff_time.strftime("%H:%M"),
        "summary": raw_summary,
        "summary_calibrated": calibrated_summary,
        "calibration_impact": {
            "raw_mae_mw": raw_mae,
            "calibrated_mae_mw": calibrated_mae,
            "improvement_pct": improvement,
        },
        "daily": daily,
        "lead_time": lead_time,
        "histogram": _histogram(errors),
        "histogram_calibrated": _histogram(calibrated_errors),
        "scatter": [
            {
                "actual_mw": _round(pair.actual_mw),
                "forecast_mw": _round(pair.forecast_mw),
                "error_mw": _round(pair.error_mw),
            }
            for pair in paired
        ],
        "worst_days": ranked[:5],
        "best_days": list(reversed(ranked[-5:])),
        "error_percentiles": {
            "p10_signed_mw": _round(percentile(errors, 10)),
            "p50_signed_mw": _round(percentile(errors, 50)),
            "p90_signed_mw": _round(percentile(errors, 90)),
            "p50_abs_mw": _round(percentile(abs_errors, 50)),
            "p75_abs_mw": _round(percentile(abs_errors, 75)),
            "p90_abs_mw": _round(percentile(abs_errors, 90)),
            "p95_abs_mw": _round(percentile(abs_errors, 95)),
        },
        "calibrated_error_percentiles": {
            "p50_abs_mw": _round(percentile(calibrated_abs, 50)),
            "p90_abs_mw": _round(percentile(calibrated_abs, 90)),
            "p95_abs_mw": _round(percentile(calibrated_abs, 95)),
        },
    }


# --------------------------------------------------------------- revisions
def revisions_bundle(conn, day: date, cutoff_time: time = DEFAULT_CUTOFF_TIME) -> dict:
    start, end = _day_bounds(day)
    cutoff = cutoff_for(day, cutoff_time)

    rows = conn.execute(
        """
        SELECT publish_time, start_time, generation_mw
        FROM wind_forecast
        WHERE start_time >= ? AND start_time < ?
        ORDER BY publish_time, start_time
        """,
        (iso_z(start), iso_z(end)),
    ).fetchall()

    grouped: dict[str, list[dict]] = {}
    for row in rows:
        grouped.setdefault(row["publish_time"], []).append(
            {"start_time": row["start_time"], "generation_mw": float(row["generation_mw"])}
        )

    vintages: list[dict] = []
    for publish_time, values in sorted(grouped.items()):
        total_mwh = sum(item["generation_mw"] for item in values)
        vintages.append(
            {
                "publish_time": publish_time,
                "available_at_cutoff": parse_iso(publish_time) <= cutoff,
                "hours_covered": len(values),
                "total_mwh": _round(total_mwh),
                "mean_mw": _round(total_mwh / len(values)) if values else None,
                "values": [
                    {
                        "start_time": item["start_time"],
                        "forecast_mw": _round(item["generation_mw"]),
                    }
                    for item in values
                ],
            }
        )

    # Keep the chart readable: the last 14 vintages at or before the cutoff,
    # plus the first two after it to show what arrived too late.
    pre = [vintage for vintage in vintages if vintage["available_at_cutoff"]]
    post = [vintage for vintage in vintages if not vintage["available_at_cutoff"]]
    selected = pre[-14:] + post[:2]
    selected_publish = {vintage["publish_time"] for vintage in selected}
    chart_series = [
        vintage for vintage in vintages if vintage["publish_time"] in selected_publish
    ]

    latest = pre[-1] if pre else None
    return {
        "delivery_date": day.isoformat(),
        "cutoff": iso_z(cutoff),
        "cutoff_time": cutoff_time.strftime("%H:%M"),
        "latest_available_vintage": latest["publish_time"] if latest else None,
        "vintage_count": len(vintages),
        "vintages": chart_series,
        "selected_vintages": [vintage["publish_time"] for vintage in chart_series],
    }


# ------------------------------------------------------------- procurement
def procurement_bundle(
    conn,
    day: date,
    demand_gw: float,
    cutoff_time: time = DEFAULT_CUTOFF_TIME,
    buffer_mw: float | None = None,
    *,
    calibrated: bool = True,
) -> dict:
    start, end = _day_bounds(day)
    cutoff = cutoff_for(day, cutoff_time)
    series = build_series(conn, start, end, cutoff)

    calibration = (
        calibration_for_day(conn, day, cutoff_time)
        if calibrated
        else _empty_calibration(day)
    )
    bias = calibration["bias_mw"] if calibration["applied"] else 0.0

    forecast_values = [
        pair.forecast_mw - bias for pair in series.pairs if pair.forecast_mw is not None
    ]
    raw_forecast_total = sum(
        pair.forecast_mw for pair in series.pairs if pair.forecast_mw is not None
    )
    forecast_total = sum(forecast_values)
    demand_mw = demand_gw * 1000.0
    demand_total = demand_mw * len(series.pairs)

    recommended_buffer = buffer_mw if buffer_mw is not None else calibration["p90_abs_error_mw"]
    if recommended_buffer is None:
        recommended_buffer = 0.0

    rows: list[dict] = []
    for pair in series.pairs:
        forecast = pair.forecast_mw - bias if pair.forecast_mw is not None else None
        residual = demand_mw - forecast if forecast is not None else None
        buffered = demand_mw - forecast - recommended_buffer if forecast is not None else None
        rows.append(
            {
                "start_time": pair.start_time,
                "raw_forecast_mw": _round(pair.forecast_mw),
                "forecast_mw": _round(forecast),
                "demand_mw": _round(demand_mw),
                "residual_mw": _round(residual),
                "buffered_residual_mw": _round(buffered),
                "actual_mw": _round(pair.actual_mw),
                "actual_residual_mw": _round(demand_mw - pair.actual_mw)
                if pair.actual_mw is not None
                else None,
            }
        )

    peak_hour = max(
        (row for row in rows if row["residual_mw"] is not None),
        key=lambda row: row["residual_mw"],
        default=None,
    )

    return {
        "delivery_date": day.isoformat(),
        "cutoff": iso_z(cutoff),
        "cutoff_time": cutoff_time.strftime("%H:%M"),
        "vintage": series.vintage,
        "vintage_lag_minutes": series.vintage_lag_minutes,
        "demand_gw": demand_gw,
        "calibrated": calibration["applied"],
        "calibration": calibration,
        "buffer_mw": _round(recommended_buffer),
        "buffer_mw_override": buffer_mw is not None,
        "summary": {
            "demand_mwh": _round(demand_total),
            "raw_forecast_wind_mwh": _round(raw_forecast_total),
            "forecast_wind_mwh": _round(forecast_total),
            "residual_demand_mwh": _round(demand_total - forecast_total),
            "peak_residual_mw": _round(peak_hour["residual_mw"]) if peak_hour else None,
            "peak_residual_hour": peak_hour["start_time"] if peak_hour else None,
            "buffered_residual_mwh": _round(
                demand_total - forecast_total - recommended_buffer * len(series.pairs)
            ),
        },
        "series": rows,
    }
