import type {
  AccuracyBundle,
  DayBundle,
  Meta,
  ProcurementBundle,
  RevisionsBundle,
} from "./types";

const API_BASE = import.meta.env.VITE_API_BASE ?? "";

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

type ParamValue = string | number | boolean | null | undefined;

function buildUrl(path: string, params?: Record<string, ParamValue>): string {
  const url = new URL(`${API_BASE}${path}`, window.location.origin);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null && value !== "") {
        url.searchParams.set(key, String(value));
      }
    }
  }
  return `${url.pathname}${url.search}`;
}

async function request<T>(
  path: string,
  params?: Record<string, ParamValue>,
  signal?: AbortSignal,
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(buildUrl(path, params), {
      signal,
      headers: { Accept: "application/json" },
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw new ApiError(
      "The API is unreachable. Start the FastAPI server on port 8000.",
      0,
    );
  }

  if (!response.ok) {
    let detail = `Request failed (${response.status})`;
    try {
      const payload = (await response.json()) as { detail?: string };
      if (payload.detail) detail = payload.detail;
    } catch {
      // keep the generic message
    }
    throw new ApiError(detail, response.status);
  }

  return (await response.json()) as T;
}

export const api = {
  meta: (signal?: AbortSignal) => request<Meta>("/api/meta", undefined, signal),

  latest: (
    params: { delivery_date: string; cutoff: string; calibrated: boolean },
    signal?: AbortSignal,
  ) => request<DayBundle>("/api/forecast/latest", params, signal),

  accuracy: (
    params: { start: string; end: string; cutoff: string },
    signal?: AbortSignal,
  ) => request<AccuracyBundle>("/api/accuracy", params, signal),

  revisions: (
    params: { delivery_date: string; cutoff: string },
    signal?: AbortSignal,
  ) => request<RevisionsBundle>("/api/forecast/revisions", params, signal),

  procurement: (
    params: {
      delivery_date: string;
      demand_gw: number;
      cutoff: string;
      calibrated: boolean;
    },
    signal?: AbortSignal,
  ) => request<ProcurementBundle>("/api/procurement", params, signal),
};

export function forecastCsvUrl(
  deliveryDate: string,
  cutoff: string,
  calibrated = false,
): string {
  return buildUrl("/api/export/forecast.csv", {
    delivery_date: deliveryDate,
    cutoff,
    calibrated,
  });
}

export function accuracyCsvUrl(start: string, end: string, cutoff: string): string {
  return buildUrl("/api/export/accuracy.csv", { start, end, cutoff });
}
