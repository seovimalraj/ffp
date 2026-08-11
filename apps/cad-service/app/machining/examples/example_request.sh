#!/usr/bin/env bash
# Example requests for POST /api/v1/cad/analyze-machining
#
# This endpoint extracts geometry only. It returns no cost, machine selection,
# process selection or price.

set -euo pipefail

HOST="${CAD_SERVICE_URL:-http://localhost:8001}"
ENDPOINT="$HOST/api/v1/cad/analyze-machining"
FILE="${1:-bracket.step}"

# --- 0. Is the CAD kernel available, and what thresholds are in force? -------
curl -sS "$ENDPOINT/capabilities" | jq '{kernel, kernel_available, supported_input_formats, max_upload_bytes}'

# --- 1. Default analysis (metric, individual features, no face dump) ---------
curl -sS -X POST "$ENDPOINT" \
  -F "file=@${FILE}" \
  -o analysis.json

jq '{
  version: .analysis_version,
  units: .units,
  solids: .model.solid_count,
  faces:  .model.face_count,
  volume_mm3: .geometry.volume_mm3,
  holes:    (.features.holes    | length),
  pockets:  (.features.pockets  | length),
  slots:    (.features.slots    | length),
  patterns: (.feature_patterns  | length),
  flags:    [.machining_flags[].flag],
  warnings: [.warnings[].code]
}' analysis.json

# --- 2. Every documented option, set explicitly ------------------------------
curl -sS -X POST "$ENDPOINT" \
  -F "file=@${FILE}" \
  -F "unit_system=metric" \
  -F "include_face_details=true" \
  -F "include_feature_details=true" \
  -F "include_debug_geometry=false" \
  -o analysis_detailed.json

# --- 3. Imperial output ------------------------------------------------------
# Values become inches; field names keep their _mm suffix so the schema is
# stable across unit systems. The top-level "units" field is authoritative.
curl -sS -X POST "$ENDPOINT" \
  -F "file=@${FILE}" \
  -F "unit_system=imperial" \
  | jq '{units, length: .geometry.bounding_box.length_mm}'

# --- 4. What a downstream costing engine would typically consume -------------
# Note there is nothing here to convert into a price without further inputs
# (material, quantity, tolerances, machine) - by design.
jq '{
  stock:        .stock_analysis,
  indicators:   .complexity_indicators,
  constraints:  .machining_constraints,
  setups:       .setup_analysis.candidate_directions,
  ambiguous:    [.features.holes[], .features.pockets[], .features.slots[]]
                | map(select(.status == "ambiguous") | {id, reason})
}' analysis.json

# --- 5. Error handling -------------------------------------------------------
# Unsupported format -> 415
curl -sS -o /dev/null -w 'unsupported format: %{http_code}\n' \
  -X POST "$ENDPOINT" -F "file=@/dev/null;filename=part.stl"
