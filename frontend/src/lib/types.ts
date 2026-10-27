export interface Meta {
  product: string;
  dataset: string;
  source: string;
  analysis_start: string;
  analysis_end: string;
  actual_first: string | null;
  actual_last: string | null;
  counts: {
    actual_rows: number;
    forecast_rows: number;
    forecast_vintages: number;
  };
  default_cutoff_time: string;
  default_cutoff_label: string;
  default_demand_gw: number;
  ingested_at: string | null;
  last_ingest: {
    started_at: string;
    finished_at: string | null;
    status: string;
  } | null;
}

export interface Calibration {
  applied: boolean;
  bias_mw: number;
  matched_hours: number;
  lookback_start: string;
  lookback_end: string;
  p90_abs_error_mw: number | null;
  confidence: "low" | "medium" | "high" | string;
  reason?: string;
}

export interface Summary {
  hours: number;
  hours_with_forecast: number;
  hours_with_actual: number;
  matched_hours: number;
  coverage_pct: number | null;
  mae_mw: number | null;
  rmse_mw: number | null;
  bias_mw: number | null;
  p90_abs_error_mw: number | null;
  p95_abs_error_mw: number | null;
  max_abs_error_mw: number | null;
  mape_pct: number | null;
  forecast_total_mwh: number | null;
  actual_total_mwh: number | null;
  mean_forecast_mw: number | null;
  mean_actual_mw: number | null;
  min_forecast_mw: number | null;
  max_forecast_mw: number | null;
  min_actual_mw: number | null;
  max_actual_mw: number | null;
}

export interface HourPoint {
  start_time: string;
  forecast_mw: number | null;
  raw_forecast_mw: number | null;
  actual_mw: number | null;
  error_mw: number | null;
  abs_error_mw: number | null;
  raw_error_mw: number | null;
  vintage: string | null;
  lead_hours: number | null;
}

export interface DayBundle {
  delivery_date: string;
  cutoff: string;
  cutoff_time: string;
  vintage: string | null;
  vintage_lag_minutes: number | null;
  vintage_lag_label: string | null;
  calibrated: boolean;
  calibration: Calibration;
  summary: Summary;
  summary_raw: Summary;
  series: HourPoint[];
  cutoff_label: string;
  forecast_available: boolean;
}

export interface DailyRow {
  date: string;
  vintage: string | null;
  vintage_lag_minutes: number | null;
  coverage_pct: number | null;
  mae_mw: number | null;
  rmse_mw: number | null;
  bias_mw: number | null;
  p90_abs_error_mw: number | null;
  mae_calibrated_mw: number | null;
  calibration_applied: boolean;
  calibration_bias_mw: number | null;
  forecast_total_mwh: number | null;
  actual_total_mwh: number | null;
}

export interface LeadTimeRow {
  bucket: string;
  hours: number;
  mae_mw: number | null;
  bias_mw: number | null;
  rmse_mw: number | null;
}

export interface HistogramBin {
  from_mw: number | null;
  to_mw: number | null;
  count: number;
}

export interface ScatterPoint {
  actual_mw: number | null;
  forecast_mw: number | null;
  error_mw: number | null;
}

export interface ErrorPercentiles {
  p10_signed_mw?: number | null;
  p50_signed_mw?: number | null;
  p90_signed_mw?: number | null;
  p50_abs_mw?: number | null;
  p75_abs_mw?: number | null;
  p90_abs_mw?: number | null;
  p95_abs_mw?: number | null;
}

export interface AccuracyBundle {
  start: string;
  end: string;
  cutoff_time: string;
  summary: Summary;
  summary_calibrated: Summary;
  calibration_impact: {
    raw_mae_mw: number | null;
    calibrated_mae_mw: number | null;
    improvement_pct: number | null;
  };
  daily: DailyRow[];
  lead_time: LeadTimeRow[];
  histogram: HistogramBin[];
  histogram_calibrated: HistogramBin[];
  scatter: ScatterPoint[];
  worst_days: DailyRow[];
  best_days: DailyRow[];
  error_percentiles: ErrorPercentiles;
  calibrated_error_percentiles: ErrorPercentiles;
  cutoff_label: string;
}

export interface RevisionValue {
  start_time: string;
  forecast_mw: number | null;
}

export interface RevisionVintage {
  publish_time: string;
  available_at_cutoff: boolean;
  hours_covered: number;
  total_mwh: number | null;
  mean_mw: number | null;
  values: RevisionValue[];
}

export interface RevisionsBundle {
  delivery_date: string;
  cutoff: string;
  cutoff_time: string;
  latest_available_vintage: string | null;
  vintage_count: number;
  vintages: RevisionVintage[];
  selected_vintages: string[];
  cutoff_label: string;
}

export interface ProcurementPoint {
  start_time: string;
  raw_forecast_mw: number | null;
  forecast_mw: number | null;
  demand_mw: number | null;
  residual_mw: number | null;
  buffered_residual_mw: number | null;
  actual_mw: number | null;
  actual_residual_mw: number | null;
}

export interface ProcurementBundle {
  delivery_date: string;
  cutoff: string;
  cutoff_time: string;
  vintage: string | null;
  vintage_lag_minutes: number | null;
  demand_gw: number;
  calibrated: boolean;
  calibration: Calibration;
  buffer_mw: number;
  buffer_mw_override: boolean;
  summary: {
    demand_mwh: number | null;
    raw_forecast_wind_mwh: number | null;
    forecast_wind_mwh: number | null;
    residual_demand_mwh: number | null;
    peak_residual_mw: number | null;
    peak_residual_hour: string | null;
    buffered_residual_mwh: number | null;
  };
  series: ProcurementPoint[];
}
