#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
BUILD_ROOT=$(cd "${SCRIPT_DIR}/.." && pwd)
UPSTREAM_DIR="${BUILD_ROOT}/upstream-src"
BUILD_DIR="${BUILD_ROOT}/build"
DIST_DIR="${BUILD_ROOT}/dist"

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker required to rebuild OCCT wasm. Install Docker Desktop and rerun."
  exit 1
fi

if [[ ! -d "${UPSTREAM_DIR}" ]]; then
  echo "[build-docker] missing upstream source directory: ${UPSTREAM_DIR}" >&2
  exit 1
fi

if [[ ! -f "${UPSTREAM_DIR}/package.json" ]]; then
  echo "[build-docker] upstream source is incomplete: ${UPSTREAM_DIR}" >&2
  exit 1
fi

if [[ ! -d "${UPSTREAM_DIR}/occt/src" ]]; then
  echo "[build-docker] missing upstream OCCT source tree at ${UPSTREAM_DIR}/occt/src" >&2
  echo "[build-docker] npm pack payload does not include the occt submodule; rebuild cannot proceed from this source bundle alone." >&2
  exit 1
fi

rm -rf "${BUILD_DIR}" "${DIST_DIR}"
mkdir -p "${BUILD_DIR}" "${DIST_DIR}"

if [[ -x "${UPSTREAM_DIR}/tools/build_wasm.sh" ]]; then
  echo "[build-docker] running upstream docker build script"
  docker run --rm \
    -v "${UPSTREAM_DIR}:/work" \
    -w /work \
    emscripten/emsdk:3.1.74 \
    bash -lc './tools/build_wasm.sh'
else
  echo "[build-docker] running emscripten fallback build"
  docker run --rm \
    -v "${UPSTREAM_DIR}:/work" \
    -w /work \
    emscripten/emsdk:3.1.74 \
    bash -lc '
      set -euo pipefail
      emcmake cmake -B build/wasm -G "Unix Makefiles" -DEMSCRIPTEN=1 -DCMAKE_BUILD_TYPE=Release .
      emmake make -C build/wasm -j"$(nproc || sysctl -n hw.ncpu || echo 4)"
    '
fi

find_artifact() {
  local name="$1"
  find "${UPSTREAM_DIR}" -type f -name "${name}" \
    ! -path '*/node_modules/*' \
    ! -path '*/.git/*' | awk 'NF' | sort
}

mapfile -t JS_CANDIDATES < <(find_artifact 'occt-import-js.js')
mapfile -t WASM_CANDIDATES < <(find_artifact 'occt-import-js.wasm')

if [[ ${#JS_CANDIDATES[@]} -eq 0 || ${#WASM_CANDIDATES[@]} -eq 0 ]]; then
  echo "[build-docker] failed to locate built occt-import-js artifacts under ${UPSTREAM_DIR}" >&2
  exit 1
fi

JS_SRC=$(ls -1t "${JS_CANDIDATES[@]}" | head -n 1)
WASM_SRC=$(ls -1t "${WASM_CANDIDATES[@]}" | head -n 1)

cp "${JS_SRC}" "${DIST_DIR}/occt-import-js.js"
cp "${WASM_SRC}" "${DIST_DIR}/occt-import-js.wasm"

if [[ ! -f "${DIST_DIR}/occt-import-js.js" || ! -f "${DIST_DIR}/occt-import-js.wasm" ]]; then
  echo "[build-docker] dist artifacts were not produced" >&2
  exit 1
fi

echo "[build-docker] built artifacts"
echo "[build-docker] JS:   ${DIST_DIR}/occt-import-js.js"
echo "[build-docker] WASM: ${DIST_DIR}/occt-import-js.wasm"
