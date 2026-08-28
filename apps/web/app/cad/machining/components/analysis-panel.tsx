"use client";

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  Box,
  ChevronRight,
  CircleDot,
  Info,
  Ruler,
  Sparkles,
} from "lucide-react";

import type {
  AnyMachiningFeature,
  MachiningAnalysisResponse,
  StockForm,
} from "@/types/machining-analysis";

import {
  accessibilityByFeature,
  accessibleDirections,
  constraintsByFeature,
  featureGroups,
  featurePosition,
  featureSummary,
  flagsByFeature,
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

type TabKey = "overview" | "features" | "manufacturing" | "raw";

const TABS: Array<{ key: TabKey; label: string }> = [
  { key: "overview", label: "Overview" },
  { key: "features", label: "Features" },
  { key: "manufacturing", label: "Manufacturing" },
  { key: "raw", label: "Raw JSON" },
];

interface AnalysisPanelProps {
  result: MachiningAnalysisResponse;
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
        {tab === "features" && (
          <FeaturesTab
            result={result}
            unit={unit}
            selectedFeatureId={selectedFeatureId}
            onSelectFeature={onSelectFeature}
          />
        )}
        {tab === "manufacturing" && (
          <ManufacturingTab result={result} unit={unit} />
        )}
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
  result: MachiningAnalysisResponse;
  unit: string;
}) {
  const geometry = result.geometry;
  const stock = result.stock_analysis;
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

      <Section title="Surface types">
        <div className="flex flex-wrap gap-1.5">
          {(
            [
              ["Planar", result.surface_summary.planar_faces],
              ["Cylindrical", result.surface_summary.cylindrical_faces],
              ["Conical", result.surface_summary.conical_faces],
              ["Spherical", result.surface_summary.spherical_faces],
              ["Toroidal", result.surface_summary.toroidal_faces],
              ["Free-form", result.surface_summary.freeform_faces],
              ["Other", result.surface_summary.other_faces],
            ] as Array<[string, number]>
          )
            .filter(([, count]) => count > 0)
            .map(([label, count]) => (
              <span
                key={label}
                className="rounded-md bg-slate-100 px-2 py-1 text-[11px] font-medium text-slate-700"
              >
                {label} <span className="text-slate-400">·</span> {count}
              </span>
            ))}
        </div>
        <p className="mt-2 text-[11px] leading-relaxed text-slate-500">
          {result.surface_summary.internal_cylindrical_faces} internal (concave)
          and {result.surface_summary.external_cylindrical_faces} external
          (convex) cylindrical faces. That distinction is what separates a hole
          from a shaft.
        </p>
      </Section>

      <Section title="Feature counts" icon={<Sparkles className="h-3.5 w-3.5" />}>
        <DataGrid
          rows={[
            ["Holes", String(indicators.hole_count)],
            ["Deep holes", String(indicators.deep_hole_count)],
            ["Bores", String(indicators.bore_count)],
            ["Pockets", String(indicators.pocket_count)],
            ["Slots", String(indicators.slot_count)],
            ["Bosses", String(indicators.boss_count)],
            ["Threads", String(indicators.thread_count)],
            ["Fillets", String(indicators.fillet_count)],
            ["Chamfers", String(indicators.chamfer_count)],
            ["Free-form surfaces", String(indicators.freeform_surface_count)],
            ["Thin walls", String(indicators.thin_wall_count)],
            ["Total features", String(indicators.feature_count_total)],
          ]}
        />
      </Section>

      {stock && (
        <Section title="Stock estimate">
          <DataGrid
            rows={[
              [
                "Stock size",
                `${formatNumber(stock.stock_dimensions_mm.length)} × ${formatNumber(
                  stock.stock_dimensions_mm.width,
                )} × ${formatNumber(stock.stock_dimensions_mm.height)} ${unit}`,
              ],
              ["Allowance per side", formatLength(stock.allowance_per_side_mm, unit)],
              ["Stock volume", formatVolume(stock.stock_volume_mm3)],
              ["Finished volume", formatVolume(stock.finished_volume_mm3)],
              ["Removed volume", formatVolume(stock.removed_volume_mm3)],
              ["Material removed", formatPercent(stock.material_removal_ratio)],
            ]}
          />
          <Note>{stock.note}</Note>
        </Section>
      )}

      {stock?.stock_form && (
        <StockFormSection form={stock.stock_form} unit={unit} />
      )}

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
          <Note>
            Declared by the CAD file, not measured from the geometry.
          </Note>
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
/* Features                                                            */
/* ------------------------------------------------------------------ */

function FeaturesTab({
  result,
  unit,
  selectedFeatureId,
  onSelectFeature,
}: {
  result: MachiningAnalysisResponse;
  unit: string;
  selectedFeatureId: string | null;
  onSelectFeature: (featureId: string | null) => void;
}) {
  const groups = useMemo(() => featureGroups(result), [result]);
  const flags = useMemo(() => flagsByFeature(result), [result]);
  const access = useMemo(() => accessibilityByFeature(result), [result]);
  const constraints = useMemo(() => constraintsByFeature(result), [result]);

  if (!result.options.include_feature_details) {
    return (
      <Empty>
        Individual features were not requested. Re-run with feature details
        enabled to list them.
      </Empty>
    );
  }

  if (groups.length === 0) {
    return (
      <Empty>
        No machining features were detected. The part may be a plain solid, or
        its features may fall below the configured thresholds.
      </Empty>
    );
  }

  return (
    <div className="divide-y divide-slate-100">
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
                <p className="mt-1 text-[11px] text-blue-800">
                  {pattern.diameter_mm !== null &&
                    `⌀ ${formatNumber(pattern.diameter_mm)} ${unit}`}
                  {pattern.spacing_mm !== null &&
                    ` · spacing ${formatNumber(pattern.spacing_mm)} ${unit}`}
                </p>
                <p className="mt-1 font-mono text-[10px] text-blue-600">
                  {pattern.feature_ids.join(", ")}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {groups.map((group) => (
        <div key={group.key} className="p-4">
          <SectionTitle>
            {group.label}
            <span className="ml-1.5 font-normal text-slate-400">
              {group.features.length}
            </span>
          </SectionTitle>
          <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
            {group.note}
          </p>
          <ul className="mt-2 space-y-1.5">
            {group.features.map((feature) => (
              <FeatureRow
                key={feature.id}
                feature={feature}
                unit={unit}
                expanded={selectedFeatureId === feature.id}
                flags={flags.get(feature.id) ?? []}
                directions={accessibleDirections(
                  access.get(feature.id)?.accessibility,
                )}
                maxToolDiameter={
                  constraints.get(feature.id)?.tooling_constraints
                    .maximum_tool_diameter_mm ?? null
                }
                onToggle={() =>
                  onSelectFeature(
                    selectedFeatureId === feature.id ? null : feature.id,
                  )
                }
              />
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

function FeatureRow({
  feature,
  unit,
  expanded,
  flags,
  directions,
  maxToolDiameter,
  onToggle,
}: {
  feature: AnyMachiningFeature;
  unit: string;
  expanded: boolean;
  flags: string[];
  directions: string[];
  maxToolDiameter: number | null;
  onToggle: () => void;
}) {
  const ambiguous = feature.status === "ambiguous";
  const position = featurePosition(feature);

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
                {feature.id}
              </span>
              {ambiguous && (
                <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-800">
                  ambiguous
                </span>
              )}
              {flags.map((flag) => (
                <span
                  key={flag}
                  className="rounded bg-orange-100 px-1.5 py-0.5 text-[10px] font-medium text-orange-800"
                >
                  {flag}
                </span>
              ))}
            </div>
            <p className="mt-0.5 truncate text-xs text-slate-600">
              {featureSummary(feature, unit)}
            </p>
          </div>
        </div>

        {expanded && (
          <div className="mt-3 space-y-2.5 border-t border-blue-200 pt-2.5">
            {ambiguous && feature.reason && (
              <p className="rounded-md bg-amber-50 p-2 text-[11px] leading-relaxed text-amber-900">
                {feature.reason}
              </p>
            )}

            <DataGrid
              dense
              rows={[
                ...(position
                  ? ([["Position", `${formatVector(position)} (${unit})`]] as Array<
                      [string, string]
                    >)
                  : []),
                ...(directions.length > 0
                  ? ([["Reachable from", directions.join(", ")]] as Array<
                      [string, string]
                    >)
                  : []),
                ...(maxToolDiameter !== null
                  ? ([
                      [
                        "Max tool ⌀",
                        formatLength(maxToolDiameter, unit),
                      ],
                    ] as Array<[string, string]>)
                  : []),
                ["Faces", feature.face_ids.join(", ") || "—"],
                [
                  "Detected by",
                  `${humanize(feature.detection.method)} · ${(
                    feature.detection.confidence * 100
                  ).toFixed(0)}%`,
                ],
              ]}
            />

            {feature.detection.evidence.length > 0 && (
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                  Evidence
                </p>
                <ul className="mt-1 space-y-0.5">
                  {feature.detection.evidence.map((item, index) => (
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
/* Manufacturing                                                       */
/* ------------------------------------------------------------------ */

function ManufacturingTab({
  result,
  unit,
}: {
  result: MachiningAnalysisResponse;
  unit: string;
}) {
  const setup = result.setup_analysis;
  const indicators = result.complexity_indicators;
  const reachable = setup.candidate_directions.filter(
    (d) => d.accessible_feature_count > 0,
  );

  return (
    <div className="space-y-5 p-4">
      <Section title="Setup candidates">
        {reachable.length === 0 ? (
          <p className="text-xs text-slate-500">
            No features with a measurable approach direction.
          </p>
        ) : (
          <div className="space-y-1.5">
            {reachable.map((direction) => {
              const max = reachable[0].accessible_feature_count || 1;
              const width = (direction.accessible_feature_count / max) * 100;
              return (
                <div key={direction.direction}>
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-mono font-semibold text-slate-700">
                      {direction.direction}
                    </span>
                    <span className="text-slate-500">
                      {direction.accessible_feature_count} feature
                      {direction.accessible_feature_count === 1 ? "" : "s"}
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-blue-500"
                      style={{ width: `${width}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
        <DataGrid
          dense
          rows={[
            [
              "Directions to cover all",
              setup.minimum_direction_count_covering_all !== null
                ? String(setup.minimum_direction_count_covering_all)
                : "—",
            ],
            ["Requires rotation", setup.requires_rotation ? "Yes" : "No"],
            [
              "Unreachable",
              setup.unreachable_feature_ids.length > 0
                ? setup.unreachable_feature_ids.join(", ")
                : "None",
            ],
          ]}
        />
        <Note>{setup.note}</Note>
      </Section>

      <Section title="Tooling constraints">
        {result.machining_constraints.length === 0 ? (
          <p className="text-xs text-slate-500">
            No internal corner radii were found, so no tool diameter is
            geometrically constrained.
          </p>
        ) : (
          <>
            <div className="space-y-1.5">
              {result.machining_constraints.map((constraint) => (
                <div
                  key={constraint.feature_id}
                  className="flex items-center justify-between rounded-lg border border-slate-200 px-2.5 py-2"
                >
                  <span className="font-mono text-[11px] text-slate-700">
                    {constraint.feature_id}
                  </span>
                  <span className="text-[11px] text-slate-600">
                    R{" "}
                    {formatNumber(
                      constraint.tooling_constraints.minimum_internal_radius_mm,
                    )}{" "}
                    → max tool ⌀{" "}
                    <strong className="text-slate-900">
                      {formatNumber(
                        constraint.tooling_constraints.maximum_tool_diameter_mm,
                      )}{" "}
                      {unit}
                    </strong>
                  </span>
                </div>
              ))}
            </div>
            <Note>
              A geometric ceiling only — a tool of diameter d cannot cut a corner
              of radius below d/2. No cutting parameters or tool selection are
              implied.
            </Note>
          </>
        )}
      </Section>

      <Section title="Machining flags">
        {result.machining_flags.length === 0 ? (
          <p className="text-xs text-slate-500">
            No feature crossed a configured threshold.
          </p>
        ) : (
          <div className="space-y-1.5">
            {result.machining_flags.map((flag, index) => (
              <div
                key={`${flag.feature_id}-${flag.flag}-${index}`}
                className="rounded-lg border border-orange-200 bg-orange-50 p-2.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-semibold text-orange-900">
                    {flag.flag}
                  </span>
                  <span className="font-mono text-[10px] text-orange-700">
                    {flag.feature_id}
                  </span>
                </div>
                <p className="mt-0.5 font-mono text-[11px] text-orange-800">
                  {flag.reason}
                </p>
              </div>
            ))}
          </div>
        )}
      </Section>

      <Section title="Complexity indicators">
        <DataGrid
          rows={[
            [
              "Minimum internal radius",
              formatLength(indicators.minimum_internal_radius_mm, unit),
            ],
            [
              "Max depth/diameter",
              formatNumber(indicators.maximum_depth_diameter_ratio),
            ],
            [
              "Distinct hole diameters",
              String(indicators.distinct_hole_diameter_count),
            ],
            [
              "Distinct tool constraints",
              String(indicators.unique_tool_diameter_constraints),
            ],
            ["Accessible directions", String(indicators.accessible_directions)],
          ]}
        />
        <Note>
          Deterministic counts only. Weighing these into a difficulty or cost
          figure needs context this service does not have — quantity, material,
          machine and tolerances.
        </Note>
      </Section>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Raw                                                                 */
/* ------------------------------------------------------------------ */

function RawTab({ result }: { result: MachiningAnalysisResponse }) {
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
            download={`${result.file.filename.replace(/\.[^.]+$/, "")}-machining.json`}
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

/**
 * Which mill form the envelope resembles - sheet, plate or bar.
 *
 * Deliberately framed as a geometric observation. The service does not know
 * the alloy, what the shop stocks, or what anything costs, so the wording here
 * must not read as "buy this".
 */
function StockFormSection({
  form,
  unit,
}: {
  form: StockForm;
  unit: string;
}) {
  const ambiguous = form.status === "ambiguous";
  const dims = form.sorted_dimensions_mm;
  const sheet = form.sheet_evidence;

  return (
    <Section title="Stock form" icon={<Box className="h-3.5 w-3.5" />}>
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="rounded bg-slate-800 px-2 py-0.5 text-[11px] font-semibold text-white">
          {humanize(form.form)}
        </span>
        {ambiguous && (
          <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-800">
            ambiguous
          </span>
        )}
        {sheet?.formed && (
          <span className="rounded bg-sky-100 px-1.5 py-0.5 text-[10px] font-medium text-sky-800">
            formed
          </span>
        )}
        {form.bounds_method === "aabb" && (
          <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">
            axis-aligned bounds
          </span>
        )}
      </div>

      {ambiguous && form.reason && (
        <p className="mt-2 rounded-md bg-amber-50 p-2 text-[11px] leading-relaxed text-amber-900">
          {form.reason}
          {form.candidate_forms.length > 0 && (
            <>
              {" "}
              Candidates: {form.candidate_forms.map(humanize).join(", ")}.
            </>
          )}
        </p>
      )}

      <div className="mt-2">
        <DataGrid
          rows={[
            [
              "Envelope",
              `${formatNumber(dims.length)} × ${formatNumber(
                dims.width,
              )} × ${formatNumber(dims.height)} ${unit}`,
            ],
            ...(sheet
              ? ([
                  ["Wall thickness", formatLength(sheet.wall_thickness_mm, unit)],
                  ["Wall area", formatPercent(sheet.paired_area_fraction)],
                ] as Array<[string, string]>)
              : []),
            ["Thickness", formatLength(form.thickness_mm, unit)],
            ["Thickness / width", formatNumber(form.flatness_ratio, 3)],
            ["Width / length", formatNumber(form.slenderness_ratio, 3)],
            ...(form.round_evidence
              ? ([
                  [
                    "Outside radius",
                    formatLength(form.round_evidence.radius_mm, unit),
                  ],
                  [
                    "Cylinder covers",
                    formatPercent(form.round_evidence.axial_coverage),
                  ],
                ] as Array<[string, string]>)
              : []),
          ]}
        />
      </div>

      {sheet?.formed && (
        <Note>
          The part is bent or drawn, so the envelope above is the folded part —
          not the flat blank. This analysis does not unfold it.
        </Note>
      )}
      {form.bounds_method === "aabb" && (
        <Note>
          Measured from the axis-aligned bounding box - no oriented box was
          available. A part modelled off-axis can be misjudged.
        </Note>
      )}
      <Note>{form.note}</Note>
    </Section>
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
