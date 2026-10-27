import {
  AlertTriangle,
  ArrowRight,
  CalendarDays,
  Clock3,
  GitBranch,
  Layers,
  ShieldCheck,
} from "lucide-react";
import { Link } from "react-router-dom";
import { api, forecastCsvUrl } from "../lib/api";
import { useApi } from "../lib/useApi";
import { useAppState } from "../context/AppState";
import type { DayBundle, RevisionsBundle } from "../lib/types";
import {
  dateShort,
  fmtMwh,
  fmtMw,
  hourLabel,
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
import { RevisionsChart } from "../components/charts/RevisionsChart";

export function RevisionsPage() {
  const { date, setDate, cutoff, setCutoff, dates } = useAppState();

  const revState = useApi<RevisionsBundle>(
    `revisions:${date}:${cutoff}`,
    (signal) => api.revisions({ delivery_date: date, cutoff }, signal),
  );
  const dayState = useApi<DayBundle>(
    `latest-raw:${date}:${cutoff}`,
    (signal) =>
      api.latest({ delivery_date: date, cutoff, calibrated: false }, signal),
  );

  const revisions = revState.data;
  const day = dayState.data;

  const selected = revisions?.vintages.find(
    (vintage) => vintage.publish_time === revisions.latest_available_vintage,
  );
  const lateVintages =
    revisions?.vintages.filter((vintage) => !vintage.available_at_cutoff) ?? [];
  const firstLate = lateVintages[0];

  return (
    <>
      <PageHeader
        eyebrow="Forecast audit · Vintage replay"
        title={
          <>
            A forecast is a sequence of{" "}
            <span className="italic text-acid">guesses</span>.
          </>
        }
        description="Every WINDFOR publication for the delivery day, replayed in order. The desk only ever sees the last line before gate closure. The rest are an audit trail — visible, but never used in a score."
        actions={
          <>
            <Select
              label="Delivery"
              value={date}
              ariaLabel="Delivery day"
              options={dates
                .slice()
                .reverse()
                .map((dayOption) => ({
                  value: dayOption,
                  label: `${dateShort(dayOption)}`,
                }))}
              onChange={setDate}
            />
            <Select
              label="Cut-off"
              value={cutoff}
              ariaLabel="Decision cut-off time"
              options={["09:15", "09:30", "10:00", "12:00", "16:00", "18:00"].map(
                (time) => ({
                  value: time,
                  label: time === "09:15" ? `${time} · gate closure` : `${time} UTC`,
                }),
              )}
              onChange={setCutoff}
            />
            <ActionLink href={forecastCsvUrl(date, cutoff)} download icon={null}>
              Export CSV
            </ActionLink>
          </>
        }
      />

      {revState.loading && !revisions ? (
        <Panel bodyClassName="p-0">
          <LoadingBlock label="Replaying publications" />
        </Panel>
      ) : revState.error && !revisions ? (
        <Panel bodyClassName="p-0">
          <ErrorBlock message={revState.error} onRetry={revState.reload} />
        </Panel>
      ) : revisions ? (
        <div className="animate-rise space-y-4">
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            <Kpi
              label="Vintage used"
              value={
                revisions.latest_available_vintage
                  ? dateShort(revisions.latest_available_vintage)
                  : "—"
              }
              unit={revisions.latest_available_vintage?.slice(11, 16)}
              icon={Clock3}
              tone="acid"
              sub="Latest publication before cut-off"
            />
            <Kpi
              label="Age at gate closure"
              value={day?.vintage_lag_label ?? "—"}
              icon={ShieldCheck}
              tone="mint"
              sub={`Cut-off ${revisions.cutoff_time} UTC`}
            />
            <Kpi
              label="Publications"
              value={revisions.vintage_count}
              icon={Layers}
              tone="sky"
              sub={`${revisions.vintage_count - revisions.vintages.filter((vintage) => vintage.available_at_cutoff).length} late publications`}
            />
            <Kpi
              label="Selected energy"
              value={fmtMwh(selected?.total_mwh)}
              icon={GitBranch}
              tone="ember"
              sub={selected ? `${selected.hours_covered} hours covered` : "No selection"}
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-edge bg-panel/50 px-4 py-2.5 text-[10.5px] text-muted">
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
              <span className="inline-flex items-center gap-1.5">
                <CalendarDays className="h-3 w-3 text-faint" />
                Delivery {dateShort(date)}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Clock3 className="h-3 w-3 text-faint" />
                Gate closure {cutoff} UTC
              </span>
              <span className="inline-flex items-center gap-1.5">
                <GitBranch className="h-3 w-3 text-faint" />
                {revisions.vintage_count} vintages · {revisions.vintages.length} in this view
              </span>
            </div>
            <Badge tone="acid" dot>
              Look-ahead blocked
            </Badge>
          </div>

          <Panel
            eyebrow="Replay"
            title="Publication-by-publication"
            subtitle="Each line is one WINDFOR run for this delivery day. The acid line is the vintage the app scores; coral dashed lines arrived after gate closure."
            actions={
              <div className="flex flex-wrap items-center gap-3">
                <LegendItem color="var(--chart-forecast)" label="Used" />
                <LegendItem color="var(--chart-muted)" label="Earlier" />
                <LegendItem color="var(--chart-late)" label="Late" dashed />
                <LegendItem color="var(--chart-actual)" label="Actual" />
              </div>
            }
            bodyClassName="px-2 pb-2 pt-1"
          >
            <RevisionsChart
              vintages={revisions.vintages}
              actual={day?.series ?? []}
              selectedVintage={revisions.latest_available_vintage}
              height={372}
            />
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-edge px-4 py-2.5 text-[10px] text-muted">
              <span>
                Used vintage{" "}
                <span className="num text-paper">
                  {vintageLabel(revisions.latest_available_vintage)}
                </span>
              </span>
              <span>
                {firstLate ? (
                  <>
                    First late run{" "}
                    <span className="num text-coral">
                      {vintageLabel(firstLate.publish_time)}
                    </span>
                  </>
                ) : (
                  "No late runs in this window"
                )}
              </span>
              <span>
                Selected total{" "}
                <span className="num text-acid">{fmtMwh(selected?.total_mwh)}</span>
              </span>
            </div>
          </Panel>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
            <Panel
              className="xl:col-span-2"
              eyebrow="Audit trail"
              title="Vintage ledger"
              subtitle="The last 14 runs at or before cut-off, plus the first two that arrived too late. Deltas are only shown where both vintages cover all 24 hours."
              bodyClassName="p-0"
            >
              <div className="relative">
                <div className="scroll-thin max-h-[420px] overflow-auto">
                  <table className="w-full border-collapse text-left">
                    <thead className="sticky top-0 z-10 bg-panel/95 backdrop-blur">
                      <tr className="border-b border-edge text-[9px] uppercase tracking-[0.12em] text-faint">
                        <th className="py-2.5 pl-5 pr-2 font-medium">Published</th>
                        <th className="px-2 py-2.5 font-medium">Status</th>
                        <th className="hidden px-2 py-2.5 text-right font-medium sm:table-cell">
                          Hours
                        </th>
                        <th className="px-2 py-2.5 text-right font-medium">Energy</th>
                        <th className="px-2 py-2.5 pr-5 text-right font-medium">
                          Δ vs used
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {revisions.vintages
                        .slice()
                        .sort((a, b) => b.publish_time.localeCompare(a.publish_time))
                        .map((vintage) => {
                          const isSelected =
                            vintage.publish_time === revisions.latest_available_vintage;
                          const isLate = !vintage.available_at_cutoff;
                          const canCompare =
                            selected !== undefined &&
                            vintage.hours_covered === selected.hours_covered &&
                            vintage.hours_covered === 24 &&
                            vintage.total_mwh !== null &&
                            selected.total_mwh !== null;
                          const delta = canCompare
                            ? (vintage.total_mwh as number) - (selected.total_mwh as number)
                            : null;
                          return (
                            <tr
                              key={vintage.publish_time}
                              className={`border-b border-edge/50 transition-colors last:border-0 ${
                                isSelected ? "bg-acid/[0.045]" : "hover:bg-paper/[0.03]"
                              }`}
                            >
                              <td className="py-2.5 pl-5 pr-2">
                                <div className="num text-[11px] text-paper">
                                  {vintageLabel(vintage.publish_time)}
                                </div>
                                <div className="mt-0.5 font-mono text-[8.5px] uppercase tracking-[0.1em] text-faint">
                                  {isLate ? "after cut-off" : "before cut-off"}
                                </div>
                              </td>
                              <td className="px-2 py-2.5">
                                <Badge
                                  tone={isSelected ? "acid" : isLate ? "coral" : "sky"}
                                  dot={isSelected}
                                >
                                  {isSelected ? "Used" : isLate ? "Late" : "Earlier"}
                                </Badge>
                              </td>
                              <td className="num hidden px-2 py-2.5 text-right text-[10.5px] text-muted sm:table-cell">
                                {vintage.hours_covered}
                              </td>
                              <td className="num whitespace-nowrap px-2 py-2.5 text-right text-[10.5px] text-paper">
                                {fmtMwh(vintage.total_mwh)}
                              </td>
                              <td
                                className={`num whitespace-nowrap px-2 py-2.5 pr-5 text-right text-[10.5px] ${
                                  delta === null
                                    ? "text-faint"
                                    : delta > 0
                                      ? "text-ember"
                                      : "text-mint"
                                }`}
                              >
                                {delta === null
                                  ? "—"
                                  : `${delta > 0 ? "+" : ""}${fmtMwh(delta)}`}
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-panel to-transparent" />
              </div>
            </Panel>

            <div className="space-y-4">
              <Panel
                eyebrow="Why it matters"
                title="The late-run trap"
                bodyClassName="p-5"
              >
                <div className="flex items-start gap-3">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-ember" />
                  <p className="text-[11.5px] leading-relaxed text-muted">
                    Using a run that landed after gate closure makes a forecast
                    look more accurate than it was. Every metric in Windcast
                    enforces one rule: the publication time must be at or before
                    the cut-off.
                  </p>
                </div>
                <pre className="mt-4 overflow-x-auto rounded-lg border border-edge bg-ink/60 p-3 font-mono text-[9.5px] leading-relaxed text-mint/90">
{`SELECT max(publish_time)
FROM wind_forecast
WHERE publish_time <= cutoff
  AND start_time  = delivery_hour`}
                </pre>
                <p className="mt-3 text-[10px] leading-relaxed text-faint">
                  Late lines are still drawn so the audit is complete. They are
                  never eligible for selection.
                </p>
              </Panel>

              <Panel eyebrow="If the rule slipped" title="What the first late run would say" bodyClassName="p-5">
                {firstLate && selected ? (
                  <>
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="text-[10.5px] text-muted">First late run</span>
                      <span className="num text-sm text-coral">
                        {vintageLabel(firstLate.publish_time)}
                      </span>
                    </div>
                    <div className="mt-2 flex items-baseline justify-between gap-3">
                      <span className="text-[10.5px] text-muted">Energy vs used</span>
                      <span className="num text-sm text-paper">
                        {firstLate.total_mwh !== null && selected.total_mwh !== null
                          ? `${firstLate.total_mwh - selected.total_mwh > 0 ? "+" : ""}${Math.round(
                              firstLate.total_mwh - selected.total_mwh,
                            ).toLocaleString("en-GB")} MWh`
                          : "—"}
                      </span>
                    </div>
                    <div className="mt-2 flex items-baseline justify-between gap-3">
                      <span className="text-[10.5px] text-muted">Hours covered</span>
                      <span className="num text-sm text-paper">
                        {firstLate.hours_covered}
                      </span>
                    </div>
                    <Link
                      to={`/accuracy?cutoff=${cutoff}`}
                      className="mt-4 inline-flex items-center gap-1.5 text-[10.5px] text-muted transition-colors hover:text-acid"
                    >
                      See how scoring changes <ArrowRight className="h-3 w-3" />
                    </Link>
                  </>
                ) : (
                  <p className="text-[11px] text-muted">
                    No post-cut-off publication exists for this day.
                  </p>
                )}
              </Panel>
            </div>
          </div>

          <div className="rounded-xl border border-edge bg-panel/50 p-4">
            <div className="flex flex-wrap items-start gap-3">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-mint" />
              <div className="min-w-0 flex-1">
                <p className="text-[11.5px] leading-relaxed text-muted">
                  <span className="text-paper">The audit is the product.</span>{" "}
                  A forecast seen at 09:30 cannot be used to justify a decision
                  taken at 09:15. Windcast keeps the late runs visible so the
                  customer can verify the rule was applied, and so the tech lead
                  can reproduce any number back to a single publication.
                </p>
              </div>
              <Link
                to="/method"
                className="inline-flex shrink-0 items-center gap-1.5 text-[10.5px] text-muted transition-colors hover:text-acid"
              >
                Method <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          </div>

          {dayState.error && (
            <p className="text-[10px] text-coral">
              Actual overlay unavailable: {dayState.error}
            </p>
          )}
        </div>
      ) : (
        <Panel bodyClassName="p-0">
          <EmptyState
            title="No publications"
            body="There are no WINDFOR runs for this delivery day in the snapshot."
          />
        </Panel>
      )}
    </>
  );
}
