import type { SheetMetalAnalysisResponse, Vector3 } from "@/types/sheet-metal-analysis";

/**
 * Formatting helpers for the sheet-metal analysis panel.
 *
 * Adapted from `apps/web/app/cad/machining/lib/format.ts`. The analysis
 * reports raw kernel precision, so rounding for display is presentation, not
 * correction - the untouched values are always a click away in the Raw JSON
 * tab.
 */

/** Unit suffix for the payload. `units` is authoritative, not the field names. */
export function unitLabel(result: SheetMetalAnalysisResponse): string {
  return result.units === "in" ? "in" : "mm";
}

export function formatLength(
  value: number | null | undefined,
  unit: string,
  decimals = 2,
): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return `${trimZeros(value.toFixed(decimals))} ${unit}`;
}

export function formatNumber(
  value: number | null | undefined,
  decimals = 2,
): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return trimZeros(value.toFixed(decimals));
}

export function formatArea(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  if (Math.abs(value) >= 100_000) {
    return `${trimZeros((value / 100).toFixed(1))} cm²`;
  }
  return `${value.toLocaleString(undefined, { maximumFractionDigits: 1 })} mm²`;
}

export function formatVolume(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  if (Math.abs(value) >= 1_000_000) {
    return `${trimZeros((value / 1000).toFixed(1))} cm³`;
  }
  return `${value.toLocaleString(undefined, { maximumFractionDigits: 1 })} mm³`;
}

export function formatVector(
  vector: Vector3 | null | undefined,
  decimals = 1,
): string {
  if (!vector) return "—";
  const part = (n: number) => trimZeros(n.toFixed(decimals));
  return `${part(vector.x)}, ${part(vector.y)}, ${part(vector.z)}`;
}

export function formatPercent(ratio: number | null | undefined): string {
  if (ratio === null || ratio === undefined) return "—";
  return `${(ratio * 100).toFixed(1)}%`;
}

export function formatDuration(ms: number | null | undefined): string {
  if (ms === null || ms === undefined) return "—";
  return ms >= 1000 ? `${(ms / 1000).toFixed(2)} s` : `${Math.round(ms)} ms`;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** `bend_radius_too_tight` -> `Bend radius too tight`. */
export function humanize(value: string | null | undefined): string {
  if (!value) return "—";
  const spaced = value.replace(/[_-]+/g, " ").trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1).toLowerCase();
}

function trimZeros(value: string): string {
  return value.includes(".") ? value.replace(/\.?0+$/, "") : value;
}
