#!/usr/bin/env bash
# Example requests for POST /api/v1/cad/analyze-sheet-metal
#
# This endpoint extracts geometry and sheet-metal-specific features (bends,
# thickness, holes, cutouts, slots, hems, DFM distance flags). It does not
# unfold the part to a flat pattern, and it returns no cost, machine
# selection, process selection or price.

set -euo pipefail

HOST="${CAD_SERVICE_URL:-http://localhost:8001}"
ENDPOINT="$HOST/api/v1/cad/analyze-sheet-metal"
FILE="${1:-bracket.step}"

# --- 0. Is the CAD kernel available, and what thresholds are in force? -------
curl -sS "$ENDPOINT/capabilities" | jq '{kernel, kernel_available, supported_input_formats, max_upload_bytes, thresholds}'

# --- 1. Default analysis (metric, individual features, no face dump) ---------
curl -sS -X POST "$ENDPOINT" \
  -F "file=@${FILE}" \
  -o analysis.json

jq '{
  version: .analysis_version,
  units: .units,
  is_sheet_metal_candidate: .sheet_metal_candidate.is_candidate,
  candidate_status: .sheet_metal_candidate.status,
  thickness_mm: .thickness.dominant_thickness_mm,
  bends:   (.bends   | length),
  holes:   (.holes   | length),
  cutouts: (.cutouts | length),
  slots:   (.slots   | length),
  hems:    (.hems    | length),
  patterns: (.feature_patterns | length),
  distance_flags: [.distance_flags[].flag],
  warnings: [.warnings[].code]
}' analysis.json

# --- 2. Every documented option, set explicitly ------------------------------
curl -sS -X POST "$ENDPOINT" \
  -F "file=@${FILE}" \
  -F "unit_system=metric" \
  -F "include_feature_details=true" \
  -F "include_face_details=true" \
  -F "include_debug_geometry=false" \
  -F "include_topology_entities=false" \
  -o analysis_detailed.json

# --- 3. Imperial output ------------------------------------------------------
# Values become inches; field names keep their _mm suffix so the schema is
# stable across unit systems. The top-level "units" field is authoritative.
curl -sS -X POST "$ENDPOINT" \
  -F "file=@${FILE}" \
  -F "unit_system=imperial" \
  | jq '{units, length: .geometry.bounding_box.length_mm}'

# --- 4. What a downstream costing/quoting engine would typically consume -----
# Note there is nothing here to convert into a price without further inputs
# (material, quantity, tolerances, machine) - by design. Flat-pattern
# unfolding is also out of scope: no blank size is reported.
jq '{
  candidate:    .sheet_metal_candidate,
  thickness:    .thickness,
  indicators:   .complexity_indicators,
  symmetry:     .symmetry,
  flags:        .distance_flags
}' analysis.json

# The sheet_metal_candidate block itself is the place to check for ambiguity -
# a rejected/ambiguous candidate still returns a full response, with every
# sheet-metal-specific section empty and "reason" explaining why:
jq 'if .sheet_metal_candidate.status != "resolved"
    then {status: .sheet_metal_candidate.status, reason: .sheet_metal_candidate.reason}
    else "resolved candidate" end' analysis.json

# --- 5. Error handling -------------------------------------------------------
# Unsupported format -> 415
curl -sS -o /dev/null -w 'unsupported format: %{http_code}\n' \
  -X POST "$ENDPOINT" -F "file=@/dev/null;filename=part.stl"
