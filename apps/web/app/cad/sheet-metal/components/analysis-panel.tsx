"use client";

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  ChevronRight,
  CircleDot,
  Info,
  Layers,
  Ruler,
  Sparkles,
} from "lucide-react";

import type {
  BendFeature,
  SheetMetalAnalysisResponse,
} from "@/types/sheet-metal-analysis";

import {
  formatArea,
  formatDuration,
  formatLength,
  formatNumber,
  formatPercent,
  formatVector,
  formatVolume,
  humanize,
  unitLabel,
} from "../lib/format";

type TabKey = "overview" | "bends" | "features" | "dfm" | "raw";

const TABS: Array<{ key: TabKey; label: string }> = [
  { key: "overview", label: "Overview" },
  { key: "bends", label: "Bends" },
  { key: "features", label: "Features" },
  { key: "dfm", label: "DFM" },
  { key: "raw", label: "Raw JSON" },
];

interface AnalysisPanelProps {
  result: SheetMetalAnalysisResponse;
  selectedFeatureId: string | null;
  onSelectFeature: (featureId: string | null) => void;
}

export function AnalysisPanel({
  result,
  selectedFeatureId,
  onSelectFeature,
}: AnalysisPanelProps) {
  const [tab, setTab] = useState<TabKey>("overview");
  const unit = unitLabel(result);

  return (
    <div className="flex h-full flex-col bg-white">
      <nav className="flex shrink-0 border-b border-slate-200" role="tablist">
        {TABS.map(({ key, label }) => (
          <button
            key={key}
            role="tab"
            aria-selected={tab === key}
            onClick={() => setTab(key)}
            className={`flex-1 px-3 py-2.5 text-xs font-medium transition-colors ${
              tab === key
                ? "border-b-2 border-blue-600 text-blue-700"
                : "border-b-2 border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            {label}
          </button>
        ))}
      </nav>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {tab === "overview" && <OverviewTab result={result} unit={unit} />}
        {tab === "bends" && (
          <BendsTab
            result={result}
            unit={unit}
            selectedFeatureId={selectedFeatureId}
            onSelectFeature={onSelectFeature}
          />
        )}
        {tab === "features" && <FeaturesTab result={result} unit={unit} />}
        {tab === "dfm" && <DfmTab result={result} unit={unit} />}
        {tab === "raw" && <RawTab result={result} />}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Overview                                                            */
/* ------------------------------------------------------------------ */

function OverviewTab({
  result,
  unit,
}: {
  result: SheetMetalAnalysisResponse;
  unit: string;
}) {
  const geometry = result.geometry;
  const candidate = result.sheet_metal_candidate;
  const thickness = result.thickness;
  const indicators = result.complexity_indicators;

  return (
    <div className="space-y-5 p-4">
      {result.warnings.length > 0 && (
        <Section title="Warnings" icon={<AlertTriangle className="h-3.5 w-3.5" />}>
          <div className="space-y-2">
            {result.warnings.map((warning, index) => (
              <div
                key={`${warning.code}-${index}`}
                className="rounded-lg border border-amber-200 bg-amber-50 p-2.5"
              >
                <div className="text-[11px] font-semibold tracking-wide text-amber-800">
                  {warning.code}
                </div>
                <p className="mt-0.5 text-xs leading-relaxed text-amber-900">
                  {warning.message}
                </p>
              </div>
            ))}
          </div>
        </Section>
      )}

      <Section title="Sheet-metal candidate" icon={<Layers className="h-3.5 w-3.5" />}>
        <div className="flex flex-wrap items-center gap-1.5">
          <span
            className={`rounded px-2 py-0.5 text-[11px] font-semibold text-white ${
              candidate.is_candidate ? "bg-emerald-600" : "bg-slate-500"
            }`}
          >
            {candidate.is_candidate ? "Candidate" : "Not a candidate"}
          </span>
          <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-600">
            {candidate.status}
          </span>
          <span className="text-[11px] text-slate-500">
            {formatPercent(candidate.confidence)} confidence
          </span>
        </div>
        <div className="mt-2">
          <DataGrid
            rows={[
              [
                "Paired area fraction",
                formatPercent(candidate.evidence.paired_area_fraction),
              ],
              ["Flatness ratio", formatNumber(candidate.evidence.flatness_ratio, 4)],
              [
                "Dominant thickness",
                formatLength(candidate.evidence.dominant_thickness_mm, unit),
              ],
              ["Method", candidate.evidence.method ?? "—"],
            ]}
          />
        </div>
        {candidate.reason && <Note>{candidate.reason}</Note>}
      </Section>

      <Section title="Thickness" icon={<Ruler className="h-3.5 w-3.5" />}>
        <DataGrid
          rows={[
            [
              "Dominant thickness",
              formatLength(thickness.dominant_thickness_mm, unit),
            ],
            [
              "Uniform",
              thickness.is_uniform === null
                ? "—"
                : thickness.is_uniform
                  ? "Yes"
                  : "No",
            ],
            ["Variance", formatLength(thickness.variance_mm, unit, 3)],
            ["Method", thickness.method ?? "—"],
            ["Samples", String(thickness.sample_count)],
          ]}
        />
        {thickness.note && <Note>{thickness.note}</Note>}
      </Section>

      {geometry && (
        <Section title="Geometry" icon={<Ruler className="h-3.5 w-3.5" />}>
          <DataGrid
            rows={[
              [
                "Bounding box",
                `${formatNumber(geometry.bounding_box.length_mm)} × ${formatNumber(
                  geometry.bounding_box.width_mm,
                )} × ${formatNumber(geometry.bounding_box.height_mm)} ${unit}`,
              ],
              ["Volume", formatVolume(geometry.volume_mm3)],
              ["Surface area", formatArea(geometry.surface_area_mm2)],
              ["Centre of mass", formatVector(geometry.center_of_mass)],
              [
                "Closed volume",
                geometry.is_closed_volume ? "Yes" : "No — measurements unreliable",
              ],
            ]}
          />
        </Section>
      )}

      <Section title="Model" icon={<CircleDot className="h-3.5 w-3.5" />}>
        <DataGrid
          rows={[
            ["Solids", String(result.model.solid_count)],
            ["Faces", String(result.model.face_count)],
            ["Edges", String(result.model.edge_count)],
            ["Vertices", String(result.model.vertex_count)],
            ["Valid B-Rep", result.model.is_valid ? "Yes" : "No"],
            ["Open shells", result.model.has_open_shells ? "Yes" : "No"],
          ]}
        />
      </Section>

      <Section title="Base / flange faces">
        <DataGrid
          rows={[
            [
              "Base face",
              result.faces.base_face_id !== null
                ? `#${result.faces.base_face_id}`
                : "—",
            ],
            ["Flange faces", String(result.faces.flange_faces.length)],
          ]}
        />
        {result.faces.flange_faces.length > 0 && (
          <ul className="mt-2 space-y-1">
            {result.faces.flange_faces.map((flange) => (
              <li
                key={flange.face_id}
                className="flex items-center justify-between rounded-md border border-slate-200 px-2 py-1 text-[11px]"
              >
                <span className="font-mono text-slate-700">
                  #{flange.face_id}
                </span>
                <span className="text-slate-500">
                  {formatArea(flange.area_mm2)}
                  {flange.adjacent_bend_ids.length > 0 &&
                    ` · bends ${flange.adjacent_bend_ids.join(", ")}`}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Feature counts" icon={<Sparkles className="h-3.5 w-3.5" />}>
        <DataGrid
          rows={[
            ["Bends", String(indicators.bend_count)],
            ["Unique bend angles", String(indicators.unique_bend_angle_count)],
            ["Unique bend radii", String(indicators.unique_bend_radius_count)],
            ["Holes", String(indicators.hole_count)],
            ["Cutouts", String(indicators.cutout_count)],
            ["Slots", String(indicators.slot_count)],
            ["Hems", String(indicators.hem_count)],
            [
              "Distinct hole diameters",
              String(indicators.distinct_hole_diameter_count),
            ],
            [
              "Minimum bend radius",
              formatLength(indicators.minimum_bend_radius_mm, unit),
            ],
            [
              "Min feature-to-edge",
              formatLength(indicators.minimum_feature_to_edge_distance_mm, unit),
            ],
            [
              "Min feature-to-bend",
              formatLength(indicators.minimum_feature_to_bend_distance_mm, unit),
            ],
            ["Total features", String(indicators.feature_count_total)],
          ]}
        />
      </Section>

      {result.pmi.available && (
        <Section title="CAD metadata">
          <DataGrid
            rows={[
              ["Part name", result.pmi.part_name ?? "—"],
              ["Part number", result.pmi.part_number ?? "—"],
              ["Revision", result.pmi.revision ?? "—"],
              ["Material", result.pmi.material ?? "—"],
              ["Surface finish", result.pmi.surface_finish ?? "—"],
            ]}
          />
          <Note>Declared by the CAD file, not measured from the geometry.</Note>
        </Section>
      )}

      <Section title="Analysis">
        <DataGrid
          rows={[
            ["Version", result.analysis_version],
            ["Kernel", result.kernel ?? "—"],
            ["Units", result.units],
            ["Duration", formatDuration(result.analysis_duration_ms)],
          ]}
        />
      </Section>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Bends                                                                */
/* ------------------------------------------------------------------ */

function BendsTab({
  result,
  unit,
  selectedFeatureId,
  onSelectFeature,
}: {
  result: SheetMetalAnalysisResponse;
  unit: string;
  selectedFeatureId: string | null;
  onSelectFeature: (featureId: string | null) => void;
}) {
  if (result.bends.length === 0) {
    return (
      <Empty>
        No bends were detected. The part may be flat, or bend detection may
        not have run for this candidate.
      </Empty>
    );
  }

  return (
    <div className="divide-y divide-slate-100">
      <div className="p-4">
        <SectionTitle>
          Bends
          <span className="ml-1.5 font-normal text-slate-400">
            {result.bends.length}
          </span>
        </SectionTitle>
        <ul className="mt-2 space-y-1.5">
          {result.bends.map((bend) => (
            <BendRow
              key={bend.id}
              bend={bend}
              unit={unit}
              expanded={selectedFeatureId === bend.id}
              onToggle={() =>
                onSelectFeature(selectedFeatureId === bend.id ? null : bend.id)
              }
            />
          ))}
        </ul>
      </div>

      <div className="p-4">
        <SectionTitle>
          Bend reliefs
          <span className="ml-1.5 font-normal text-slate-400">
            {result.bend_reliefs.length}
          </span>
        </SectionTitle>
        {result.bend_reliefs.length === 0 ? (
          <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
            None detected.
          </p>
        ) : (
          <ul className="mt-2 space-y-1.5">
            {result.bend_reliefs.map((relief) => (
              <li
                key={relief.id}
                className="rounded-lg border border-slate-200 p-2.5 text-xs"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-[11px] font-semibold text-slate-800">
                    {relief.id}
                  </span>
                  <span
                    className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
                      relief.type === "none-detected"
                        ? "bg-slate-100 text-slate-500"
                        : "bg-blue-100 text-blue-800"
                    }`}
                  >
                    {humanize(relief.type)}
                  </span>
                </div>
                <p className="mt-1 text-[11px] text-slate-600">
                  Bend {relief.bend_id}
                  {relief.width_mm !== null &&
                    ` · width ${formatLength(relief.width_mm, unit)}`}
                  {relief.depth_mm !== null &&
                    ` · depth ${formatLength(relief.depth_mm, unit)}`}
                </p>
                {relief.note && (
                  <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
                    {relief.note}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function BendRow({
  bend,
  unit,
  expanded,
  onToggle,
}: {
  bend: BendFeature;
  unit: string;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <li>
      <button
        onClick={onToggle}
        aria-expanded={expanded}
        className={`w-full rounded-lg border p-2.5 text-left transition-colors ${
          expanded
            ? "border-blue-400 bg-blue-50/60"
            : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
        }`}
      >
        <div className="flex items-start gap-2">
          <ChevronRight
            className={`mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400 transition-transform ${
              expanded ? "rotate-90" : ""
            }`}
          />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="font-mono text-[11px] font-semibold text-slate-800">
                {bend.id}
              </span>
              <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">
                {bend.direction}
              </span>
            </div>
            <p className="mt-0.5 truncate text-xs text-slate-600">
              {formatNumber(bend.angle_deg, 1)}° · R{" "}
              {formatLength(bend.inner_radius_mm, unit)} · length{" "}
              {formatLength(bend.length_mm, unit)}
            </p>
          </div>
        </div>

        {expanded && (
          <div className="mt-3 space-y-2.5 border-t border-blue-200 pt-2.5">
            <DataGrid
              dense
              rows={[
                ["Angle", `${formatNumber(bend.angle_deg, 1)}°`],
                ["Inner radius", formatLength(bend.inner_radius_mm, unit)],
                ["Length", formatLength(bend.length_mm, unit)],
                ["Direction", bend.direction],
                ["Sequence hint", String(bend.sequence_hint)],
                ["K-factor assumed", formatNumber(bend.k_factor_assumed, 3)],
                ["Bend allowance", formatLength(bend.bend_allowance_mm, unit)],
                ["Bend deduction", formatLength(bend.bend_deduction_mm, unit)],
                [
                  "Bend line start",
                  `${formatVector(bend.bend_line.start)} (${unit})`,
                ],
                ["Bend line end", `${formatVector(bend.bend_line.end)} (${unit})`],
                ["Axis", formatVector(bend.axis)],
                [
                  "Adjacent flanges",
                  bend.adjacent_flange_ids.join(", ") || "—",
                ],
                [
                  "Detected by",
                  `${humanize(bend.detection.method)} · ${(
                    bend.detection.confidence * 100
                  ).toFixed(0)}%`,
                ],
              ]}
            />

            {bend.detection.evidence.length > 0 && (
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                  Evidence
                </p>
                <ul className="mt-1 space-y-0.5">
                  {bend.detection.evidence.map((item, index) => (
                    <li
                      key={index}
                      className="text-[11px] leading-relaxed text-slate-600"
                    >
                      • {item}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </button>
    </li>
  );
}

/* ------------------------------------------------------------------ */
/* Features (holes / cutouts / slots / hems / outer profile / patterns) */
/* ------------------------------------------------------------------ */

function FeaturesTab({
  result,
  unit,
}: {
  result: SheetMetalAnalysisResponse;
  unit: string;
}) {
  const empty =
    result.holes.length === 0 &&
    result.cutouts.length === 0 &&
    result.slots.length === 0 &&
    result.hems.length === 0;

  if (!result.options.include_feature_details) {
    return (
      <Empty>
        Individual features were not requested. Re-run with feature details
        enabled to list them.
      </Empty>
    );
  }

  return (
    <div className="divide-y divide-slate-100">
      {empty && (
        <div className="p-4">
          <Empty>
            No holes, cutouts, slots or hems were detected on this part.
          </Empty>
        </div>
      )}

      {result.holes.length > 0 && (
        <div className="p-4">
          <SectionTitle>
            Holes
            <span className="ml-1.5 font-normal text-slate-400">
              {result.holes.length}
            </span>
          </SectionTitle>
          <ul className="mt-2 space-y-1.5">
            {result.holes.map((hole) => (
              <li
                key={hole.id}
                className="rounded-lg border border-slate-200 p-2.5 text-xs"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-[11px] font-semibold text-slate-800">
                    {hole.id}
                  </span>
                  <span className="text-[11px] text-slate-500">
                    {humanize(hole.shape)}
                    {hole.quantity > 1 && ` × ${hole.quantity}`}
                  </span>
                </div>
                <p className="mt-1 text-[11px] text-slate-600">
                  ⌀ {formatLength(hole.diameter_mm, unit)} ·{" "}
                  {formatVector(hole.position)} ({unit})
                </p>
                <p className="mt-1 text-[11px] text-slate-500">
                  edge {formatLength(hole.distance_to_nearest_edge_mm, unit)} ·
                  bend {formatLength(hole.distance_to_nearest_bend_mm, unit)}
                </p>
              </li>
            ))}
          </ul>
        </div>
      )}

      {result.cutouts.length > 0 && (
        <div className="p-4">
          <SectionTitle>
            Cutouts
            <span className="ml-1.5 font-normal text-slate-400">
              {result.cutouts.length}
            </span>
          </SectionTitle>
          <ul className="mt-2 space-y-1.5">
            {result.cutouts.map((cutout) => (
              <li
                key={cutout.id}
                className="rounded-lg border border-slate-200 p-2.5 text-xs"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-[11px] font-semibold text-slate-800">
                    {cutout.id}
                  </span>
                  <span className="text-[11px] text-slate-500">
                    {humanize(cutout.shape_type)}
                  </span>
                </div>
                <p className="mt-1 text-[11px] text-slate-600">
                  perimeter {formatLength(cutout.perimeter_mm, unit)} · area{" "}
                  {formatArea(cutout.area_mm2)}
                </p>
                <p className="mt-1 text-[11px] text-slate-500">
                  min feature {formatLength(cutout.min_feature_size_mm, unit)} ·
                  edge {formatLength(cutout.distance_to_nearest_edge_mm, unit)} ·
                  bend {formatLength(cutout.distance_to_nearest_bend_mm, unit)}
                </p>
              </li>
            ))}
          </ul>
        </div>
      )}

      {result.slots.length > 0 && (
        <div className="p-4">
          <SectionTitle>
            Slots
            <span className="ml-1.5 font-normal text-slate-400">
              {result.slots.length}
            </span>
          </SectionTitle>
          <ul className="mt-2 space-y-1.5">
            {result.slots.map((slot) => (
              <li
                key={slot.id}
                className="rounded-lg border border-slate-200 p-2.5 text-xs"
              >
                <span className="font-mono text-[11px] font-semibold text-slate-800">
                  {slot.id}
                </span>
                <p className="mt-1 text-[11px] text-slate-600">
                  {formatLength(slot.length_mm, unit)} ×{" "}
                  {formatLength(slot.width_mm, unit)}
                  {slot.corner_radius_mm !== null &&
                    ` · R ${formatLength(slot.corner_radius_mm, unit)}`}
                </p>
                <p className="mt-1 text-[11px] text-slate-500">
                  bend {formatLength(slot.distance_to_nearest_bend_mm, unit)}
                </p>
              </li>
            ))}
          </ul>
        </div>
      )}

      {result.hems.length > 0 && (
        <div className="p-4">
          <SectionTitle>
            Hems
            <span className="ml-1.5 font-normal text-slate-400">
              {result.hems.length}
            </span>
          </SectionTitle>
          <ul className="mt-2 space-y-1.5">
            {result.hems.map((hem) => (
              <li
                key={hem.id}
                className="rounded-lg border border-slate-200 p-2.5 text-xs"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-[11px] font-semibold text-slate-800">
                    {hem.id}
                  </span>
                  <span className="text-[11px] text-slate-500">
                    {humanize(hem.type)}
                  </span>
                </div>
                <p className="mt-1 text-[11px] text-slate-600">
                  length {formatLength(hem.length_mm, unit)}
                  {hem.adjacent_flange_id && ` · flange ${hem.adjacent_flange_id}`}
                </p>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="p-4">
        <SectionTitle>Outer profile</SectionTitle>
        <div className="mt-2">
          <DataGrid
            rows={[
              ["Perimeter", formatLength(result.outer_profile.perimeter_mm, unit)],
              [
                "Closed",
                result.outer_profile.is_closed === null
                  ? "—"
                  : result.outer_profile.is_closed
                    ? "Yes"
                    : "No",
              ],
            ]}
          />
        </div>
        {result.outer_profile.validity_issues.length > 0 && (
          <ul className="mt-2 space-y-1.5">
            {result.outer_profile.validity_issues.map((issue, index) => (
              <li
                key={`${issue.code}-${index}`}
                className="rounded-md bg-amber-50 p-2 text-[11px] text-amber-900"
              >
                <span className="font-semibold">{issue.code}</span>{" "}
                {issue.message}
              </li>
            ))}
          </ul>
        )}
      </div>

      {result.feature_patterns.length > 0 && (
        <div className="p-4">
          <SectionTitle>Repeated features</SectionTitle>
          <div className="mt-2 space-y-2">
            {result.feature_patterns.map((pattern) => (
              <div
                key={`${pattern.type}-${pattern.feature_ids.join("-")}`}
                className="rounded-lg border border-blue-200 bg-blue-50/60 p-2.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-blue-900">
                    {pattern.feature_count} × {humanize(pattern.feature_type)}
                  </span>
                  <span className="rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-blue-700">
                    {pattern.pattern_type}
                  </span>
                </div>
                {pattern.spacing_mm !== null && (
                  <p className="mt-1 text-[11px] text-blue-800">
                    spacing {formatLength(pattern.spacing_mm, unit)}
                  </p>
                )}
                <p className="mt-1 font-mono text-[10px] text-blue-600">
                  {pattern.feature_ids.join(", ")}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="p-4">
        <SectionTitle>Symmetry</SectionTitle>
        <div className="mt-2">
          <DataGrid
            rows={[
              ["Has symmetry", result.symmetry.has_symmetry ? "Yes" : "No"],
              ["Type", humanize(result.symmetry.symmetry_type)],
              ["Axis / plane", result.symmetry.axis_or_plane ?? "—"],
              ["Confidence", formatPercent(result.symmetry.confidence)],
            ]}
          />
        </div>
        {result.symmetry.note && <Note>{result.symmetry.note}</Note>}
      </div>

      {result.pmi.available && (
        <div className="p-4">
          <SectionTitle>PMI</SectionTitle>
          <div className="mt-2">
            <DataGrid
              rows={[
                ["Datums", result.pmi.datums.join(", ") || "—"],
                ["Feature names", result.pmi.feature_names.join(", ") || "—"],
                ["Annotations", String(result.pmi.annotations.length)],
                ["GD&T entries", String(result.pmi.gdt.length)],
              ]}
            />
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* DFM (distance flags)                                                 */
/* ------------------------------------------------------------------ */

function DfmTab({
  result,
  unit,
}: {
  result: SheetMetalAnalysisResponse;
  unit: string;
}) {
  return (
    <div className="space-y-5 p-4">
      <Section title="Distance flags" icon={<AlertTriangle className="h-3.5 w-3.5" />}>
        {result.distance_flags.length === 0 ? (
          <p className="text-xs text-slate-500">
            No feature crossed a configured DFM distance threshold.
          </p>
        ) : (
          <div className="space-y-1.5">
            {result.distance_flags.map((flag, index) => (
              <div
                key={`${flag.feature_id}-${flag.flag}-${index}`}
                className="rounded-lg border border-orange-200 bg-orange-50 p-2.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-semibold text-orange-900">
                    {flag.flag}
                  </span>
                  <span className="font-mono text-[10px] text-orange-700">
                    {flag.feature_id} · {flag.feature_type}
                  </span>
                </div>
                <p className="mt-0.5 text-[11px] text-orange-800">
                  {flag.reason}
                </p>
                {(flag.threshold !== null || flag.value !== null) && (
                  <p className="mt-0.5 font-mono text-[11px] text-orange-700">
                    value {formatLength(flag.value, unit)} · threshold{" "}
                    {formatLength(flag.threshold, unit)}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
        <Note>
          Deterministic geometric flags only. No difficulty or cost figure is
          implied - that needs context this service does not have.
        </Note>
      </Section>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Raw                                                                 */
/* ------------------------------------------------------------------ */

function RawTab({ result }: { result: SheetMetalAnalysisResponse }) {
  const json = useMemo(() => JSON.stringify(result, null, 2), [result]);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-2">
        <span className="text-[11px] text-slate-500">
          {(json.length / 1024).toFixed(1)} KB
        </span>
        <div className="flex gap-2">
          <button
            onClick={() => navigator.clipboard?.writeText(json)}
            className="rounded-md border border-slate-200 px-2 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-50"
          >
            Copy
          </button>
          <a
            href={`data:application/json;charset=utf-8,${encodeURIComponent(json)}`}
            download={`${result.file.filename.replace(/\.[^.]+$/, "")}-sheet-metal.json`}
            className="rounded-md border border-slate-200 px-2 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-50"
          >
            Download
          </a>
        </div>
      </div>
      <pre className="min-h-0 flex-1 overflow-auto bg-slate-900 p-3 font-mono text-[10px] leading-relaxed text-slate-100">
        {json}
      </pre>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Primitives                                                          */
/* ------------------------------------------------------------------ */

function Section({
  title,
  icon,
  children,
}: {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section>
      <SectionTitle icon={icon}>{title}</SectionTitle>
      <div className="mt-2">{children}</div>
    </section>
  );
}

function SectionTitle({
  icon,
  children,
}: {
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <h3 className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
      {icon}
      {children}
    </h3>
  );
}

function DataGrid({
  rows,
  dense = false,
}: {
  rows: Array<[string, string]>;
  dense?: boolean;
}) {
  return (
    <dl className={dense ? "space-y-0.5" : "space-y-1"}>
      {rows.map(([label, value]) => (
        <div
          key={label}
          className="flex items-baseline justify-between gap-3 text-xs"
        >
          <dt className="shrink-0 text-slate-500">{label}</dt>
          <dd className="min-w-0 truncate text-right font-medium text-slate-900">
            {value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function Note({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-2 flex gap-1.5 text-[11px] leading-relaxed text-slate-500">
      <Info className="mt-0.5 h-3 w-3 shrink-0" />
      <span>{children}</span>
    </p>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="p-8 text-center text-xs leading-relaxed text-slate-500">
      {children}
    </div>
  );
}
