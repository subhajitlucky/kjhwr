import { useState } from "react";
import type { HistogramBin } from "../../lib/types";
import { clamp, linearScale, niceTicks, tooltipX } from "./primitives";
import { useMeasure } from "../../lib/useMeasure";

const PAD = { top: 16, right: 12, bottom: 30, left: 38 };

export function ErrorHistogram({
  bins,
  height = 235,
}: {
  bins: HistogramBin[];
  height?: number;
}) {
  const { ref, width } = useMeasure<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);

  const valid = bins.filter(
    (bin) => bin.from_mw !== null && bin.to_mw !== null,
  );
  const w = Math.max(width, 300);
  const innerW = Math.max(w - PAD.left - PAD.right, 10);
  const innerH = Math.max(height - PAD.top - PAD.bottom, 10);

  if (!valid.length) {
    return (
      <div className="flex h-44 items-center justify-center text-sm text-muted">
        No error distribution available.
      </div>
    );
  }

  const from = valid[0].from_mw ?? 0;
  const to = valid[valid.length - 1].to_mw ?? 0;
  const maxCount = Math.max(...valid.map((bin) => bin.count));
  const y = linearScale([0, maxCount * 1.15], [PAD.top + innerH, PAD.top]);
  const ticks = niceTicks(0, maxCount * 1.15, 3);
  const barWidth = innerW / valid.length;
  const zero = from <= 0 && to >= 0 ? PAD.left + ((0 - from) / (to - from)) * innerW : null;

  return (
    <div ref={ref} className="relative w-full select-none" style={{ height }}>
      <svg
        width={w}
        height={height}
        role="img"
        aria-label="Distribution of hourly forecast error"
        onMouseLeave={() => setHover(null)}
      >
        {ticks.map((tick) => (
          <g key={tick}>
            <line
              x1={PAD.left}
              x2={PAD.left + innerW}
              y1={y(tick)}
              y2={y(tick)}
              stroke="rgba(255,255,255,0.045)"
              strokeDasharray="2 5"
            />
            <text
              x={PAD.left - 6}
              y={y(tick) + 3.5}
              textAnchor="end"
              className="fill-[#6f7d75] font-mono text-[9px]"
            >
              {Math.round(tick)}
            </text>
          </g>
        ))}

        {zero !== null && (
          <line
            x1={zero}
            x2={zero}
            y1={PAD.top}
            y2={PAD.top + innerH}
            stroke="rgba(238,242,233,0.3)"
            strokeDasharray="3 3"
          />
        )}

        {valid.map((bin, index) => {
          const center = ((bin.from_mw ?? 0) + (bin.to_mw ?? 0)) / 2;
          const color = center < 0 ? "#5fe3c0" : "#ffb45c";
          const x = PAD.left + index * barWidth;
          const barHeight = Math.max(0, PAD.top + innerH - y(bin.count));
          return (
            <g key={`${bin.from_mw}-${bin.to_mw}`}>
              <rect
                x={x + 1}
                y={PAD.top + innerH - barHeight}
                width={Math.max(barWidth - 2, 1)}
                height={barHeight}
                fill={color}
                opacity={hover === null || hover === index ? 0.82 : 0.3}
                rx={1.5}
                onMouseEnter={() => setHover(index)}
              />
            </g>
          );
        })}

        {[
          { value: from, label: `${(from / 1000).toFixed(1)}` },
          ...(zero !== null ? [{ value: 0, label: "0" }] : []),
          { value: to, label: `${(to / 1000).toFixed(1)}` },
        ].map((tick) => (
          <text
            key={`${tick.value}-${tick.label}`}
            x={PAD.left + ((tick.value - from) / (to - from || 1)) * innerW}
            y={height - 8}
            textAnchor="middle"
            className="fill-[#6f7d75] font-mono text-[9px]"
          >
            {tick.label}
          </text>
        ))}
        <text
          x={PAD.left + innerW}
          y={PAD.top - 4}
          textAnchor="end"
          className="fill-[#5f6d65] font-mono text-[8px] uppercase tracking-[0.14em]"
        >
          Count · GW bins
        </text>
      </svg>

      {hover !== null && valid[hover] && (
        <HistogramTip
          bin={valid[hover]}
          total={valid.reduce((sum, bin) => sum + bin.count, 0)}
          width={w}
          left={tooltipX(
            PAD.left + (hover + 0.5) * barWidth,
            w,
            190,
          )}
          top={4}
        />
      )}
    </div>
  );
}

function HistogramTip({
  bin,
  total,
  width,
  left,
  top,
}: {
  bin: HistogramBin;
  total: number;
  width: number;
  left: number;
  top: number;
}) {
  const share = total ? (bin.count / total) * 100 : 0;
  return (
    <div className="tooltip-card absolute z-20 p-3" style={{ width: 190, left, top }}>
      <div className="font-mono text-[10px] text-paper">
        {((bin.from_mw ?? 0) / 1000).toFixed(1)} to{" "}
        {((bin.to_mw ?? 0) / 1000).toFixed(1)} GW
      </div>
      <div className="mt-2 flex items-center justify-between text-[11px]">
        <span className="text-muted">Hours</span>
        <span className="num text-paper">{bin.count}</span>
      </div>
      <div className="mt-1 flex items-center justify-between text-[10px] text-muted">
        <span>Share</span>
        <span className="num">{share.toFixed(1)}%</span>
      </div>
    </div>
  );
}
