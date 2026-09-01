import type {
  AnyMachiningFeature,
  FeatureCollection,
  MachiningAnalysisResponse,
  Vector3,
} from "@/types/machining-analysis";

/**
 * Formatting helpers for the machining analysis panel.
 *
 * The analysis reports raw kernel precision (a 20 mm hole comes back as
 * 20.0000002 because the tool cylinder overshot the block). Rounding for
 * display is presentation, not correction - the untouched values are always a
 * click away in the Raw JSON tab.
 */

/** Unit suffix for the payload. `units` is authoritative, not the field names. */
export function unitLabel(result: MachiningAnalysisResponse): string {
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

/** Large volumes and areas are unreadable in full; scale them once they grow. */
export function formatVolume(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  if (Math.abs(value) >= 1_000_000) {
    return `${trimZeros((value / 1000).toFixed(1))} cm³`;
  }
  return `${value.toLocaleString(undefined, { maximumFractionDigits: 1 })} mm³`;
}

export function formatArea(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  if (Math.abs(value) >= 100_000) {
    return `${trimZeros((value / 100).toFixed(1))} cm²`;
  }
  return `${value.toLocaleString(undefined, { maximumFractionDigits: 1 })} mm²`;
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

/** `counterbore` -> `Counterbore`, `through_slot` -> `Through slot`. */
export function humanize(value: string | null | undefined): string {
  if (!value) return "—";
  const spaced = value.replace(/[_-]+/g, " ").trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1).toLowerCase();
}

function trimZeros(value: string): string {
  return value.includes(".") ? value.replace(/\.?0+$/, "") : value;
}

export interface FeatureGroup {
  key: keyof FeatureCollection;
  label: string;
  /** Plain-language note on what this detector will and will not claim. */
  note: string;
  features: AnyMachiningFeature[];
}

/**
 * Flatten the feature collection into ordered, labelled groups, dropping the
 * empty ones so the panel shows findings rather than a wall of zeros.
 */
export function featureGroups(result: MachiningAnalysisResponse): FeatureGroup[] {
  const f = result.features;
  const groups: FeatureGroup[] = [
    {
      key: "holes",
      label: "Holes",
      note: "Concave cylinders grouped by shared axis. External cylinders are bosses or shafts, never holes.",
      features: f.holes,
    },
    {
      key: "bores",
      label: "Bores",
      note: "Internal cylinders past both the diameter and depth thresholds.",
      features: f.bores,
    },
    {
      key: "internal_cylindrical_features",
      label: "Unresolved internal cylinders",
      note: "Neither clearly a hole nor clearly a bore. Reported as-is rather than guessed.",
      features: f.internal_cylindrical_features,
    },
    {
      key: "pockets",
      label: "Pockets",
      note: "Recessed planar floors enclosed by walls, verified by ray probe so walls are not counted as floors.",
      features: f.pockets,
    },
    {
      key: "slots",
      label: "Slots",
      note: "Pockets past the length-to-width aspect threshold.",
      features: f.slots,
    },
    {
      key: "bosses",
      label: "Bosses",
      note: "Convex cylinders standing proud of a face. Prismatic bosses are not claimed.",
      features: f.bosses,
    },
    {
      key: "grooves",
      label: "Grooves",
      note: "Coaxial bands stepping away from the material on both sides. A shoulder has a neighbour on one side only and is not a groove.",
      features: f.grooves,
    },
    {
      key: "threads",
      label: "Threads",
      note: "From CAD metadata or modelled helical geometry. A designation is never inferred from diameter.",
      features: f.threads,
    },
    {
      key: "fillets",
      label: "Fillets",
      note: "Tangent-continuous blend surfaces.",
      features: f.fillets,
    },
    {
      key: "chamfers",
      label: "Chamfers",
      note: "Narrow planar bands meeting two faces at an angle.",
      features: f.chamfers,
    },
  ];
  return groups.filter((group) => group.features.length > 0);
}

/** One-line dimensional summary per feature type, for the collapsed row. */
export function featureSummary(
  feature: AnyMachiningFeature,
  unit: string,
): string {
  // Each feature variant carries its own dimension fields; read them
  // generically so one formatter covers all nine types.
  const f = feature as unknown as Record<string, unknown>;
  const len = (key: string, decimals = 2) =>
    typeof f[key] === "number"
      ? formatLength(f[key] as number, unit, decimals)
      : null;

  switch (feature.type) {
    case "hole":
    case "bore":
    case "internal_cylindrical_feature": {
      const parts = [`⌀ ${len("diameter_mm")}`, `depth ${len("depth_mm")}`];
      if (typeof f.subtype === "string") parts.push(humanize(f.subtype as string));
      return parts.join(" · ");
    }
    case "pocket":
      return `${len("length_mm")} × ${len("width_mm")} · depth ${len("depth_mm")}`;
    case "slot":
      return `${len("length_mm")} × ${len("width_mm")} · depth ${len(
        "depth_mm",
      )} · ${humanize(f.subtype as string)}`;
    case "boss":
      return `⌀ ${len("diameter_mm")} · height ${len("height_mm")}`;
    case "groove":
      return `⌀ ${len("diameter_mm")} · width ${len("width_mm")} · depth ${len(
        "depth_mm",
      )} · ${humanize(f.subtype as string)}`;
    case "fillet":
      return `R ${len("radius_mm")} · ${f.edge_count} edge(s)`;
    case "chamfer": {
      const angle =
        typeof f.angle_deg === "number"
          ? ` · ${formatNumber(f.angle_deg as number, 1)}°`
          : "";
      return `${len("size_mm")}${angle}`;
    }
    case "thread": {
      const designation =
        typeof f.designation === "string" ? f.designation : "designation unknown";
      return `${designation} · ${humanize(f.thread_type as string)}`;
    }
    default:
      return "";
  }
}

/** Feature position, when the feature type carries one. */
export function featurePosition(
  feature: AnyMachiningFeature,
): Vector3 | null {
  const position = (feature as { position?: Vector3 | null }).position;
  return position ?? null;
}

/** Machining flags keyed by the feature they belong to. */
export function flagsByFeature(
  result: MachiningAnalysisResponse,
): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const flag of result.machining_flags) {
    const existing = map.get(flag.feature_id) ?? [];
    existing.push(flag.flag);
    map.set(flag.feature_id, existing);
  }
  return map;
}

export function accessibilityByFeature(result: MachiningAnalysisResponse) {
  return new Map(result.accessibility.map((entry) => [entry.feature_id, entry]));
}

export function constraintsByFeature(result: MachiningAnalysisResponse) {
  return new Map(
    result.machining_constraints.map((entry) => [entry.feature_id, entry]),
  );
}

/** Directions a feature can be reached from, e.g. `["+Z", "-Z"]`. */
export function accessibleDirections(
  accessibility: Record<string, boolean> | undefined,
): string[] {
  if (!accessibility) return [];
  return Object.entries(accessibility)
    .filter(([, ok]) => ok)
    .map(([direction]) => direction);
}
