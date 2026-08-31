"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useDropzone } from "react-dropzone";
import {
  AlertCircle,
  Cpu,
  FileCode,
  Loader2,
  RefreshCw,
  Upload,
  X,
} from "lucide-react";

import { CadViewer } from "@/components/cad/cad-viewer";
import type {
  MachiningAnalysisResponse,
  MachiningCapabilities,
  MachiningAnalysisResult,
} from "@/types/machining-analysis";
import { isMachiningError } from "@/types/machining-analysis";

import { AnalysisPanel } from "./components/analysis-panel";
import { formatBytes, formatDuration, humanize } from "./lib/format";

/**
 * CAD machining analysis workbench.
 *
 * Uploads a B-Rep file to `/api/cad/analyze-machining` (which proxies the CAD
 * service), renders the solid in the shared CadViewer, and shows the extracted
 * geometry alongside it.
 *
 * Everything displayed here is measured geometry. Nothing on this page is a
 * cost, a machine choice or a price - including the stock form, which describes
 * the proportions of the envelope and not what to buy.
 */

/** The CAD service only accepts B-Rep formats; mesh formats have no topology. */
const ACCEPTED_EXTENSIONS = [".step", ".stp", ".iges", ".igs", ".brep", ".brp"];
const DROPZONE_ACCEPT: Record<string, string[]> = {
  "model/step": [".step", ".stp"],
  "model/iges": [".iges", ".igs"],
  "application/octet-stream": ACCEPTED_EXTENSIONS,
};

type Status =
  | { kind: "idle" }
  | { kind: "analyzing" }
  | { kind: "done"; result: MachiningAnalysisResponse }
  | { kind: "error"; code: string; message: string };

export default function MachiningAnalysisPage() {
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [capabilities, setCapabilities] = useState<MachiningCapabilities | null>(
    null,
  );
  const [selectedFeatureId, setSelectedFeatureId] = useState<string | null>(null);
  const [includeFaceDetails, setIncludeFaceDetails] = useState(false);

  // Abort an in-flight analysis when a new file is dropped, so a slow response
  // for the previous part cannot overwrite the new one.
  const requestRef = useRef<AbortController | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/cad/analyze-machining")
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (!cancelled && data && typeof data.kernel_available === "boolean") {
          setCapabilities(data as MachiningCapabilities);
        }
      })
      .catch(() => {
        /* The badge is informational; a failure here must not block uploads. */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => () => requestRef.current?.abort(), []);

  const analyze = useCallback(
    async (target: File, withFaceDetails: boolean) => {
      requestRef.current?.abort();
      const controller = new AbortController();
      requestRef.current = controller;

      setStatus({ kind: "analyzing" });
      setSelectedFeatureId(null);

      const body = new FormData();
      body.append("file", target);
      body.append("unit_system", "metric");
      body.append("include_feature_details", "true");
      body.append("include_face_details", String(withFaceDetails));
      body.append("include_debug_geometry", "false");

      try {
        const response = await fetch("/api/cad/analyze-machining", {
          method: "POST",
          body,
          signal: controller.signal,
        });
        const payload = (await response.json()) as MachiningAnalysisResult;

        if (!response.ok || isMachiningError(payload)) {
          const error = isMachiningError(payload) ? payload.errors[0] : undefined;
          setStatus({
            kind: "error",
            code: error?.code ?? `HTTP_${response.status}`,
            message: error?.message ?? "The analysis failed.",
          });
          return;
        }
        setStatus({ kind: "done", result: payload });
      } catch (error) {
        if ((error as Error).name === "AbortError") return;
        setStatus({
          kind: "error",
          code: "NETWORK_ERROR",
          message:
            error instanceof Error ? error.message : "The request failed.",
        });
      }
    },
    [],
  );

  const onDrop = useCallback(
    (accepted: File[]) => {
      const next = accepted[0];
      if (!next) return;
      setFile(next);
      void analyze(next, includeFaceDetails);
    },
    [analyze, includeFaceDetails],
  );

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    onDrop,
    accept: DROPZONE_ACCEPT,
    multiple: false,
    noClick: true,
  });

  const clear = () => {
    requestRef.current?.abort();
    setFile(null);
    setStatus({ kind: "idle" });
    setSelectedFeatureId(null);
  };

  const kernelReady = capabilities?.kernel_available ?? true;
  // A binding that imports but is missing symbols is a broken install, not an
  // absent one - the distinction is what points at the environment rather than
  // at the uploaded file, so the badge must not report both the same way.
  const kernelIncomplete =
    !kernelReady && capabilities?.kernel_binding_importable === true;
  const kernelTitle = kernelReady
    ? `CAD kernel: ${capabilities?.kernel}`
    : kernelIncomplete
      ? `CAD kernel ${capabilities?.kernel} loaded but incomplete - missing ${
          capabilities?.kernel_missing_symbols?.join(", ") || "required symbols"
        }. This is a CAD service environment problem, not a problem with your file.`
      : "No OpenCASCADE binding installed on the CAD service";

  return (
    <div className="flex h-screen flex-col bg-slate-50 text-slate-900">
      <header className="flex shrink-0 items-center justify-between gap-4 border-b border-slate-200 bg-white/80 px-6 py-3 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-blue-600 p-2 shadow-lg shadow-blue-600/20">
            <FileCode className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-semibold tracking-tight">
              Machining Analysis
            </h1>
            <p className="text-xs text-slate-500">
              Deterministic CNC geometry extraction — no cost or pricing
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {capabilities && (
            <span
              className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium ${
                kernelReady
                  ? "bg-emerald-50 text-emerald-700"
                  : "bg-red-50 text-red-700"
              }`}
              title={kernelTitle}
            >
              <Cpu className="h-3 w-3" />
              {kernelReady
                ? capabilities.kernel
                : kernelIncomplete
                  ? "Kernel incomplete"
                  : "Kernel unavailable"}
            </span>
          )}

          {file && (
            <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 shadow-sm">
              <span className="max-w-[220px] truncate text-sm font-medium text-slate-700">
                {file.name}
              </span>
              <span className="text-[11px] text-slate-400">
                {formatBytes(file.size)}
              </span>
              <button
                onClick={clear}
                aria-label="Clear file"
                className="rounded-full p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          {file && status.kind !== "analyzing" && (
            <button
              onClick={() => void analyze(file, includeFaceDetails)}
              className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Re-analyze
            </button>
          )}

          <button
            onClick={open}
            className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white shadow-sm transition-colors hover:bg-blue-700"
          >
            {file ? "Replace file" : "Upload CAD file"}
          </button>
        </div>
      </header>

      {!kernelReady && (
        <div className="shrink-0 border-b border-red-200 bg-red-50 px-6 py-2 text-xs text-red-800">
          The CAD service has no OpenCASCADE binding installed, so analysis will
          return 503. Install <code className="font-mono">cadquery-ocp</code>{" "}
          (pip) or <code className="font-mono">pythonocc-core</code> (conda).
        </div>
      )}

      <div {...getRootProps()} className="relative flex min-h-0 flex-1">
        <input {...getInputProps()} />

        {isDragActive && (
          <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center bg-blue-50/80 backdrop-blur-sm">
            <div className="rounded-2xl border-2 border-dashed border-blue-500 bg-white px-10 py-8 text-center shadow-lg">
              <Upload className="mx-auto h-8 w-8 text-blue-600" />
              <p className="mt-2 text-sm font-medium text-blue-900">
                Drop to analyze
              </p>
            </div>
          </div>
        )}

        {file ? (
          <>
            <section className="relative min-w-0 flex-1 bg-white">
              <CadViewer
                file={file}
                showControls
                className="h-full w-full"
                backgroundColor="#ffffff"
              />

              {status.kind === "analyzing" && (
                <div className="absolute bottom-4 left-4 flex items-center gap-2 rounded-lg border border-slate-200 bg-white/95 px-3 py-2 shadow-lg backdrop-blur">
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-600" />
                  <span className="text-xs text-slate-700">
                    Extracting geometry…
                  </span>
                </div>
              )}

              {status.kind === "done" && (
                <div className="absolute bottom-4 left-4 rounded-lg border border-slate-200 bg-white/95 px-3 py-2 text-[11px] text-slate-600 shadow-lg backdrop-blur">
                  {status.result.model.face_count} faces ·{" "}
                  {status.result.complexity_indicators.feature_count_total}{" "}
                  features · {formatDuration(status.result.analysis_duration_ms)}
                  {status.result.stock_analysis?.stock_form?.form && (
                    <>
                      {" · "}
                      {humanize(status.result.stock_analysis.stock_form.form)}
                    </>
                  )}
                </div>
              )}
            </section>

            <aside className="flex w-[420px] shrink-0 flex-col border-l border-slate-200 bg-white">
              {status.kind === "analyzing" && (
                <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
                  <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
                  <p className="text-sm font-medium text-slate-700">
                    Analyzing {file.name}
                  </p>
                  <p className="max-w-[260px] text-xs leading-relaxed text-slate-500">
                    Reading the B-Rep, classifying faces and recognising
                    machining features. Large assemblies can take a while.
                  </p>
                </div>
              )}

              {status.kind === "error" && (
                <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
                  <AlertCircle className="h-6 w-6 text-red-500" />
                  <p className="font-mono text-[11px] font-semibold text-red-700">
                    {status.code}
                  </p>
                  <p className="max-w-[280px] text-xs leading-relaxed text-slate-600">
                    {status.message}
                  </p>
                  <button
                    onClick={() => void analyze(file, includeFaceDetails)}
                    className="mt-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                  >
                    Try again
                  </button>
                </div>
              )}

              {status.kind === "done" && (
                <AnalysisPanel
                  result={status.result}
                  selectedFeatureId={selectedFeatureId}
                  onSelectFeature={setSelectedFeatureId}
                />
              )}

              {status.kind === "idle" && (
                <div className="flex flex-1 items-center justify-center p-8 text-center text-xs text-slate-500">
                  Upload a STEP, IGES or BREP file to analyze.
                </div>
              )}
            </aside>
          </>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center p-8">
            <div
              className={`flex w-full max-w-md flex-col items-center space-y-5 rounded-3xl border-2 border-dashed p-12 text-center transition-all duration-300 ${
                isDragActive
                  ? "scale-105 border-blue-500 bg-blue-50/50 shadow-lg"
                  : "border-slate-200 bg-white shadow-sm"
              }`}
            >
              <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-slate-50">
                <Upload className="h-8 w-8 text-slate-400" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-slate-900">
                  Drop a CAD file to analyze
                </h2>
                <p className="mt-1.5 text-sm leading-relaxed text-slate-500">
                  Extracts holes, pockets, slots, bosses, fillets, chamfers,
                  threads, repeated patterns, tool constraints, setup candidates
                  and stock form — deterministically, from the B-Rep.
                </p>
              </div>
              <button
                onClick={open}
                className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-medium text-white shadow-lg shadow-blue-600/20 transition-colors hover:bg-blue-700"
              >
                Choose file
              </button>
              <p className="font-mono text-[11px] text-slate-400">
                {ACCEPTED_EXTENSIONS.join("  ")}
              </p>
              {capabilities && (
                <p className="text-[11px] text-slate-400">
                  Max {formatBytes(capabilities.max_upload_bytes)} ·{" "}
                  {capabilities.max_faces.toLocaleString()} faces
                </p>
              )}
            </div>

            <label className="mt-5 flex cursor-pointer items-center gap-2 text-xs text-slate-500">
              <input
                type="checkbox"
                checked={includeFaceDetails}
                onChange={(event) => setIncludeFaceDetails(event.target.checked)}
                className="h-3.5 w-3.5 rounded border-slate-300"
              />
              Include per-face details (larger response)
            </label>
          </div>
        )}
      </div>
    </div>
  );
}
