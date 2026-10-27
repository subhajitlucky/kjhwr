import {
  ArrowUpRight,
  BarChart3,
  CheckCircle2,
  Info,
  Percent,
  Target,
  TrendingUp,
} from "lucide-react";
import { Link } from "react-router-dom";
import { api, accuracyCsvUrl } from "../lib/api";
import { useApi } from "../lib/useApi";
import { useAppState } from "../context/AppState";
import type { AccuracyBundle } from "../lib/types";
import {
  dateShort,
  fmtGw,
  fmtInt,
  fmtMw,
  fmtPct,
  fmtSignedMw,
  vintageLabel,
} from "../lib/format";
import {
  ActionLink,
  Badge,
  EmptyState,
  ErrorBlock,
  Kpi,
  LegendItem,
  LoadingBlock,
  PageHeader,
  Panel,
  Select,
} from "../components/ui";
import { DailyErrorBars } from "../components/charts/DailyErrorBars";
import { ErrorHistogram } from "../components/charts/ErrorHistogram";
import { ScatterPlot } from "../components/charts/ScatterPlot";

export function AccuracyPage() {
  const { cutoff, setCutoff, cutoffOptions, meta } = useAppState();
  const start = meta?.analysis_start ?? "2026-01-01";
  const end = meta?.analysis_end ?? "2026-02-01";

  const state = useApi<AccuracyBundle>(
    `accuracy:${start}:${end}:${cutoff}`,
    (signal) => api.accuracy({ start, end, cutoff }, signal),
  );

  const data = state.data;

  return (
    <>
      <PageHeader
        eyebrow="Forecast accuracy · January 2026"
        title={
          <>
            How wrong is the forecast?{" "}
            <span className="italic text-acid">Quantified.</span>
          </>
        }
        description="Every matched hour of the month, measured against FUELHH transmission wind. Raw WINDFOR is the published forecast; the calibrated view removes only the bias visible before the delivery day."
        actions={
          <>
            <Select
              label="Cut-off"
              value={cutoff}
              ariaLabel="Decision cut-off time"
              options={cutoffOptions.map((time) => ({
                value: time,
                label: time === "09:15" ? `${time} · gate closure` : `${time} UTC`,
              }))}
              onChange={setCutoff}
            />
            <ActionLink href={accuracyCsvUrl(start, end, cutoff)} download icon={null}>
              Export CSV
            </ActionLink>
          </>
        }
      />

      {state.loading && !data ? (
        <Panel bodyClassName="p-0">
          <LoadingBlock label="Scoring every hour" />
        </Panel>
      ) : state.error && !data ? (
        <Panel bodyClassName="p-0">
          <ErrorBlock message={state.error} onRetry={state.reload} />
        </Panel>
      ) : data ? (
        <AccuracyBody data={data} cutoff={cutoff} />
      ) : (
        <Panel bodyClassName="p-0">
          <EmptyState title="No accuracy data" body="No matched hours in this window." />
        </Panel>
      )}
    </>
  );
}

function AccuracyBody({ data, cutoff }: { data: AccuracyBundle; cutoff: string }) {
  const summary = data.summary;
  const calibrated = data.summary_calibrated;
  const impact = data.calibration_impact;
  const improvement = impact.improvement_pct ?? 0;

  return (
    <div className="animate-rise space-y-4">
      <section className="panel relative overflow-hidden p-5 lg:p-6">
        <div className="grid-lines pointer-events-none absolute inset-0 opacity-40" />
        <div className="relative grid gap-6 lg:grid-cols-[1.3fr_1fr] lg:items-center">
          <div>
            <Badge tone="acid" dot>
              Calibration impact
            </Badge>
            <h2 className="mt-3 max-w-xl font-serif text-[clamp(1.6rem,2.4vw,2.2rem)] leading-[1.02]">
              The raw series runs high. The correction is{" "}
              <span className="italic text-acid">earned</span>, not assumed.
            </h2>
            <p className="mt-3 max-w-xl text-[12px] leading-relaxed text-muted">
              WINDFOR carries a{" "}
              <span className="text-ember">{fmtSignedMw(summary.bias_mw)}</span>{" "}
              mean bias against FUELHH transmission wind in January 2026. A
              trailing 14-day correction — using only errors visible before each
              delivery day — cuts mean absolute error by{" "}
              <span className="text-acid">{fmtPct(improvement)}</span>. The
              dispersion remains; the bias does not.
            </p>
            <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-[10px] text-faint">
              <span>Cut-off {cutoff} UTC</span>
              <span>{summary.matched_hours} matched hours</span>
              <span>{data.daily.length} delivery days</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-edge bg-panel2/60 p-4">
              <div className="eyebrow">Raw MAE</div>
              <div className="num mt-2 text-2xl text-ember">
                {fmtMw(impact.raw_mae_mw)}
              </div>
              <div className="mt-1 text-[10px] text-muted">published WINDFOR</div>
            </div>
            <div className="rounded-xl border border-acid/20 bg-acid/[0.04] p-4">
              <div className="eyebrow text-acid/80">Calibrated MAE</div>
              <div className="num mt-2 text-2xl text-acid">
                {fmtMw(impact.calibrated_mae_mw)}
              </div>
              <div className="mt-1 text-[10px] text-muted">trailing-bias corrected</div>
            </div>
            <div className="col-span-2 rounded-xl border border-edge bg-panel2/40 p-3">
              <div className="flex items-center justify-between text-[10px] text-muted">
                <span>Error reduction</span>
                <span className="num text-acid">−{fmtPct(improvement)}</span>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-edge">
                <div
                  className="h-full rounded-full bg-acid"
                  style={{ width: `${Math.max(2, Math.min(100, improvement))}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
        <Kpi
          label="MAE"
          value={fmtGw(summary.mae_mw)}
          icon={Target}
          tone="ember"
          dense
          sub={`Calibrated ${fmtGw(calibrated.mae_mw)}`}
        />
        <Kpi
          label="RMSE"
          value={fmtGw(summary.rmse_mw)}
          icon={BarChart3}
          tone="coral"
          dense
          sub="Penalises large misses"
        />
        <Kpi
          label="Bias"
          value={fmtSignedMw(summary.bias_mw)}
          icon={TrendingUp}
          tone="ember"
          dense
          sub="Forecast minus actual"
        />
        <Kpi
          label="P90 abs. error"
          value={fmtGw(summary.p90_abs_error_mw)}
          icon={Target}
          tone="sky"
          dense
          sub={`Calibrated ${fmtGw(calibrated.p90_abs_error_mw)}`}
        />
        <Kpi
          label="MAPE"
          value={fmtPct(summary.mape_pct)}
          icon={Percent}
          tone="mint"
          dense
          sub="Hours above 500 MW"
        />
        <Kpi
          label="Coverage"
          value={fmtPct(summary.coverage_pct, 0)}
          icon={CheckCircle2}
          tone="acid"
          dense
          sub={`${summary.matched_hours}/${summary.hours} hours`}
        />
      </div>

      <Panel
        eyebrow="Error over time"
        title="Daily forecast error"
        subtitle="Mean absolute error per delivery day. Raw WINDFOR in amber; trailing bias-corrected in acid. The correction is as-of each day, never fitted on the day it scores."
        actions={
          <div className="flex items-center gap-3">
            <LegendItem color="#ffb45c" label="Raw" />
            <LegendItem color="#c8f45a" label="Calibrated" />
          </div>
        }
        bodyClassName="px-2 pb-2 pt-1"
      >
        <DailyErrorBars rows={data.daily} height={260} />
      </Panel>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Panel
          eyebrow="Distribution"
          title="Where the misses live"
          subtitle="Signed hourly error. Negative means the forecast under-called wind; positive means it over-called."
          bodyClassName="px-2 pb-2 pt-1"
        >
          <ErrorHistogram bins={data.histogram} height={246} />
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 px-4 pb-2 text-[10px] text-muted">
            <span>
              P10{" "}
              <span className="num text-mint">
                {fmtSignedMw(data.error_percentiles.p10_signed_mw)}
              </span>
            </span>
            <span>
              Median{" "}
              <span className="num text-ember">
                {fmtSignedMw(data.error_percentiles.p50_signed_mw)}
              </span>
            </span>
            <span>
              P90{" "}
              <span className="num text-ember">
                {fmtSignedMw(data.error_percentiles.p90_signed_mw)}
              </span>
            </span>
          </div>
        </Panel>

        <Panel
          eyebrow="Forecast horizon"
          title="Error by lead time"
          subtitle="Lead is the delivery hour minus the publication time. Day-ahead gate closure leaves roughly 16–40 hours of horizon."
          bodyClassName="p-5"
        >
          <LeadTimeBars data={data} />
        </Panel>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Panel
          eyebrow="Paired hours"
          title="Forecast vs actual"
          subtitle="Each dot is an hour. Above the diagonal means the forecast was high; below means it was low."
          actions={
            <div className="flex items-center gap-3">
              <LegendItem color="#ffb45c" label="High" />
              <LegendItem color="#5fe3c0" label="Low" />
            </div>
          }
          bodyClassName="px-2 pb-2 pt-1"
        >
          <ScatterPlot points={data.scatter} height={330} />
        </Panel>

        <Panel
          eyebrow="Audit"
          title="The five worst days"
          subtitle="Ranked by raw mean absolute error. Each row opens the decision view for that delivery day."
          bodyClassName="p-0"
        >
          <div className="divide-y divide-edge/70">
            {data.worst_days.map((row, index) => (
              <Link
                key={row.date}
                to={`/?date=${row.date}&cutoff=${cutoff}`}
                className="group flex items-center gap-4 px-5 py-3.5 transition-colors hover:bg-white/[0.02]"
              >
                <span className="num w-6 text-[10px] text-faint">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-[12px] text-paper">
                    {dateShort(row.date)}
                  </div>
                  <div className="mt-0.5 truncate font-mono text-[9px] text-faint">
                    {vintageLabel(row.vintage)} · {row.coverage_pct ?? "—"}% covered
                  </div>
                </div>
                <div className="text-right">
                  <div className="num text-[12px] text-ember">
                    {fmtMw(row.mae_mw)}
                  </div>
                  <div className="mt-0.5 text-[9px] text-muted">
                    cal. {fmtMw(row.mae_calibrated_mw)}
                  </div>
                </div>
                <ArrowUpRight className="h-3.5 w-3.5 text-faint transition-colors group-hover:text-acid" />
              </Link>
            ))}
          </div>
          <div className="flex items-center gap-2 border-t border-edge px-5 py-3 text-[10px] text-faint">
            <Info className="h-3 w-3" />
            Worst-day ranking uses the raw published forecast, not the calibrated
            view.
          </div>
        </Panel>
      </div>

      <Panel
        eyebrow="Evidence"
        title="Daily ledger"
        subtitle="The full month behind the charts: vintage, coverage, raw error, calibrated error and bias."
        actions={
          <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-faint">
            {data.daily.length} days · {summary.matched_hours} hours
          </span>
        }
        bodyClassName="p-0"
      >
        <div className="relative">
          <div className="scroll-thin max-h-[360px] overflow-auto">
            <table className="w-full border-collapse text-left">
            <thead className="sticky top-0 z-10 bg-panel/95 backdrop-blur">
              <tr className="border-b border-edge text-[9px] uppercase tracking-[0.12em] text-faint">
                <th className="py-2.5 pl-5 pr-2 font-medium">Day</th>
                <th className="px-2 py-2.5 font-medium">Vintage</th>
                <th className="px-2 py-2.5 text-right font-medium">Raw MAE</th>
                <th className="px-2 py-2.5 text-right font-medium">Cal. MAE</th>
                <th className="px-2 py-2.5 text-right font-medium">Bias</th>
                <th className="hidden px-2 py-2.5 text-right font-medium sm:table-cell">
                  Coverage
                </th>
                <th className="hidden px-2 py-2.5 pr-5 text-right font-medium md:table-cell">
                  Forecast
                </th>
              </tr>
            </thead>
            <tbody>
              {data.daily.map((row) => (
                <tr
                  key={row.date}
                  className="border-b border-edge/50 transition-colors last:border-0 hover:bg-white/[0.02]"
                >
                  <td className="py-2 pl-5 pr-2 text-[11px] text-paper">
                    {dateShort(row.date)}
                  </td>
                  <td className="num px-2 py-2 text-[10px] text-faint">
                    {row.vintage?.slice(11, 16) ?? "—"}
                  </td>
                  <td className="num px-2 py-2 text-right text-[10.5px] text-ember">
                    {fmtInt(row.mae_mw)}
                  </td>
                  <td className="num px-2 py-2 text-right text-[10.5px] text-acid">
                    {fmtInt(row.mae_calibrated_mw)}
                  </td>
                  <td className="num px-2 py-2 text-right text-[10.5px] text-muted">
                    {fmtSignedMw(row.bias_mw)}
                  </td>
                  <td className="num hidden px-2 py-2 text-right text-[10px] text-faint sm:table-cell">
                    {fmtPct(row.coverage_pct, 0)}
                  </td>
                  <td className="num hidden px-2 py-2 pr-5 text-right text-[10px] text-faint md:table-cell">
                    {row.forecast_total_mwh !== null
                      ? `${Math.round(row.forecast_total_mwh / 1000).toLocaleString("en-GB")} GWh`
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-panel to-transparent" />
        </div>
      </Panel>

      <div className="rounded-xl border border-edge bg-panel/50 p-4">
        <div className="flex flex-wrap items-start gap-3">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-acid" />
          <div className="min-w-0 flex-1">
            <p className="text-[11.5px] leading-relaxed text-muted">
              <span className="text-paper">Reading the numbers:</span>{" "}
              MAE is the average absolute miss; RMSE punishes large misses more
              heavily; bias is the average signed miss. P90 is the miss that only
              one hour in ten exceeds — the relevant number when sizing a
              procurement buffer. Calibration is fitted only on prior days, so
              the calibrated score is an honest out-of-sample measure.
            </p>
          </div>
          <Link
            to="/method"
            className="inline-flex shrink-0 items-center gap-1.5 text-[10.5px] text-muted transition-colors hover:text-acid"
          >
            Read the method <ArrowUpRight className="h-3 w-3" />
          </Link>
        </div>
      </div>
    </div>
  );
}

function LeadTimeBars({ data }: { data: AccuracyBundle }) {
  const maxMae = Math.max(...data.lead_time.map((row) => row.mae_mw ?? 0), 1);
  if (!data.lead_time.length) {
    return (
      <p className="py-12 text-center text-sm text-muted">
        No lead-time buckets available.
      </p>
    );
  }
  return (
    <div>
      <div className="mb-3 flex items-center justify-between text-[9px] uppercase tracking-[0.12em] text-faint">
        <span>Horizon</span>
        <span>MAE</span>
      </div>
      <div className="space-y-3">
        {data.lead_time.map((row) => (
          <div key={row.bucket} className="grid grid-cols-[62px_1fr_74px] items-center gap-3">
            <span className="num text-[10.5px] text-muted">{row.bucket}</span>
            <div className="h-1.5 overflow-hidden rounded-full bg-panel2">
              <div
                className="h-full rounded-full bg-gradient-to-r from-ember/80 to-ember/40"
                style={{
                  width: `${Math.max(3, ((row.mae_mw ?? 0) / maxMae) * 100)}%`,
                }}
              />
            </div>
            <span className="num text-right text-[10.5px] text-paper">
              {fmtMw(row.mae_mw)}
            </span>
          </div>
        ))}
      </div>
      <div className="mt-4 flex items-center justify-between border-t border-edge pt-3 text-[10px] text-muted">
        <span>Signed bias</span>
        <span className="num text-ember">
          {fmtSignedMw(
            data.lead_time.reduce(
              (sum, row) => sum + (row.bias_mw ?? 0) * row.hours,
              0,
            ) /
              Math.max(
                data.lead_time.reduce((sum, row) => sum + row.hours, 0),
                1,
              ),
          )}
        </span>
      </div>
    </div>
  );
}
