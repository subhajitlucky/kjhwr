import {
  createContext,
  useContext,
  useMemo,
  type ReactNode,
} from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "../lib/api";
import { clamp, enumerateDates } from "../lib/format";
import type { Meta } from "../lib/types";
import { useApi } from "../lib/useApi";

const FALLBACK_DATES = enumerateDates("2026-01-01", "2026-02-01");
const CUTOFF_OPTIONS = ["09:15", "09:30", "10:00", "12:00", "16:00", "18:00"];

export interface AppStateValue {
  date: string;
  setDate: (value: string) => void;
  cutoff: string;
  setCutoff: (value: string) => void;
  calibrated: boolean;
  setCalibrated: (value: boolean) => void;
  demandGw: number;
  setDemandGw: (value: number) => void;
  dates: string[];
  cutoffOptions: string[];
  meta: Meta | null;
  metaLoading: boolean;
  metaError: string | null;
  reloadMeta: () => void;
}

const AppStateContext = createContext<AppStateValue | null>(null);

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const metaState = useApi<Meta>("meta", api.meta);

  const dates = useMemo(() => {
    if (!metaState.data) return FALLBACK_DATES;
    return enumerateDates(
      metaState.data.analysis_start,
      metaState.data.analysis_end,
    );
  }, [metaState.data]);

  const dateParam = searchParams.get("date");
  const date =
    dateParam && dates.includes(dateParam)
      ? dateParam
      : dates[dates.length - 1] ?? "2026-01-31";

  const cutoffParam = searchParams.get("cutoff");
  const cutoff =
    cutoffParam && CUTOFF_OPTIONS.includes(cutoffParam)
      ? cutoffParam
      : "09:15";

  const calibrated = searchParams.get("cal") === "1";
  const demandRaw = Number(searchParams.get("demand") ?? "35");
  const demandGw = Number.isFinite(demandRaw)
    ? clamp(demandRaw, 20, 50)
    : 35;

  const update = useMemo(() => {
    return (patch: Record<string, string | null>) => {
      const next = new URLSearchParams(searchParams);
      for (const [key, value] of Object.entries(patch)) {
        if (value === null) next.delete(key);
        else next.set(key, value);
      }
      setSearchParams(next, { replace: true });
    };
  }, [searchParams, setSearchParams]);

  const value: AppStateValue = {
    date,
    setDate: (next) => update({ date: next }),
    cutoff,
    setCutoff: (next) => update({ cutoff: next }),
    calibrated,
    setCalibrated: (next) => update({ cal: next ? "1" : null }),
    demandGw,
    setDemandGw: (next) => update({ demand: String(Math.round(next * 10) / 10) }),
    dates,
    cutoffOptions: CUTOFF_OPTIONS,
    meta: metaState.data,
    metaLoading: metaState.loading,
    metaError: metaState.error,
    reloadMeta: metaState.reload,
  };

  return (
    <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>
  );
}

export function useAppState(): AppStateValue {
  const value = useContext(AppStateContext);
  if (!value) {
    throw new Error("useAppState must be used inside AppStateProvider");
  }
  return value;
}
