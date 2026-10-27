import {
  BookOpen,
  Clock3,
  GitBranch,
  Gauge,
  Target,
  type LucideIcon,
} from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";
import { useAppState } from "../context/AppState";

function TurbineMark({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <g
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        fill="none"
      >
        <path d="M16 16V4.5" />
        <path d="M16 16l10 5.8" />
        <path d="M16 16L6 21.8" />
      </g>
      <circle cx="16" cy="16" r="2.3" fill="currentColor" />
    </svg>
  );
}

const NAV: { to: string; label: string; icon: LucideIcon; end?: boolean }[] = [
  { to: "/", label: "Overview", icon: Gauge, end: true },
  { to: "/accuracy", label: "Accuracy", icon: Target },
  { to: "/revisions", label: "Revisions", icon: GitBranch },
  { to: "/method", label: "Method", icon: BookOpen },
];

function NavItem({
  to,
  label,
  icon: Icon,
  end,
  compact = false,
}: {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
  compact?: boolean;
}) {
  const { search } = useLocation();
  const href = `${to}${search}`;

  if (compact) {
    return (
      <NavLink
        to={href}
        end={end}
        className={({ isActive }) =>
          `shrink-0 rounded-full px-3 py-1.5 text-[11px] transition-colors ${
            isActive
              ? "bg-acid text-ink"
              : "text-muted hover:bg-white/[0.04] hover:text-paper"
          }`
        }
      >
        {label}
      </NavLink>
    );
  }

  return (
    <NavLink
      to={href}
      end={end}
      className={({ isActive }) =>
        `group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-[12.5px] transition-colors ${
          isActive
            ? "bg-acid/[0.07] text-paper"
            : "text-muted hover:bg-white/[0.025] hover:text-paper"
        }`
      }
    >
      {({ isActive }) => (
        <>
          {isActive && (
            <span className="absolute left-0 top-1/2 h-4 w-[2px] -translate-y-1/2 rounded-full bg-acid" />
          )}
          <Icon
            className={`h-4 w-4 ${isActive ? "text-acid" : "text-faint group-hover:text-muted"}`}
            strokeWidth={1.7}
          />
          <span>{label}</span>
        </>
      )}
    </NavLink>
  );
}

function Sidebar() {
  const { meta } = useAppState();
  const { search } = useLocation();

  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-[248px] flex-col border-r border-edge bg-[#080d0b]/95 lg:flex">
      <div className="px-5 pb-5 pt-6">
        <NavLink to={`/${search}`} className="group flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl border border-acid/20 bg-acid/[0.06] text-acid transition-transform duration-700 group-hover:rotate-[120deg]">
            <TurbineMark />
          </span>
          <span className="min-w-0">
            <span className="block font-mono text-[12.5px] font-semibold tracking-[0.22em] text-paper">
              WINDCAST
            </span>
            <span className="mt-0.5 block font-mono text-[8px] uppercase tracking-[0.17em] text-faint">
              GB wind intelligence
            </span>
          </span>
        </NavLink>
      </div>

      <nav className="mt-1 px-3" aria-label="Primary">
        <div className="eyebrow px-2 pb-2">Workspace</div>
        <div className="space-y-0.5">
          {NAV.map((item) => (
            <NavItem key={item.to} {...item} />
          ))}
        </div>
      </nav>

      <div className="mt-6 px-3">
        <div className="border-t border-edge pt-4">
          <div className="eyebrow px-2">Default cut-off</div>
          <div className="mt-2 flex items-center gap-2 px-2 font-mono text-[10px] text-muted">
            <Clock3 className="h-3 w-3 text-faint" />
            09:15 UTC
          </div>
          <p className="mt-1.5 px-2 text-[9px] leading-relaxed text-faint">
            GB day-ahead gate closure. Adjustable in each view.
          </p>
        </div>
      </div>

      <div className="mt-auto px-3 pb-3">
        <div className="rounded-xl border border-edge bg-panel/80 p-3.5">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[8.5px] uppercase tracking-[0.16em] text-faint">
              Snapshot
            </span>
            <span className="inline-flex items-center gap-1.5 font-mono text-[8.5px] uppercase tracking-[0.12em] text-acid">
              <span className="pulse-dot h-1.5 w-1.5 rounded-full bg-acid" />
              Loaded
            </span>
          </div>
          <div className="mt-3 flex items-baseline gap-1.5">
            <span className="num text-lg text-paper">
              {meta ? meta.counts.actual_rows.toLocaleString("en-GB") : "—"}
            </span>
            <span className="text-[10px] text-muted">actuals</span>
          </div>
          <div className="mt-1 text-[10px] text-muted">
            1–31 Jan 2026 · 30 min
          </div>
          <div className="mt-3 border-t border-edge pt-2.5 text-[9px] leading-relaxed text-faint">
            Elexon BMRS · FUELHH + WINDFOR
          </div>
        </div>
      </div>

      <div className="px-3 pb-4">
        <div className="px-2 font-mono text-[8px] uppercase tracking-[0.14em] text-faint">
          Built for the REint challenge
        </div>
      </div>
    </aside>
  );
}

function MobileHeader() {
  const { search } = useLocation();

  return (
    <div className="lg:hidden">
      <div className="glass sticky top-0 z-40 border-b border-edge">
        <div className="flex items-center justify-between px-4 py-3">
          <NavLink to={`/${search}`} className="flex items-center gap-2.5">
            <span className="grid h-8 w-8 place-items-center rounded-lg border border-acid/20 bg-acid/[0.06] text-acid">
              <TurbineMark className="h-4 w-4" />
            </span>
            <span className="font-mono text-[11px] font-semibold tracking-[0.2em] text-paper">
              WINDCAST
            </span>
          </NavLink>
          <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-faint">
            Jan 2026
          </span>
        </div>
        <nav
          className="scroll-thin flex gap-1 overflow-x-auto px-3 pb-2.5"
          aria-label="Primary"
        >
          {NAV.map((item) => (
            <NavItem key={item.to} {...item} compact />
          ))}
        </nav>
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <Sidebar />
      <MobileHeader />
      <div className="lg:pl-[248px]">
        <main className="mx-auto max-w-[1500px] px-4 pb-16 pt-6 sm:px-6 lg:px-9 lg:pt-9">
          {children}
        </main>
        <footer className="border-t border-edge px-4 py-5 sm:px-6 lg:px-9">
          <div className="mx-auto flex max-w-[1500px] flex-col gap-2 text-[10px] text-faint sm:flex-row sm:items-center sm:justify-between">
            <span>
              Windcast · a day-ahead wind pilot for a GB energy utility · January 2026
            </span>
            <span className="font-mono uppercase tracking-[0.12em]">
              No look-ahead · raw and calibrated views
            </span>
          </div>
        </footer>
      </div>
    </div>
  );
}
