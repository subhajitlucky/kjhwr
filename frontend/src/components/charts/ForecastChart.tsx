import { useState } from "react";
import type { HourPoint } from "../../lib/types";
import { hourLabel, hourWithUnit, fmtSignedMw } from "../../lib/format";
import { useMeasure } from "../../lib/useMeasure";
import {
  bandPath,
  clamp,
  isNum,
  linearScale,
  niceDomain,
  niceTicks,
  pathFrom,
  tooltipX,
} from "./primitives";

const PAD = { top: 18, right: 16, bottom: 30, left: 56 };

export function ForecastChart({
  data,
  calibrated,
  height = 360,
}: {
  data: HourPoint[];
  calibrated: boolean;
  height?: number;
}) {
  const { ref, width } = useMeasure<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);

  const w = Math.max(width, 320);
  const innerW = Math.max(w - PAD.left - PAD.right, 10);
  const innerH = Math.max(height - PAD.top - PAD.bottom, 10);

  const actual = data.map((point) => point.actual_mw);
  const forecast = data.map((point) => point.forecast_mw);
  const raw = data.map((point) => point.raw_forecast_mw);

  const yValues = [...actual, ...forecast, ...(calibrated ? raw : [])].filter(isNum);
  const [low, high] = niceDomain(yValues, 0.1);
  const ticks = niceTicks(low, high, 4);
  const y = linearScale([low, high], [PAD.top + innerH, PAD.top]);
  const x = (index: number) =>
    PAD.left + (data.length <= 1 ? innerW / 2 : (index / (data.length - 1)) * innerW);

  const xTickIndexes = (
    w < 560
      ? [0, 6, 12, 18, 23]
      : [0, 3, 6, 9, 12, 15, 18, 21, 23]
  ).filter((index) => index < data.length);

  if (!data.length) {
    return (
      <div className="flex h-44 items-center justify-center text-sm text-muted">
        No hourly forecast available for this day.
      </div>
    );
  }

  const hovered = hover !== null ? data[hover] : null;
  const tooltipWidth = 228;

  return (
    <div ref={ref} className="relative w-full select-none" style={{ height }}>
      <svg
        width={w}
        height={height}
        role="img"
        aria-label="Hourly wind forecast versus actual generation"
        onMouseMove={(event) => {
          const rect = event.currentTarget.getBoundingClientRect();
          const mouseX = (event.clientX - rect.left) * (w / rect.width);
          const index = Math.round(((mouseX - PAD.left) / innerW) * (data.length - 1));
          setHover(clamp(index, 0, data.length - 1));
        }}
        onMouseLeave={() => setHover(null)}
      >
        <defs>
          <linearGradient id="error-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--chart-raw)" stopOpacity="0.2" />
            <stop offset="100%" stopColor="var(--chart-raw)" stopOpacity="0.02" />
          </linearGradient>
        </defs>

        {ticks.map((tick) => (
          <g key={tick}>
            <line
              x1={PAD.left}
              x2={PAD.left + innerW}
              y1={y(tick)}
              y2={y(tick)}
              stroke="var(--chart-grid)"
              strokeDasharray={tick === 0 ? undefined : "2 5"}
            />
            <text
              x={PAD.left - 10}
              y={y(tick) + 3.5}
              textAnchor="end"
              className="fill-[var(--chart-axis)] font-mono text-[9.5px]"
            >
              {(tick / 1000).toFixed(1)}
            </text>
          </g>
        ))}

        <text
          x={PAD.left - 10}
          y={PAD.top - 8}
          textAnchor="end"
          className="fill-[var(--chart-axis-dim)] font-mono text-[8.5px] uppercase tracking-[0.14em]"
        >
          GW
        </text>

        {xTickIndexes.map((index) => (
          <g key={index}>
            <line
              x1={x(index)}
              x2={x(index)}
              y1={PAD.top}
              y2={PAD.top + innerH}
              stroke="var(--chart-grid)"
            />
            <text
              x={x(index)}
              y={height - 8}
              textAnchor="middle"
              className="fill-[var(--chart-axis)] font-mono text-[9.5px]"
            >
              {hourLabel(data[index]?.start_time)}
            </text>
          </g>
        ))}

        <path
          d={bandPath(forecast, actual, x, y)}
          fill="url(#error-fill)"
          stroke="none"
        />

        {calibrated && (
          <path
            d={pathFrom(raw, x, y)}
            className="chart-line"
            stroke="var(--chart-raw)"
            strokeWidth={1.4}
            strokeDasharray="4 4"
            opacity={0.75}
          />
        )}

        <path
          d={pathFrom(actual, x, y)}
          className="chart-line"
          stroke="var(--chart-actual)"
          strokeWidth={2.2}
        />
        <path
          d={pathFrom(forecast, x, y)}
          className="chart-line"
          stroke="var(--chart-forecast)"
          strokeWidth={2.4}
        />

        {hovered && hover !== null && (
          <g>
            <line
              x1={x(hover)}
              x2={x(hover)}
              y1={PAD.top}
              y2={PAD.top + innerH}
              stroke="var(--chart-crosshair)"
              strokeDasharray="3 3"
            />
            {isNum(hovered.raw_forecast_mw) && calibrated && (
              <circle
                cx={x(hover)}
                cy={y(hovered.raw_forecast_mw)}
                r={3.2}
                fill="var(--chart-dot-bg)"
                stroke="var(--chart-raw)"
                strokeWidth={1.4}
              />
            )}
            {isNum(hovered.forecast_mw) && (
              <circle
                cx={x(hover)}
                cy={y(hovered.forecast_mw)}
                r={4}
                fill="var(--chart-dot-bg)"
                stroke="var(--chart-forecast)"
                strokeWidth={2}
              />
            )}
            {isNum(hovered.actual_mw) && (
              <circle
                cx={x(hover)}
                cy={y(hovered.actual_mw)}
                r={4}
                fill="var(--chart-dot-bg)"
                stroke="var(--chart-actual)"
                strokeWidth={2}
              />
            )}
          </g>
        )}

        <rect
          x={PAD.left}
          y={PAD.top}
          width={innerW}
          height={innerH}
          fill="transparent"
        />
      </svg>

      {hovered && hover !== null && (
        <div
          className="tooltip-card absolute z-20 p-3"
          style={{
            width: tooltipWidth,
            left: tooltipX(x(hover), w, tooltipWidth),
            top: 8,
          }}
        >
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10px] text-paper">
              {hourWithUnit(hovered.start_time)}
            </span>
            <span className="eyebrow">Hourly</span>
          </div>
          <div className="mt-2 space-y-1.5 text-[11px]">
            {calibrated && (
              <TooltipRow
                color="var(--chart-raw)"
                label="Raw WINDFOR"
                value={`${Math.round(hovered.raw_forecast_mw ?? 0).toLocaleString("en-GB")} MW`}
                dashed
              />
            )}
            <TooltipRow
              color="var(--chart-forecast)"
              label={calibrated ? "Calibrated" : "Forecast"}
              value={`${Math.round(hovered.forecast_mw ?? 0).toLocaleString("en-GB")} MW`}
            />
            <TooltipRow
              color="var(--chart-actual)"
              label="Actual"
              value={`${Math.round(hovered.actual_mw ?? 0).toLocaleString("en-GB")} MW`}
            />
            <div className="flex items-center justify-between border-t border-edge pt-1.5 text-[10.5px] text-muted">
              <span>Error</span>
              <span className="num text-ember">{fmtSignedMw(hovered.error_mw)}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function TooltipRow({
  color,
  label,
  value,
  dashed = false,
}: {
  color: string;
  label: string;
  value: string;
  dashed?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="flex items-center gap-1.5 text-muted">
        <span
          className="inline-block h-0 w-3.5 border-t-2"
          style={{ borderColor: color, borderStyle: dashed ? "dashed" : "solid" }}
        />
        {label}
      </span>
      <span className="num text-[10.5px] text-paper">{value}</span>
    </div>
  );
}
