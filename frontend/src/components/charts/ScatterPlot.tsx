import type { ScatterPoint } from "../../lib/types";
import { useMeasure } from "../../lib/useMeasure";
import { clamp, linearScale, niceTicks } from "./primitives";

const PAD = { top: 18, right: 18, bottom: 34, left: 50 };

export function ScatterPlot({
  points,
  height = 300,
}: {
  points: ScatterPoint[];
  height?: number;
}) {
  const { ref, width } = useMeasure<HTMLDivElement>();
  const valid = points.filter(
    (point) =>
      typeof point.actual_mw === "number" &&
      typeof point.forecast_mw === "number",
  );
  const w = Math.max(width, 300);
  const available = Math.max(w - PAD.left - PAD.right, 10);
  const size = Math.min(available, Math.max(height - PAD.top - PAD.bottom, 10));
  const offsetX = PAD.left + Math.max(0, (available - size) / 2);
  const top = PAD.top;

  if (!valid.length) {
    return (
      <div className="flex h-44 items-center justify-center text-sm text-muted">
        No paired hours to plot.
      </div>
    );
  }

  const maxValue =
    Math.max(
      ...valid.flatMap((point) => [
        point.actual_mw as number,
        point.forecast_mw as number,
      ]),
    ) * 1.06;
  const x = linearScale([0, maxValue], [offsetX, offsetX + size]);
  const y = linearScale([0, maxValue], [top + size, top]);
  const ticks = niceTicks(0, maxValue, 4);

  return (
    <div ref={ref} className="relative w-full select-none" style={{ height }}>
      <svg
        width={w}
        height={height}
        role="img"
        aria-label="Forecast wind generation against actual wind generation"
      >
        {ticks.map((tick) => (
          <g key={tick}>
            <line
              x1={offsetX}
              x2={offsetX + size}
              y1={y(tick)}
              y2={y(tick)}
              stroke="rgba(255,255,255,0.045)"
              strokeDasharray="2 5"
            />
            <line
              x1={x(tick)}
              x2={x(tick)}
              y1={top}
              y2={top + size}
              stroke="rgba(255,255,255,0.03)"
            />
            <text
              x={offsetX - 7}
              y={y(tick) + 3.5}
              textAnchor="end"
              className="fill-[#6f7d75] font-mono text-[9px]"
            >
              {(tick / 1000).toFixed(1)}
            </text>
            <text
              x={x(tick)}
              y={top + size + 15}
              textAnchor="middle"
              className="fill-[#6f7d75] font-mono text-[9px]"
            >
              {(tick / 1000).toFixed(1)}
            </text>
          </g>
        ))}

        <line
          x1={x(0)}
          y1={y(0)}
          x2={x(maxValue)}
          y2={y(maxValue)}
          stroke="rgba(238,242,233,0.35)"
          strokeDasharray="4 4"
        />

        {valid.map((point, index) => {
          const high = (point.error_mw ?? 0) > 0;
          return (
            <circle
              key={index}
              cx={x(point.actual_mw as number)}
              cy={y(point.forecast_mw as number)}
              r={3}
              fill={high ? "#ffb45c" : "#5fe3c0"}
              opacity={0.48}
              stroke="rgba(7,11,10,0.7)"
              strokeWidth={0.6}
            >
              <title>
                {`Actual ${Math.round(point.actual_mw as number).toLocaleString("en-GB")} MW · Forecast ${Math.round(point.forecast_mw as number).toLocaleString("en-GB")} MW`}
              </title>
            </circle>
          );
        })}

        <text
          x={offsetX + size}
          y={top + size + 30}
          textAnchor="end"
          className="fill-[#8d9b92] font-mono text-[8.5px] uppercase tracking-[0.14em]"
        >
          Actual GW
        </text>
        <text
          x={offsetX - 7}
          y={top - 6}
          textAnchor="end"
          className="fill-[#8d9b92] font-mono text-[8.5px] uppercase tracking-[0.14em]"
        >
          Forecast GW
        </text>
      </svg>
    </div>
  );
}
