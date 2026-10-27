import { Info, SlidersHorizontal } from "lucide-react";
import type { ProcurementBundle } from "../lib/types";
import { fmtGw, fmtMwh, fmtMw, hourWithUnit } from "../lib/format";
import { Badge, EmptyState, ErrorBlock, LoadingBlock, Panel, Stat } from "./ui";

export function ProcurementPanel({
  data,
  loading,
  error,
  demandGw,
  onDemandChange,
  onRetry,
}: {
  data: ProcurementBundle | null;
  loading: boolean;
  error: string | null;
  demandGw: number;
  onDemandChange: (value: number) => void;
  onRetry: () => void;
}) {
  const progress = ((demandGw - 20) / 30) * 100;

  return (
    <Panel
      eyebrow="Procurement view"
      title="Sizing the thermal gap"
      subtitle="An operator demand assumption minus the bias-corrected wind forecast. The buffer is calibrated only on prior days."
      actions={<Badge tone="acid" dot>Bias-corrected</Badge>}
      bodyClassName="p-5"
    >
      {loading && !data ? (
        <LoadingBlock label="Sizing the gap" />
      ) : error && !data ? (
        <ErrorBlock message={error} onRetry={onRetry} />
      ) : !data ? (
        <EmptyState
          title="No procurement view"
          body="Pick a delivery day inside January 2026."
        />
      ) : (
        <ProcurementBody
          data={data}
          demandGw={demandGw}
          onDemandChange={onDemandChange}
          progress={progress}
        />
      )}
    </Panel>
  );
}

function ProcurementBody({
  data,
  demandGw,
  onDemandChange,
  progress,
}: {
  data: ProcurementBundle;
  demandGw: number;
  onDemandChange: (value: number) => void;
  progress: number;
}) {
  const demand = data.summary.demand_mwh ?? 0;
  const wind = data.summary.forecast_wind_mwh ?? 0;
  const bufferMwh = data.buffer_mw * 24;
  const residual = data.summary.residual_demand_mwh ?? 0;
  const buffered = data.summary.buffered_residual_mwh ?? 0;
  const windShare = demand ? Math.max(0, Math.min(100, (wind / demand) * 100)) : 0;
  const bufferShare = demand ? Math.max(0, Math.min(100, (bufferMwh / demand) * 100)) : 0;
  const thermalShare = Math.max(0, 100 - windShare - bufferShare);

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-end justify-between gap-4">
          <div>
            <div className="eyebrow">Demand assumption</div>
            <div className="mt-1 flex items-baseline gap-1.5">
              <span className="num text-3xl font-medium tracking-[-0.04em]">
                {demandGw.toFixed(1)}
              </span>
              <span className="text-[11px] text-muted">GW flat</span>
            </div>
          </div>
          <div className="text-right">
            <div className="eyebrow">Wind covers</div>
            <div className="num mt-1 text-lg text-acid">
              {((wind / demand) * 100).toFixed(1)}%
            </div>
          </div>
        </div>

        <input
          className="range mt-5 w-full"
          style={{ "--range-progress": `${progress}%` } as React.CSSProperties}
          type="range"
          min={20}
          max={50}
          step={0.5}
          value={demandGw}
          aria-label="Demand assumption in gigawatts"
          onChange={(event) => onDemandChange(Number(event.target.value))}
        />
        <div className="mt-2 flex justify-between font-mono text-[9px] text-faint">
          <span>20 GW</span>
          <span className="flex items-center gap-1 text-muted">
            <SlidersHorizontal className="h-2.5 w-2.5" /> illustrative only
          </span>
          <span>50 GW</span>
        </div>
      </div>

      <div>
        <div className="flex h-3.5 overflow-hidden rounded-full border border-edge bg-panel2">
          <div
            className="h-full bg-acid/80"
            style={{ width: `${windShare}%` }}
            title={`Wind ${fmtMwh(wind)}`}
          />
          <div
            className="h-full border-l border-ink/50 bg-ember/45"
            style={{ width: `${bufferShare}%` }}
            title={`P90 buffer ${fmtMw(data.buffer_mw)}`}
          />
          <div className="h-full flex-1 bg-coral/20" style={{ width: `${thermalShare}%` }} />
        </div>
        <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[10px] text-muted">
          <LegendSwatch color="bg-acid" label="Wind" value={fmtMwh(wind)} />
          <LegendSwatch color="bg-ember/60" label="P90 buffer" value={fmtMw(data.buffer_mw)} />
          <LegendSwatch color="bg-coral/30" label="Thermal" value={fmtMwh(residual)} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-edge bg-panel2/50 p-3.5">
          <div className="eyebrow">Residual</div>
          <div className="num mt-1.5 text-xl">{fmtMwh(residual)}</div>
          <div className="mt-1 text-[10px] text-muted">before buffer</div>
        </div>
        <div className="rounded-xl border border-edge bg-panel2/50 p-3.5">
          <div className="eyebrow">After buffer</div>
          <div className="num mt-1.5 text-xl text-acid">{fmtMwh(buffered)}</div>
          <div className="mt-1 text-[10px] text-muted">thermal to secure</div>
        </div>
      </div>

      <div>
        <Stat
          label="Peak residual hour"
          value={
            data.summary.peak_residual_hour
              ? `${hourWithUnit(data.summary.peak_residual_hour)} · ${fmtGw(data.summary.peak_residual_mw)}`
              : "—"
          }
        />
        <Stat
          label="Buffer calibration"
          value={`${data.calibration.matched_hours} prior hrs · ${data.calibration.confidence}`}
          tone={data.calibration.confidence === "high" ? "mint" : "ember"}
        />
        <Stat
          label="Forecast vintage"
          value={
            data.vintage
              ? `${data.vintage.slice(11, 16)} UTC · ${data.vintage.slice(8, 10)} Jan`
              : "—"
          }
        />
      </div>

      <p className="flex gap-2 text-[10px] leading-relaxed text-faint">
        <Info className="mt-0.5 h-3 w-3 shrink-0" />
        <span>
          Residual = demand − wind. The buffer is the P90 absolute error of the
          trailing 14 days, measured after bias correction. Demand is not part of
          the Elexon dataset; it is a transparent operator assumption.
        </span>
      </p>
    </div>
  );
}

function LegendSwatch({
  color,
  label,
  value,
}: {
  color: string;
  label: string;
  value: string;
}) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`h-2 w-2 rounded-sm ${color}`} />
      <span>{label}</span>
      <span className="num text-paper/80">{value}</span>
    </span>
  );
}
