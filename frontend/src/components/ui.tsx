import {
  AlertTriangle,
  ArrowUpRight,
  ChevronDown,
  Download,
  RefreshCw,
  type LucideIcon,
} from "lucide-react";
import type { ReactNode } from "react";

type Tone = "acid" | "mint" | "ember" | "coral" | "sky" | "neutral";

const toneText: Record<Tone, string> = {
  acid: "text-acid",
  mint: "text-mint",
  ember: "text-ember",
  coral: "text-coral",
  sky: "text-sky",
  neutral: "text-paper",
};

const toneBar: Record<Tone, string> = {
  acid: "bg-gradient-to-r from-acid/80 to-acid/0",
  mint: "bg-gradient-to-r from-mint/80 to-mint/0",
  ember: "bg-gradient-to-r from-ember/80 to-ember/0",
  coral: "bg-gradient-to-r from-coral/80 to-coral/0",
  sky: "bg-gradient-to-r from-sky/80 to-sky/0",
  neutral: "bg-gradient-to-r from-muted/60 to-muted/0",
};

const badgeTone: Record<Tone, string> = {
  acid: "border-acid/25 bg-acid/10 text-acid",
  mint: "border-mint/25 bg-mint/10 text-mint",
  ember: "border-ember/25 bg-ember/10 text-ember",
  coral: "border-coral/25 bg-coral/10 text-coral",
  sky: "border-sky/25 bg-sky/10 text-sky",
  neutral: "border-edge2 bg-white/[0.03] text-muted",
};

export function Panel({
  title,
  eyebrow,
  subtitle,
  actions,
  children,
  className = "",
  bodyClassName = "p-5",
  id,
}: {
  title?: ReactNode;
  eyebrow?: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
  id?: string;
}) {
  return (
    <section id={id} className={`panel ${className}`}>
      {(title || eyebrow || actions || subtitle) && (
        <header className="flex flex-wrap items-start justify-between gap-x-5 gap-y-2 border-b border-edge px-5 py-4">
          <div className="min-w-0">
            {eyebrow && <div className="eyebrow">{eyebrow}</div>}
            {title && (
              <h2 className="mt-1 text-[15px] font-semibold tracking-[-0.01em] text-paper">
                {title}
              </h2>
            )}
            {subtitle && (
              <p className="mt-1 max-w-2xl text-[11.5px] leading-relaxed text-muted">
                {subtitle}
              </p>
            )}
          </div>
          {actions && (
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              {actions}
            </div>
          )}
        </header>
      )}
      <div className={bodyClassName}>{children}</div>
    </section>
  );
}

export function Kpi({
  label,
  value,
  unit,
  sub,
  icon: Icon,
  tone = "acid",
  dense = false,
}: {
  label: string;
  value: ReactNode;
  unit?: string;
  sub?: ReactNode;
  icon?: LucideIcon;
  tone?: Tone;
  dense?: boolean;
}) {
  return (
    <div className="panel group relative overflow-hidden p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <span className="eyebrow">{label}</span>
        {Icon && (
          <span className={`rounded-md border border-edge2/80 bg-white/[0.02] p-1.5 ${toneText[tone]}`}>
            <Icon className="h-3.5 w-3.5" strokeWidth={1.7} />
          </span>
        )}
      </div>
      <div className="mt-4 flex flex-wrap items-baseline gap-x-1.5 gap-y-1">
        <span
          className={`num whitespace-nowrap font-medium leading-none tracking-[-0.045em] text-paper ${
            dense
              ? "text-[clamp(1.3rem,1.75vw,1.6rem)]"
              : "text-[clamp(1.55rem,2.4vw,2.05rem)]"
          }`}
        >
          {value}
        </span>
        {unit && <span className="text-[11px] text-muted">{unit}</span>}
      </div>
      {sub && (
        <div className="mt-2 flex min-h-[1rem] text-[11px] leading-relaxed text-muted">
          {sub}
        </div>
      )}
      <div className={`absolute inset-x-0 bottom-0 h-px opacity-60 ${toneBar[tone]}`} />
    </div>
  );
}

export function Badge({
  children,
  tone = "neutral",
  dot = false,
}: {
  children: ReactNode;
  tone?: Tone;
  dot?: boolean;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] ${badgeTone[tone]}`}
    >
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
  label: string;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className="inline-flex items-center rounded-full border border-edge bg-panel2 p-0.5"
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(option.value)}
            className={`rounded-full px-3 py-1.5 text-[11px] font-medium transition-colors ${
              active
                ? "bg-acid text-ink shadow-[0_0_18px_-6px_rgba(200,244,90,0.6)]"
                : "text-muted hover:text-paper"
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

export function Select({
  label,
  value,
  options,
  onChange,
  className = "",
  ariaLabel,
}: {
  label?: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
  className?: string;
  ariaLabel?: string;
}) {
  return (
    <label
      className={`inline-flex items-center gap-2 rounded-xl border border-edge bg-panel px-3 py-2 transition-colors hover:border-edge2 ${className}`}
    >
      {label && <span className="eyebrow whitespace-nowrap">{label}</span>}
      <div className="relative flex items-center">
        <select
          aria-label={ariaLabel ?? label}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="cursor-pointer appearance-none bg-transparent pr-5 text-[12.5px] font-medium text-paper outline-none"
        >
          {options.map((option) => (
            <option key={option.value} value={option.value} className="bg-panel2 text-paper">
              {option.label}
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-0 h-3.5 w-3.5 text-muted" />
      </div>
    </label>
  );
}

export function Stat({
  label,
  value,
  mono = true,
  tone,
}: {
  label: ReactNode;
  value: ReactNode;
  mono?: boolean;
  tone?: Tone;
}) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-edge/70 py-2.5 last:border-0">
      <span className="text-[11.5px] leading-snug text-muted">{label}</span>
      <span
        className={`${mono ? "num" : ""} shrink-0 text-right text-[11.5px] leading-snug ${
          tone ? toneText[tone] : "text-paper"
        }`}
      >
        {value}
      </span>
    </div>
  );
}

export function Spinner({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <span
      className={`inline-block animate-spin rounded-full border-2 border-edge2 border-t-acid ${className}`}
    />
  );
}

export function LoadingBlock({ label = "Loading data" }: { label?: string }) {
  return (
    <div className="flex min-h-44 flex-col items-center justify-center gap-3">
      <Spinner className="h-5 w-5" />
      <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted">
        {label}
      </span>
    </div>
  );
}

export function ErrorBlock({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div className="flex min-h-44 flex-col items-center justify-center gap-3 px-6 text-center">
      <AlertTriangle className="h-5 w-5 text-ember" strokeWidth={1.7} />
      <p className="max-w-md text-[12.5px] leading-relaxed text-muted">{message}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex items-center gap-1.5 rounded-full border border-edge2 px-3 py-1.5 text-[11px] text-paper transition-colors hover:border-acid/40 hover:text-acid"
        >
          <RefreshCw className="h-3 w-3" /> Retry
        </button>
      )}
    </div>
  );
}

export function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex min-h-44 flex-col items-center justify-center gap-2 px-6 text-center">
      <p className="text-sm text-paper">{title}</p>
      <p className="max-w-md text-[12px] leading-relaxed text-muted">{body}</p>
    </div>
  );
}

export function ActionLink({
  href,
  children,
  download = false,
  icon = ArrowUpRight,
}: {
  href: string;
  children: ReactNode;
  download?: boolean;
  icon?: LucideIcon | null;
}) {
  const Icon = icon;
  return (
    <a
      href={href}
      download={download || undefined}
      className="inline-flex items-center gap-1.5 rounded-full border border-edge bg-panel px-3 py-2 text-[11.5px] text-muted transition-colors hover:border-acid/35 hover:text-acid"
    >
      {download ? <Download className="h-3 w-3" /> : Icon ? <Icon className="h-3 w-3" /> : null}
      {children}
    </a>
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  children,
}: {
  eyebrow: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <header className="animate-rise mb-6">
      <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
        <div className="max-w-3xl">
          <div className="flex items-center gap-2.5">
            <span className="h-px w-7 bg-acid/60" />
            <span className="eyebrow">{eyebrow}</span>
          </div>
          <h1 className="mt-3 text-balance font-serif text-[clamp(2.05rem,3.7vw,3.35rem)] leading-[0.98] tracking-[-0.02em] text-paper">
            {title}
          </h1>
          {description && (
            <p className="mt-3 max-w-2xl text-[13px] leading-relaxed text-muted">
              {description}
            </p>
          )}
        </div>
        {actions && (
          <div className="flex flex-wrap items-end gap-2 xl:justify-end">
            {actions}
          </div>
        )}
      </div>
      {children}
    </header>
  );
}

export function LegendItem({
  color,
  label,
  dashed = false,
}: {
  color: string;
  label: string;
  dashed?: boolean;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[10.5px] text-muted">
      <span
        className="inline-block h-0 w-4 border-t-2"
        style={{
          borderColor: color,
          borderStyle: dashed ? "dashed" : "solid",
        }}
      />
      {label}
    </span>
  );
}
