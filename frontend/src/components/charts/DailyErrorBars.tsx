import { useState } from "react";
import type { DailyRow } from "../../lib/types";
import { dateShort, fmtMw, fmtSignedMw } from "../../lib/format";
import { useMeasure } from "../../lib/useMeasure";
import { clamp, linearScale, niceTicks, tooltipX } from "./primitives";

const PAD = { top: 16, right: 12, bottom: 30, left: 46 };

export function DailyErrorBars({
  rows,
  height = 250,
}: {
  rows: DailyRow[];
  height?: number;
}) {
  const { ref, width } = useMeasure<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);

  const valid = rows.filter(
    (row) => row.mae_mw !== null || row.mae_calibrated_mw !== null,
  );
  const w = Math.max(width, 320);
  const innerW = Math.max(w - PAD.left - PAD.right, 10);
  const innerH = Math.max(height - PAD.top - PAD.bottom, 10);

  if (!valid.length) {
    return (
      <div className="flex h-44 items-center justify-center text-sm text-muted">
        No matched forecast hours in this window.
      </div>
    );
  }

  const maxValue = Math.max(
    ...valid.flatMap((row) => [row.mae_mw ?? 0, row.mae_calibrated_mw ?? 0]),
  );
  const y = linearScale([0, maxValue * 1.12], [PAD.top + innerH, PAD.top]);
  const ticks = niceTicks(0, maxValue * 1.12, 4);
  const groupWidth = innerW / valid.length;
  const barWidth = Math.max(2.5, Math.min(groupWidth * 0.28, 13));

  const hovered = hover !== null ? valid[hover] : null;
  const tooltipWidth = 214;

  return (
    <div ref={ref} className="relative w-full select-none" style={{ height }}>
      <svg
        width={w}
        height={height}
        role="img"
        aria-label="Daily mean absolute forecast error"
        onMouseLeave={() => setHover(null)}
      >
        {ticks.map((tick) => (
          <g key={tick}>
            <line
              x1={PAD.left}
              x2={PAD.left + innerW}
              y1={y(tick)}
              y2={y(tick)}
              stroke="rgba(255,255,255,0.05)"
              strokeDasharray="2 5"
            />
            <text
              x={PAD.left - 8}
              y={y(tick) + 3.5}
              textAnchor="end"
              className="fill-[#6f7d75] font-mono text-[9px]"
            >
              {(tick / 1000).toFixed(1)}
            </text>
          </g>
        ))}
        <text
          x={PAD.left - 8}
          y={PAD.top - 5}
          textAnchor="end"
          className="fill-[#5f6d65] font-mono text-[8px] uppercase tracking-[0.14em]"
        >
          GW
        </text>

        {valid.map((row, index) => {
          const center = PAD.left + index * groupWidth + groupWidth / 2;
          const rawHeight = Math.max(0, PAD.top + innerH - y(row.mae_mw ?? 0));
          const calibratedHeight = Math.max(
            0,
            PAD.top + innerH - y(row.mae_calibrated_mw ?? 0),
          );
          return (
            <g key={row.date}>
              <rect
                x={center - barWidth - 1}
                y={PAD.top + innerH - rawHeight}
                width={barWidth}
                height={rawHeight}
                rx={1.5}
                fill="#ffb45c"
                opacity={hover === null || hover === index ? 0.8 : 0.32}
              />
              <rect
                x={center + 1}
                y={PAD.top + innerH - calibratedHeight}
                width={barWidth}
                height={calibratedHeight}
                rx={1.5}
                fill="#c8f45a"
                opacity={hover === null || hover === index ? 0.9 : 0.32}
              />
              <rect
                x={center - groupWidth / 2}
                y={PAD.top}
                width={groupWidth}
                height={innerH}
                fill="transparent"
                onMouseEnter={() => setHover(index)}
              />
              {(index % 5 === 0 || index === valid.length - 1) && (
                <text
                  x={center}
                  y={height - 8}
                  textAnchor="middle"
                  className="fill-[#6f7d75] font-mono text-[9px]"
                >
                  {dateShort(row.date).replace(" ", "\u00a0")}
                </text>
              )}
            </g>
          );
        })}
      </svg>

      {hovered && hover !== null && (
        <div
          className="tooltip-card absolute z-20 p-3"
          style={{
            width: tooltipWidth,
            left: tooltipX(
              PAD.left + hover * groupWidth + groupWidth / 2,
              w,
              tooltipWidth,
            ),
            top: 4,
          }}
        >
          <div className="font-mono text-[10px] text-paper">
            {dateShort(hovered.date)}
          </div>
          <div className="mt-2 space-y-1.5 text-[11px]">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-muted">
                <span className="h-2 w-2 rounded-sm bg-ember" /> Raw
              </span>
              <span className="num text-[10.5px] text-paper">
                {fmtMw(hovered.mae_mw)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-muted">
                <span className="h-2 w-2 rounded-sm bg-acid" /> Calibrated
              </span>
              <span className="num text-[10.5px] text-paper">
                {fmtMw(hovered.mae_calibrated_mw)}
              </span>
            </div>
            <div className="flex items-center justify-between border-t border-edge pt-1.5 text-[10.5px] text-muted">
              <span>Bias</span>
              <span className="num text-ember">{fmtSignedMw(hovered.bias_mw)}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
