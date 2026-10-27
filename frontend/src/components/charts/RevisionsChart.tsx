import { useState } from "react";
import type { HourPoint, RevisionVintage } from "../../lib/types";
import { hourLabel, hourWithUnit } from "../../lib/format";
import { useMeasure } from "../../lib/useMeasure";
import {
  clamp,
  isNum,
  linearScale,
  niceDomain,
  niceTicks,
  pathFrom,
  tooltipX,
} from "./primitives";

const PAD = { top: 16, right: 16, bottom: 28, left: 54 };

export function RevisionsChart({
  vintages,
  actual,
  selectedVintage,
  height = 300,
}: {
  vintages: RevisionVintage[];
  actual: HourPoint[];
  selectedVintage: string | null;
  height?: number;
}) {
  const { ref, width } = useMeasure<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);

  const slots = actual.length
    ? actual.map((point) => point.start_time)
    : Array.from(
        new Set(vintages.flatMap((vintage) => vintage.values.map((value) => value.start_time))),
      ).sort();

  const w = Math.max(width, 320);
  const innerW = Math.max(w - PAD.left - PAD.right, 10);
  const innerH = Math.max(height - PAD.top - PAD.bottom, 10);

  const aligned = vintages.map((vintage) => {
    const byTime = new Map(vintage.values.map((value) => [value.start_time, value.forecast_mw]));
    return {
      ...vintage,
      aligned: slots.map((slot) => byTime.get(slot) ?? null),
    };
  });

  const yValues = [
    ...actual.map((point) => point.actual_mw),
    ...aligned.flatMap((vintage) => vintage.aligned),
  ].filter(isNum);
  const [low, high] = niceDomain(yValues, 0.1);
  const ticks = niceTicks(low, high, 4);
  const y = linearScale([low, high], [PAD.top + innerH, PAD.top]);
  const x = (index: number) =>
    PAD.left + (slots.length <= 1 ? innerW / 2 : (index / (slots.length - 1)) * innerW);

  if (!slots.length) {
    return (
      <div className="flex h-44 items-center justify-center text-sm text-muted">
        No forecast revisions available for this day.
      </div>
    );
  }

  const selected = aligned.find(
    (vintage) => vintage.publish_time === selectedVintage,
  );
  const hoveredSlot = hover !== null ? slots[hover] : null;
  const hoveredActual =
    hover !== null ? actual.find((point) => point.start_time === hoveredSlot) : null;
  const tooltipWidth = 220;

  return (
    <div ref={ref} className="relative w-full select-none" style={{ height }}>
      <svg
        width={w}
        height={height}
        role="img"
        aria-label="Forecast revisions for the delivery day"
        onMouseMove={(event) => {
          const rect = event.currentTarget.getBoundingClientRect();
          const mouseX = (event.clientX - rect.left) * (w / rect.width);
          const index = Math.round(((mouseX - PAD.left) / innerW) * (slots.length - 1));
          setHover(clamp(index, 0, slots.length - 1));
        }}
        onMouseLeave={() => setHover(null)}
      >
        {ticks.map((tick) => (
          <g key={tick}>
            <line
              x1={PAD.left}
              x2={PAD.left + innerW}
              y1={y(tick)}
              y2={y(tick)}
              stroke="var(--chart-grid)"
              strokeDasharray="2 5"
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
          y={PAD.top - 6}
          textAnchor="end"
          className="fill-[var(--chart-axis-dim)] font-mono text-[8.5px] uppercase tracking-[0.14em]"
        >
          GW
        </text>

        {[0, 6, 12, 18, 23]
          .filter((index) => index < slots.length)
          .map((index) => (
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
                {hourLabel(slots[index])}
              </text>
            </g>
          ))}

        {aligned
          .filter(
            (vintage) =>
              vintage.available_at_cutoff &&
              vintage.publish_time !== selectedVintage,
          )
          .map((vintage) => (
            <path
              key={vintage.publish_time}
              d={pathFrom(vintage.aligned, x, y)}
              className="chart-line"
              stroke="var(--chart-muted)"
              strokeWidth={1}
              opacity={0.24}
            />
          ))}

        {aligned
          .filter((vintage) => !vintage.available_at_cutoff)
          .map((vintage) => (
            <path
              key={vintage.publish_time}
              d={pathFrom(vintage.aligned, x, y)}
              className="chart-line"
              stroke="var(--chart-late)"
              strokeWidth={1.15}
              strokeDasharray="3 4"
              opacity={0.5}
            />
          ))}

        <path
          d={pathFrom(actual.map((point) => point.actual_mw), x, y)}
          className="chart-line"
          stroke="var(--chart-actual)"
          strokeWidth={2}
          opacity={0.9}
        />

        {selected && (
          <path
            d={pathFrom(selected.aligned, x, y)}
            className="chart-line"
            stroke="var(--chart-forecast)"
            strokeWidth={2.6}
          />
        )}

        {hover !== null && hoveredSlot && (
          <g>
            <line
              x1={x(hover)}
              x2={x(hover)}
              y1={PAD.top}
              y2={PAD.top + innerH}
              stroke="var(--chart-crosshair)"
              strokeDasharray="3 3"
            />
            {hoveredActual && isNum(hoveredActual.actual_mw) && (
              <circle
                cx={x(hover)}
                cy={y(hoveredActual.actual_mw)}
                r={3.6}
                fill="var(--chart-dot-bg)"
                stroke="var(--chart-actual)"
                strokeWidth={1.8}
              />
            )}
            {selected && isNum(selected.aligned[hover]) && (
              <circle
                cx={x(hover)}
                cy={y(selected.aligned[hover] as number)}
                r={3.8}
                fill="var(--chart-dot-bg)"
                stroke="var(--chart-forecast)"
                strokeWidth={1.8}
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

      {hover !== null && hoveredSlot && (
        <div
          className="tooltip-card absolute z-20 p-3"
          style={{
            width: tooltipWidth,
            left: tooltipX(x(hover), w, tooltipWidth),
            top: 6,
          }}
        >
          <div className="font-mono text-[10px] text-paper">
            {hourWithUnit(hoveredSlot)}
          </div>
          <div className="mt-2 space-y-1.5 text-[11px]">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-muted">
                <span className="inline-block h-0 w-3.5 border-t-2 border-[var(--chart-actual)]" />
                Actual
              </span>
              <span className="num text-[10.5px] text-paper">
                {hoveredActual?.actual_mw !== null && hoveredActual?.actual_mw !== undefined
                  ? `${Math.round(hoveredActual.actual_mw).toLocaleString("en-GB")} MW`
                  : "—"}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-muted">
                <span className="inline-block h-0 w-3.5 border-t-2 border-[var(--chart-forecast)]" />
                Used vintage
              </span>
              <span className="num text-[10.5px] text-paper">
                {selected && isNum(selected.aligned[hover])
                  ? `${Math.round(selected.aligned[hover] as number).toLocaleString("en-GB")} MW`
                  : "—"}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
