import {
  ArrowUpRight,
  BookOpen,
  CheckCircle2,
  Database,
  GitBranch,
  Info,
  Layers,
  Server,
  ShieldCheck,
  Wind,
} from "lucide-react";
import { useAppState } from "../context/AppState";
import { fmtInt } from "../lib/format";
import { Badge, PageHeader, Panel } from "../components/ui";

export function MethodPage() {
  const { meta } = useAppState();

  return (
    <>
      <PageHeader
        eyebrow="Method · Assumptions and evidence"
        title={
          <>
            Method, stated <span className="italic text-acid">plainly</span>.
          </>
        }
        description="The selection rule, the aggregation, the metrics, and the caveats — in one place. If a number on the dashboard cannot be traced back to this page, it should not be trusted."
      />

      <div className="mb-6 flex flex-wrap items-center gap-x-6 gap-y-2 rounded-xl border border-edge bg-panel/50 px-4 py-2.5 text-[10.5px] text-muted">
        <span className="inline-flex items-center gap-1.5">
          <Database className="h-3 w-3 text-faint" />
          {meta ? fmtInt(meta.counts.actual_rows) : "—"} actual half-hours
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Layers className="h-3 w-3 text-faint" />
          {meta ? fmtInt(meta.counts.forecast_rows) : "—"} forecast rows
        </span>
        <span className="inline-flex items-center gap-1.5">
          <GitBranch className="h-3 w-3 text-faint" />
          {meta ? fmtInt(meta.counts.forecast_vintages) : "—"} publications
        </span>
        <Badge tone="acid" dot>
          January 2026 · GB national wind
        </Badge>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.6fr_1fr]">
        <div className="panel px-5 py-2 sm:px-7">
          <MethodSection number="01" title="Scope">
            <p>
              A GB energy utility must buy power one day ahead to cover the gap
              between forecast wind generation and its customers&apos; demand.
              This pilot covers <Strong>national wind only</Strong>, for{" "}
              <Strong>January 2026</Strong>. It is a decision-support view, not a
              trading engine: there are no prices, no interconnectors, no demand
              dataset and no unit commitment.
            </p>
            <p>
              The two inputs are published by Elexon:{" "}
              <InlineLink href="https://bmrs.elexon.co.uk/api-documentation/endpoint/datasets/FUELHH">
                FUELHH
              </InlineLink>{" "}
              for half-hourly actual generation by fuel type and{" "}
              <InlineLink href="https://bmrs.elexon.co.uk/api-documentation/endpoint/datasets/WINDFOR">
                WINDFOR
              </InlineLink>{" "}
              for wind generation forecasts. Only the <Code>WIND</Code> fuel type
              is used from FUELHH.
            </p>
          </MethodSection>

          <MethodSection number="02" title="Vintage discipline">
            <p>
              A forecast is not one number; it is a sequence of publications. The
              model must only use the most recent one that existed at the decision
              cut-off. Windcast assumes GB day-ahead gate closure at{" "}
              <Strong>09:15 UTC on the day before delivery</Strong>. January is
              GMT, so the UTC wall clock matches the market clock for the whole
              window. The UI exposes other cut-offs for sensitivity testing.
            </p>
            <p>
              For each delivery hour, the selected vintage is the maximum{" "}
              <Code>publish_time</Code> that is less than or equal to the cut-off.
              Under the default 09:15 cut-off, the 07:30 run is the last one
              available; the 09:30 run arrives 15 minutes too late and is excluded
              from every score.
            </p>
            <SqlBlock>{`SELECT max(publish_time)
FROM wind_forecast
WHERE publish_time <= :cutoff
  AND start_time  = :delivery_hour`}</SqlBlock>
            <p className="text-[11px] text-faint">
              This is the single most important line in the product. Without it,
              accuracy is inflated by information the desk did not have.
            </p>
          </MethodSection>

          <MethodSection number="03" title="Resolution and metrics">
            <p>
              FUELHH is half-hourly; WINDFOR is hourly. Each hourly forecast is
              compared with the <Strong>average of the two half-hourly actuals</Strong>{" "}
              in that hour. That respects the native resolution of the forecast
              and avoids double-counting. No interpolation is used.
            </p>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              <Metric name="MAE" definition="Mean of |forecast − actual|, in MW." />
              <Metric
                name="RMSE"
                definition="Square root of the mean squared error. Penalises large misses."
              />
              <Metric
                name="Bias"
                definition="Mean of (forecast − actual). Positive means the forecast ran high."
              />
              <Metric
                name="P90 abs. error"
                definition="The absolute miss that only one hour in ten exceeds."
              />
              <Metric
                name="MAPE"
                definition="Mean absolute percentage error, restricted to actuals above 500 MW."
              />
              <Metric
                name="Coverage"
                definition="Matched hours divided by delivery hours, after the vintage filter."
              />
            </div>
          </MethodSection>

          <MethodSection number="04" title="Bias calibration">
            <p>
              Raw WINDFOR runs high against FUELHH transmission wind. The app
              measures the trailing mean signed error over the previous{" "}
              <Strong>14 days</Strong>, requiring at least 48 matched hours, and
              subtracts it from the forecast. The calibration for a delivery day
              uses only days before it, so the calibrated score remains
              out-of-sample.
            </p>
            <SqlBlock>{`calibrated_forecast =
  raw_forecast - mean(forecast - actual)
                 over the prior 14 days`}</SqlBlock>
            <p>
              Raw is always reported next to corrected. Correcting a bias is not
              the same as improving a forecast: the day-to-day dispersion — the
              part that matters for a buffer — remains. On the full month the
              correction cuts MAE by roughly 22% but leaves a P90 error above
              3 GW.
            </p>
          </MethodSection>

          <MethodSection number="05" title="Procurement view">
            <p>
              The thermal gap is <Code>demand − wind</Code>. The dataset contains
              wind only, so demand is an explicit operator assumption controlled
              by the slider (20–50 GW). It is illustrative, not measured.
            </p>
            <p>
              The recommended buffer is the P90 absolute error of the trailing 14
              days, measured after bias correction. Holding that buffer covers
              nine hours in ten historically. The procurement card shows the
              residual before and after the buffer, the peak residual hour, and
              the number of prior hours behind the calibration.
            </p>
          </MethodSection>

          <MethodSection number="06" title="Caveats">
            <Caveat title="Two series, not one truth">
              FUELHH reports transmission-metered wind; WINDFOR may cover a
              broader scope (for example total or available wind). The measured
              +1.85 GW bias is consistent with that scope difference and with
              curtailment, not necessarily with model error alone. The app
              exposes both the raw comparison and a transparent correction.
            </Caveat>
            <Caveat title="Demand is an assumption">
              There is no demand dataset in scope. The thermal gap is a planning
              illustration driven by the slider, not a settlement calculation.
            </Caveat>
            <Caveat title="No prices, no money">
              The product sizes MW and MWh. A real desk would optimise £/MWh,
              imbalance risk, interconnector flows and unit constraints.
            </Caveat>
            <Caveat title="Static snapshot">
              January 2026 is fixed in the SQLite snapshot for reproducibility.
              A production deployment would add a scheduler, freshness checks and
              alerting on late publications.
            </Caveat>
            <Caveat title="Deterministic forecasts only">
              WINDFOR is a point forecast. The error bands here are empirical,
              derived from realised misses, not a probabilistic forecast.
            </Caveat>
          </MethodSection>

          <MethodSection number="07" title="What I would add next">
            <div className="grid gap-3 sm:grid-cols-2">
              <NextItem
                title="Like-for-like wind"
                body="Add embedded wind or NESO data to separate scope bias from forecast skill."
              />
              <NextItem
                title="Price-aware procurement"
                body="Join day-ahead prices and interconnector flows to optimise cost, not just MW."
              />
              <NextItem
                title="Probabilistic calibration"
                body="Condition error bands on wind level, season and regime instead of one P90."
              />
              <NextItem
                title="Live operations"
                body="Scheduled ingestion, late-publication alerts and freshness SLOs."
              />
            </div>
          </MethodSection>
        </div>

        <div className="space-y-4">
          <Panel eyebrow="Architecture" title="One container, one snapshot" bodyClassName="p-5">
            <div className="space-y-2">
              <FlowNode icon={Database} label="Elexon BMRS" detail="FUELHH · WINDFOR" />
              <FlowArrow />
              <FlowNode icon={Layers} label="Python ingest" detail="chunked, cached, validated" />
              <FlowArrow />
              <FlowNode icon={Server} label="SQLite snapshot" detail="2.5 MB · reproducible" />
              <FlowArrow />
              <FlowNode icon={GitBranch} label="FastAPI" detail="vintage-aware analytics" />
              <FlowArrow />
              <FlowNode icon={Wind} label="React dashboard" detail="Vite · custom SVG charts" />
            </div>
            <p className="mt-4 text-[10.5px] leading-relaxed text-faint">
              The production image builds the React app and serves it from FastAPI,
              so the browser, API and data share one origin. Docker Compose covers
              local development; the same image is deployment-ready.
            </p>
          </Panel>

          <Panel eyebrow="Reproducibility" title="Trust, but verify" bodyClassName="p-5">
            <ul className="space-y-2.5 text-[11px] leading-relaxed text-muted">
              <CheckRow text="Raw Elexon responses cached as gzipped JSON." />
              <CheckRow text="SQLite snapshot committed for deterministic demos." />
              <CheckRow text="16 backend tests: vintage selection, calibration, API contracts." />
              <CheckRow text="CSV exports for both the day view and the accuracy window." />
              <CheckRow text="AI assistance declared in the README, as required." />
            </ul>
            <div className="mt-4 rounded-lg border border-edge bg-panel2/50 p-3 font-mono text-[9.5px] leading-relaxed text-faint">
              <div className="text-mint/80">$ make up</div>
              <div># API :8000 · web :5173</div>
              <div className="mt-2 text-mint/80">$ make ingest</div>
              <div># refresh the January 2026 snapshot</div>
            </div>
          </Panel>

          <Panel eyebrow="Disclosure" title="AI assistance" bodyClassName="p-5">
            <div className="flex items-start gap-3">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-ember" />
              <p className="text-[11px] leading-relaxed text-muted">
                AI tools were used for implementation support, refactoring and
                design exploration. The data-selection rule, metric definitions,
                caveats and final code were reviewed against the Elexon data and
                covered by the test suite. The README repeats this disclosure.
              </p>
            </div>
          </Panel>

          <Panel eyebrow="Source" title="Read the data" bodyClassName="p-5">
            <div className="space-y-2 text-[11px]">
              <ExternalLink href="https://bmrs.elexon.co.uk/api-documentation/endpoint/datasets/FUELHH">
                FUELHH · actual generation
              </ExternalLink>
              <ExternalLink href="https://bmrs.elexon.co.uk/api-documentation/endpoint/datasets/WINDFOR">
                WINDFOR · wind forecast
              </ExternalLink>
              <ExternalLink href="https://data.elexon.co.uk/bmrs/api/v1/datasets/FUELHH?fuelType=WIND">
                Elexon API · live endpoint
              </ExternalLink>
            </div>
          </Panel>
        </div>
      </div>
    </>
  );
}

function MethodSection({
  number,
  title,
  children,
}: {
  number: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="grid gap-4 border-b border-edge py-7 last:border-0 lg:grid-cols-[150px_1fr]">
      <div>
        <span className="num text-[10px] text-faint">{number}</span>
        <h2 className="mt-1.5 font-serif text-[1.35rem] leading-tight text-paper">
          {title}
        </h2>
      </div>
      <div className="space-y-3 text-[12px] leading-relaxed text-muted">
        {children}
      </div>
    </section>
  );
}

function Strong({ children }: { children: React.ReactNode }) {
  return <strong className="font-medium text-paper">{children}</strong>;
}

function Code({ children }: { children: React.ReactNode }) {
  return (
    <code className="rounded border border-edge2/70 bg-ink/60 px-1 py-0.5 font-mono text-[10.5px] text-mint/90">
      {children}
    </code>
  );
}

function SqlBlock({ children }: { children: React.ReactNode }) {
  return (
    <pre className="overflow-x-auto rounded-lg border border-edge bg-ink/60 p-3.5 font-mono text-[10px] leading-relaxed text-mint/90">
      {children}
    </pre>
  );
}

function Metric({ name, definition }: { name: string; definition: string }) {
  return (
    <div className="rounded-lg border border-edge bg-panel2/40 p-3">
      <div className="num text-[10px] uppercase tracking-[0.1em] text-acid">
        {name}
      </div>
      <p className="mt-1 text-[10.5px] leading-relaxed text-muted">{definition}</p>
    </div>
  );
}

function Caveat({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2.5">
      <Info className="mt-1 h-3.5 w-3.5 shrink-0 text-ember" />
      <p>
        <span className="font-medium text-paper">{title}. </span>
        {children}
      </p>
    </div>
  );
}

function NextItem({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-lg border border-edge bg-panel2/40 p-3">
      <div className="flex items-center gap-1.5 text-[11px] font-medium text-paper">
        <CheckCircle2 className="h-3 w-3 text-acid" />
        {title}
      </div>
      <p className="mt-1 text-[10.5px] leading-relaxed text-muted">{body}</p>
    </div>
  );
}

function InlineLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="font-medium text-acid underline decoration-acid/30 underline-offset-2 transition-colors hover:decoration-acid"
    >
      {children}
    </a>
  );
}

function ExternalLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="flex items-center justify-between gap-3 rounded-lg border border-edge bg-panel2/40 px-3 py-2 text-[10.5px] text-muted transition-colors hover:border-acid/30 hover:text-acid"
    >
      <span>{children}</span>
      <ArrowUpRight className="h-3 w-3 shrink-0" />
    </a>
  );
}

function FlowNode({
  icon: Icon,
  label,
  detail,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  detail: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-edge bg-panel2/40 px-3 py-2.5">
      <span className="grid h-7 w-7 place-items-center rounded-md border border-edge2 text-acid">
        <Icon className="h-3.5 w-3.5" />
      </span>
      <div className="min-w-0">
        <div className="text-[11px] text-paper">{label}</div>
        <div className="font-mono text-[8.5px] uppercase tracking-[0.1em] text-faint">
          {detail}
        </div>
      </div>
    </div>
  );
}

function FlowArrow() {
  return (
    <div className="flex justify-center">
      <span className="h-3 w-px bg-edge2" />
    </div>
  );
}

function CheckRow({ text }: { text: string }) {
  return (
    <li className="flex items-start gap-2">
      <CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0 text-mint" />
      <span>{text}</span>
    </li>
  );
}
