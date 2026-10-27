import {
  ArrowRight,
  ArrowUpDown,
  CalendarDays,
  Clock3,
  Flame,
  GitBranch,
  Info,
  Radio,
  Target,
  Wind,
} from "lucide-react";
import { Link } from "react-router-dom";
import { api, forecastCsvUrl } from "../lib/api";
import { useApi } from "../lib/useApi";
import { useAppState } from "../context/AppState";
import type {
  DayBundle,
  ProcurementBundle,
  RevisionsBundle,
} from "../lib/types";
import {
  addDays,
  dateLong,
  dateShort,
  fmtGw,
  fmtInt,
  fmtMwh,
  fmtMw,
  fmtPct,
  fmtSignedMw,
  hourLabel,
  weekday,
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
  Segmented,
  Select,
  Stat,
} from "../components/ui";
import { ForecastChart } from "../components/charts/ForecastChart";
import { RevisionsChart } from "../components/charts/RevisionsChart";
import { ProcurementPanel } from "../components/ProcurementPanel";

export function OverviewPage() {
  const {
    date,
    setDate,
    cutoff,
    setCutoff,
    calibrated,
    setCalibrated,
    demandGw,
    setDemandGw,
    dates,
    cutoffOptions,
    meta,
  } = useAppState();

  const latestState = useApi<DayBundle>(
    `latest:${date}:${cutoff}:${calibrated}`,
    (signal) => api.latest({ delivery_date: date, cutoff, calibrated }, signal),
  );
  const revisionsState = useApi<RevisionsBundle>(
    `revisions:${date}:${cutoff}`,
    (signal) => api.revisions({ delivery_date: date, cutoff }, signal),
  );
  const procurementState = useApi<ProcurementBundle>(
    `procurement:${date}:${cutoff}:${demandGw}`,
    (signal) =>
      api.procurement(
        {
          delivery_date: date,
          demand_gw: demandGw,
          cutoff,
          calibrated: true,
        },
        signal,
      ),
  );

  const latest = latestState.data;
  const summary = latest?.summary;
  const summaryRaw = latest?.summary_raw;
  const procurement = procurementState.data;

  const leadHours = (latest?.series ?? [])
    .map((point) => point.lead_hours)
    .filter((value): value is number => typeof value === "number");
  const leadMin = leadHours.length ? Math.min(...leadHours) : null;
  const leadMax = leadHours.length ? Math.max(...leadHours) : null;

  const previousCutoff = addDays(date, -1);
  const lateVintage = revisionsState.data?.vintages.find(
    (vintage) => !vintage.available_at_cutoff,
  );

  const biasTone = (summary?.bias_mw ?? 0) > 0 ? "ember" : "mint";
  const rawLabel = calibrated ? "corrected" : "raw";

  return (
    <>
      <PageHeader
        eyebrow="Decision support · Delivery day"
        title={
          <>
            The forecast you had.
            <br />
            The <span className="italic text-acid">error</span> you should plan
            for.
          </>
        }
        description="Day-ahead wind intelligence for Great Britain. Every number is selected from the WINDFOR vintage that existed at gate closure — no hindsight, no look-ahead."
        actions={
          <>
            <Select
              label="Delivery"
              value={date}
              ariaLabel="Delivery day"
              options={dates
                .slice()
                .reverse()
                .map((day) => ({
                  value: day,
                  label: `${weekday(day)} ${dateShort(day)}`,
                }))}
              onChange={setDate}
            />
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
            <ActionLink
              href={forecastCsvUrl(date, cutoff, calibrated)}
              download
              icon={null}
            >
              Export CSV
            </ActionLink>
          </>
        }
      />

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-edge bg-panel/50 px-4 py-2.5">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[10.5px] text-muted">
          <span className="inline-flex items-center gap-1.5">
            <CalendarDays className="h-3 w-3 text-faint" />
            {dateLong(date)}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Clock3 className="h-3 w-3 text-faint" />
            Gate closure {cutoff} UTC
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Radio className="h-3 w-3 text-faint" />
            Vintage{" "}
            <span className="font-mono text-paper">
              {latest?.vintage ? `${dateShort(latest.vintage)} · ${latest.vintage.slice(11, 16)}` : "—"}
            </span>
          </span>
          <Badge tone="acid" dot>
            No look-ahead
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <span className="eyebrow hidden sm:inline">View</span>
          <Segmented
            label="Forecast basis"
            value={calibrated ? "calibrated" : "raw"}
            options={[
              { value: "raw", label: "Raw WINDFOR" },
              { value: "calibrated", label: "Bias-corrected" },
            ]}
            onChange={(value) => setCalibrated(value === "calibrated")}
          />
        </div>
      </div>

      {latestState.error && !latest && (
        <div className="mb-4">
          <Panel bodyClassName="p-0">
            <ErrorBlock message={latestState.error} onRetry={latestState.reload} />
          </Panel>
        </div>
      )}

      <div className="mb-4 grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Kpi
          label={`Forecast energy · ${rawLabel}`}
          value={fmtMwh(summary?.forecast_total_mwh)}
          icon={Wind}
          tone="acid"
          sub={
            calibrated && summaryRaw
              ? `Raw ${fmtMwh(summaryRaw.forecast_total_mwh)}`
              : `Actual ${fmtMwh(summaryRaw?.actual_total_mwh)}`
          }
        />
        <Kpi
          label="P90 absolute error"
          value={fmtGw(summary?.p90_abs_error_mw)}
          icon={Target}
          tone="ember"
          sub="9 in 10 hours fall inside this band"
        />
        <Kpi
          label="Forecast bias"
          value={fmtSignedMw(summary?.bias_mw)}
          icon={ArrowUpDown}
          tone={biasTone}
          sub={calibrated ? "After trailing bias correction" : "Forecast minus actual"}
        />
        <Kpi
          label={`Thermal gap · ${demandGw.toFixed(1)} GW`}
          value={fmtMwh(procurement?.summary.residual_demand_mwh)}
          icon={Flame}
          tone="sky"
          sub="Bias-corrected wind vs demand"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Panel
          className="xl:col-span-2"
          eyebrow="Delivery-day profile"
          title="Forecast vs outturn"
          subtitle="Hourly averages of half-hourly FUELHH wind. The shaded band is the forecast error; the raw series stays visible as a reference."
          actions={
            <div className="flex flex-wrap items-center gap-3">
              <LegendItem color="var(--chart-actual)" label="Actual" />
              <LegendItem color="var(--chart-forecast)" label={calibrated ? "Calibrated" : "Forecast"} />
              {calibrated && <LegendItem color="var(--chart-raw)" label="Raw" dashed />}
            </div>
          }
          bodyClassName="px-2 pb-2 pt-1"
        >
          {latestState.loading && !latest ? (
            <LoadingBlock label="Reading the vintage" />
          ) : latest && latest.forecast_available ? (
            <>
              <ForecastChart
                data={latest.series}
                calibrated={calibrated}
                height={372}
              />
              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-edge px-4 py-2.5 text-[10px] text-muted">
                <span>
                  Coverage{" "}
                  <span className="num text-paper">
                    {latest.summary.matched_hours}/{latest.summary.hours} h
                  </span>
                </span>
                <span>
                  Lead range{" "}
                  <span className="num text-paper">
                    {leadMin !== null && leadMax !== null
                      ? `${leadMin.toFixed(1)}–${leadMax.toFixed(1)} h`
                      : "—"}
                  </span>
                </span>
                <span>
                  Error band{" "}
                  <span className="num text-ember">
                    ±{fmtGw(latest.summary.p90_abs_error_mw)}
                  </span>{" "}
                  P90
                </span>
              </div>
            </>
          ) : (
            <EmptyState
              title="No forecast at this cut-off"
              body="Try a later cut-off or another delivery day."
            />
          )}
        </Panel>

        <DecisionPanel
          latest={latest}
          loading={latestState.loading}
          cutoff={cutoff}
          previousCutoff={previousCutoff}
          leadMin={leadMin}
          leadMax={leadMax}
          lateVintage={lateVintage ?? null}
          date={date}
        />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-3">
        <ProcurementPanel
          data={procurement}
          loading={procurementState.loading}
          error={procurementState.error}
          demandGw={demandGw}
          onDemandChange={setDemandGw}
          onRetry={procurementState.reload}
        />

        <Panel
          className="xl:col-span-2"
          eyebrow="Forecast evolution"
          title="How the forecast converged"
          subtitle="Each line is a publication for this delivery day. The acid line is the one available at gate closure."
          actions={
            <Link
              to={`/revisions?date=${date}&cutoff=${cutoff}`}
              className="inline-flex items-center gap-1.5 text-[11px] text-muted transition-colors hover:text-acid"
            >
              Open audit <ArrowRight className="h-3 w-3" />
            </Link>
          }
          bodyClassName="px-2 pb-2 pt-1"
        >
          {revisionsState.loading && !revisionsState.data ? (
            <LoadingBlock label="Replaying vintages" />
          ) : revisionsState.error && !revisionsState.data ? (
            <ErrorBlock
              message={revisionsState.error}
              onRetry={revisionsState.reload}
            />
          ) : revisionsState.data ? (
            <>
              <RevisionsChart
                vintages={revisionsState.data.vintages}
                actual={latest?.series ?? []}
                selectedVintage={latest?.vintage ?? null}
                height={224}
              />
              <div className="flex flex-wrap items-center gap-3 border-t border-edge px-4 py-2.5">
                <LegendItem color="var(--chart-forecast)" label="Used at cut-off" />
                <LegendItem color="var(--chart-muted)" label="Earlier vintage" />
                <LegendItem color="var(--chart-late)" label="Published too late" dashed />
                <LegendItem color="var(--chart-actual)" label="Actual" />
                <span className="ml-auto font-mono text-[9.5px] text-faint">
                  {revisionsState.data.vintage_count} vintages · {revisionsState.data.vintages.length} shown
                </span>
              </div>
            </>
          ) : null}
        </Panel>
      </div>

      <div className="mt-4">
        <HourlyLedger latest={latest} loading={latestState.loading} />
      </div>

      {meta?.last_ingest && (
        <p className="mt-6 flex items-center gap-2 font-mono text-[9px] uppercase tracking-[0.12em] text-faint">
          <Info className="h-3 w-3" />
          Snapshot ingested {meta.ingested_at?.slice(0, 16).replace("T", " ")} UTC ·
          FUELHH {fmtInt(meta.counts.actual_rows)} actuals · WINDFOR{" "}
          {fmtInt(meta.counts.forecast_rows)} rows
        </p>
      )}
    </>
  );
}

function DecisionPanel({
  latest,
  loading,
  cutoff,
  previousCutoff,
  leadMin,
  leadMax,
  lateVintage,
  date,
}: {
  latest: DayBundle | null;
  loading: boolean;
  cutoff: string;
  previousCutoff: string;
  leadMin: number | null;
  leadMax: number | null;
  lateVintage: { publish_time: string; available_at_cutoff: boolean } | null;
  date: string;
}) {
  return (
    <Panel
      eyebrow="Vintage audit"
      title="The decision, as it stood"
      subtitle="The exact forecast the desk could have used, and nothing published after the cut-off."
      className="h-full"
      bodyClassName="p-5"
    >
      {loading && !latest ? (
        <LoadingBlock label="Rebuilding the desk view" />
      ) : latest ? (
        <div className="flex h-full flex-col">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-faint">
                Latest available vintage
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="num text-[1.65rem] leading-none text-paper">
                  {latest.vintage ? dateShort(latest.vintage) : "—"}
                </span>
                <span className="num text-[1.65rem] leading-none text-acid">
                  {latest.vintage?.slice(11, 16) ?? ""}
                </span>
              </div>
              <div className="mt-1.5 text-[10px] text-muted">
                {latest.vintage_lag_label
                  ? `${latest.vintage_lag_label} before gate closure`
                  : "No vintage selected"}
              </div>
            </div>
            <Badge tone={latest.calibrated ? "acid" : "neutral"} dot>
              {latest.calibrated ? "Calibrated" : "Raw"}
            </Badge>
          </div>

          <div className="mt-5">
            <Stat
              label="Gate closure"
              value={`${dateShort(previousCutoff)} · ${cutoff} UTC`}
            />
            <Stat
              label="Lead time range"
              value={
                leadMin !== null && leadMax !== null
                  ? `${leadMin.toFixed(1)}–${leadMax.toFixed(1)} h`
                  : "—"
              }
            />
            <Stat
              label="Hours covered"
              value={`${latest.summary.matched_hours}/${latest.summary.hours}`}
              tone={latest.summary.coverage_pct === 100 ? "mint" : "ember"}
            />
            <Stat
              label="Forecast bias"
              value={fmtSignedMw(latest.summary.bias_mw)}
              tone={(latest.summary.bias_mw ?? 0) > 0 ? "ember" : "mint"}
            />
            <Stat
              label="Trailing calibration"
              value={
                latest.calibration.applied
                  ? `${fmtSignedMw(latest.calibration.bias_mw)} · ${latest.calibration.matched_hours} h`
                  : "Not applied"
              }
              tone={latest.calibration.applied ? "mint" : "neutral"}
            />
          </div>

          <div className="mt-4 rounded-xl border border-edge bg-panel2/50 p-3">
            <div className="flex items-start gap-2">
              <GitBranch className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ember" />
              <div className="text-[10.5px] leading-relaxed text-muted">
                {lateVintage ? (
                  <>
                    The{" "}
                    <span className="font-mono text-paper">
                      {lateVintage.publish_time.slice(11, 16)}
                    </span>{" "}
                    run exists, but it missed gate closure by{" "}
                    <span className="text-ember">
                      {Math.round(
                        (new Date(lateVintage.publish_time).getTime() -
                          new Date(`${previousCutoff}T${cutoff}:00Z`).getTime()) /
                          60000,
                      )}{" "}
                      min
                    </span>
                    . It is visible in the audit trail and never used.
                  </>
                ) : (
                  "No later publication exists for this delivery day."
                )}
              </div>
            </div>
          </div>

          <div className="mt-auto pt-5">
            <Link
              to={`/revisions?date=${date}&cutoff=${cutoff}`}
              className="inline-flex w-full items-center justify-between rounded-xl border border-edge bg-paper/[0.03] px-3.5 py-2.5 text-[11px] text-muted transition-colors hover:border-acid/30 hover:text-acid"
            >
              Audit every vintage
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      ) : (
        <EmptyState
          title="No decision view"
          body="Choose a delivery day with available forecast data."
        />
      )}
    </Panel>
  );
}

function HourlyLedger({
  latest,
  loading,
}: {
  latest: DayBundle | null;
  loading: boolean;
}) {
  return (
    <Panel
      eyebrow="Evidence"
      title="Hourly ledger"
      subtitle="Every value behind the day. Forecast is shown on the selected basis; raw is retained for comparison."
      actions={
        latest ? (
          <span className="font-mono text-[9.5px] uppercase tracking-[0.12em] text-faint">
            00:00–23:00 UTC · hourly
          </span>
        ) : null
      }
      bodyClassName="p-0"
    >
      {loading && !latest ? (
        <LoadingBlock label="Loading the ledger" />
      ) : !latest ? (
        <EmptyState title="No ledger" body="No forecast is available for this day." />
      ) : (
        <>
          <div className="relative">
            <div className="scroll-thin max-h-[340px] overflow-auto">
              <table className="w-full border-collapse text-left">
              <thead className="sticky top-0 z-10 bg-panel/95 backdrop-blur">
                <tr className="border-b border-edge text-[9px] uppercase tracking-[0.12em] text-faint">
                  <th className="py-2.5 pl-5 pr-2 font-medium">Hour</th>
                  <th className="px-2 py-2.5 font-medium">Forecast</th>
                  <th className="hidden px-2 py-2.5 font-medium sm:table-cell">
                    Raw
                  </th>
                  <th className="px-2 py-2.5 font-medium">Actual</th>
                  <th className="px-2 py-2.5 font-medium">Error</th>
                  <th className="hidden px-2 py-2.5 pr-5 text-right font-medium md:table-cell">
                    Lead
                  </th>
                </tr>
              </thead>
              <tbody>
                {latest.series.map((point) => {
                  const error = point.error_mw;
                  return (
                    <tr
                      key={point.start_time}
                      className="border-b border-edge/50 transition-colors last:border-0 hover:bg-paper/[0.03]"
                    >
                      <td className="num py-2 pl-5 pr-2 text-[11px] text-muted">
                        {hourLabel(point.start_time)}
                      </td>
                      <td className="num px-2 py-2 text-[11px] text-paper">
                        {fmtMw(point.forecast_mw)}
                      </td>
                      <td className="num hidden px-2 py-2 text-[11px] text-faint sm:table-cell">
                        {fmtMw(point.raw_forecast_mw)}
                      </td>
                      <td className="num px-2 py-2 text-[11px] text-mint/90">
                        {fmtMw(point.actual_mw)}
                      </td>
                      <td
                        className={`num px-2 py-2 text-[11px] ${
                          (error ?? 0) > 0 ? "text-ember" : "text-mint"
                        }`}
                      >
                        {fmtSignedMw(error)}
                      </td>
                      <td className="num hidden px-2 py-2 pr-5 text-right text-[10.5px] text-faint md:table-cell">
                        {point.lead_hours !== null
                          ? `${point.lead_hours.toFixed(1)} h`
                          : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            </div>
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-panel to-transparent" />
          </div>
          <div className="flex flex-wrap items-center gap-x-8 gap-y-2 border-t border-edge px-5 py-3 text-[10px] text-muted">
            <span>
              Forecast total{" "}
              <span className="num text-paper">
                {fmtMwh(latest.summary.forecast_total_mwh)}
              </span>
            </span>
            <span>
              Actual total{" "}
              <span className="num text-mint">
                {fmtMwh(latest.summary.actual_total_mwh)}
              </span>
            </span>
            <span>
              MAE{" "}
              <span className="num text-ember">
                {fmtMw(latest.summary.mae_mw)}
              </span>
            </span>
            <span>
              MAPE{" "}
              <span className="num text-paper">
                {fmtPct(latest.summary.mape_pct)}
              </span>
            </span>
          </div>
        </>
      )}
    </Panel>
  );
}
