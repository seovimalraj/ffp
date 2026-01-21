"use client";

import React, {
  useEffect,
  useRef,
  useState,
  useImperativeHandle,
  forwardRef,
} from "react";
import * as THREE from "three";
import { createViewer, Viewer } from "./viewer";
import { loadMeshFile } from "./mesh-loader";

type Units = "mm" | "cm" | "m" | "in";

function convert(valMM: number, to: Units) {
  switch (to) {
    case "mm":
      return valMM;
    case "cm":
      return valMM / 10;
    case "m":
      return valMM / 1000;
    case "in":
      return valMM / 25.4;
  }
}

function fmt(n: number) {
  return Number.isFinite(n) ? n.toFixed(2) : "-";
}

function measurePointsHasResult(points: THREE.Vector3[]) {
  return points.length === 2;
}

interface CadViewerProps {
  file?: File | string | null;
  className?: string;
  style?: React.CSSProperties;
  autoResize?: boolean;
  showControls?: boolean;
  zoom?: number;
  previewUrl?: string;
  onSnapshot?: (url: string) => void;
  selectedHighlight?: {
    type: "feature" | "surface" | "edge" | "dimension";
    featureType?: string;
    location?: { x: number; y: number; z: number };
    triangles?: number[];
    description?: string;
  };
  backgroundColor?: string | number;
}

export interface CadViewerRef {
  getSnapshot: (type?: "normal" | "outline") => string | undefined;
}

export const CadViewer = forwardRef<CadViewerRef, CadViewerProps>(
  (
    {
      file,
      className,
      style,
      autoResize = true,
      showControls = false,
      zoom = 1,
      previewUrl,
      onSnapshot,
      selectedHighlight,
      backgroundColor,
    },
    ref,
  ) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const viewerRef = useRef<Viewer | null>(null);
    const workerRef = useRef<Worker | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [show3D, setShow3D] = useState(!previewUrl);
    const snapshotTakenRef = useRef(false);

    // Synchronize show3D state with previewUrl prop
    useEffect(() => {
      setShow3D(!previewUrl);
    }, [previewUrl]);

    // Auto-capture snapshot
    useEffect(() => {
      if (
        onSnapshot &&
        !isLoading &&
        !error &&
        file &&
        viewerRef.current &&
        show3D &&
        !snapshotTakenRef.current
      ) {
        const timeout = setTimeout(() => {
          const url = viewerRef.current?.getScreenshotDataURL();
          if (url) {
            onSnapshot(url);
            snapshotTakenRef.current = true;
          }
        }, 1500); // Wait for geometry to load and render
        return () => clearTimeout(timeout);
      }
    }, [isLoading, error, file, show3D, onSnapshot]);

    // Viewer State (Measurement & Controls)
    const [dimsMM, setDimsMM] = useState<{
      x: number;
      y: number;
      z: number;
    } | null>(null);
    const [units, setUnits] = useState<Units>("mm");
    const [measureMode, setMeasureMode] = useState(false);
    const [measurePoints, setMeasurePoints] = useState<THREE.Vector3[]>([]);
    const [measureMM, setMeasureMM] = useState<number | null>(null);
    const [dimScale, _setDimScale] = useState(0.6);

    // Appearance State
    const [wireframe, setWireframe] = useState(false);
    const [xray, setXray] = useState(false);
    const [materialColor, setMaterialColor] = useState("#b8c2ff");
    const [sliceEnabled, setSliceEnabled] = useState(false);
    const [sliceLevel, setSliceLevel] = useState(50);

    useImperativeHandle(ref, () => ({
      getSnapshot: (type: "normal" | "outline" = "normal") => {
        if (!viewerRef.current) return undefined;
        return type === "normal"
          ? viewerRef.current.getScreenshotDataURL()
          : viewerRef.current.getOutlineSnapshotDataURL();
      },
    }));

    useEffect(() => {
      if (!show3D || !containerRef.current) return;

      // Initialize viewer
      viewerRef.current = createViewer(containerRef.current);
      viewerRef.current.setMeasurementGraphicsScale(dimScale);
      if (backgroundColor && viewerRef.current.setBackgroundColor) {
        viewerRef.current.setBackgroundColor(backgroundColor);
      }

      // Initialize worker
      try {
        workerRef.current = new Worker(
          new URL("../../workers/occ-worker.ts", import.meta.url),
        );
        // Send origin to worker for robust path resolution (mostly for dev)
        if (typeof window !== "undefined") {
          workerRef.current.postMessage({
            type: "init",
            payload: { origin: window.location.origin },
          });
        }
      } catch (e) {
        console.error("Failed to initialize worker:", e);
        setError("Failed to initialize CAD worker");
      }

      // Initial resize to ensure correct dimensions
      if (autoResize) {
        setTimeout(() => {
          viewerRef.current?.resize();
        }, 0);
      }

      return () => {
        viewerRef.current?.dispose();
        workerRef.current?.terminate();
      };
    }, [autoResize, show3D]);

    // Update Appearance
    useEffect(() => {
      if (viewerRef.current) {
        viewerRef.current.setMaterialProperties(
          parseInt(materialColor.replace("#", "0x"), 16),
          wireframe,
          xray,
        );
      }
    }, [materialColor, wireframe, xray]);

    // Update Slicing
    useEffect(() => {
      if (viewerRef.current) {
        viewerRef.current.setClipping(sliceEnabled ? sliceLevel / 100 : null);
      }
    }, [sliceEnabled, sliceLevel]);

    useEffect(() => {
      if (viewerRef.current) {
        viewerRef.current.setMeasurementGraphicsScale(dimScale);
      }
    }, [dimScale]);

    useEffect(() => {
      if (
        viewerRef.current &&
        backgroundColor &&
        (viewerRef.current as any).setBackgroundColor
      ) {
        (viewerRef.current as any).setBackgroundColor(backgroundColor);
      }
    }, [backgroundColor]);

    // Update zoom when prop changes
    useEffect(() => {
      if (viewerRef.current && !isLoading) {
        viewerRef.current.fitToScreen(zoom);
      }
    }, [zoom, isLoading]);

    // Update highlight when selectedHighlight changes
    useEffect(() => {
      if (!viewerRef.current) return;

      if (
        selectedHighlight?.triangles &&
        selectedHighlight.triangles.length > 0
      ) {
        viewerRef.current.setHighlight(
          selectedHighlight.triangles,
          selectedHighlight.location,
        );
      } else {
        // Clear highlight if no triangles
        viewerRef.current.setHighlight(null);
      }
    }, [selectedHighlight]);

    function setDimsFromGeometry(geom: THREE.BufferGeometry) {
      geom.computeBoundingBox();
      const size = new THREE.Vector3();
      geom.boundingBox!.getSize(size);
      setDimsMM({ x: size.x, y: size.y, z: size.z });
    }

    // Load file when it changes
    useEffect(() => {
      if (!file || !viewerRef.current || !workerRef.current) return;

      const load = async () => {
        setIsLoading(true);
        setError(null);
        setDimsMM(null);
        setMeasureMode(false);
        setMeasurePoints([]);
        setMeasureMM(null);
        viewerRef.current?.setMeasurementSegment(null, null, null);

        try {
          viewerRef.current?.clear();
          const geom = await loadMeshFile(file, workerRef.current!);
          setDimsFromGeometry(geom);
          viewerRef.current?.loadMeshFromGeometry(geom);

          // Reset appearance on new file load
          viewerRef.current?.setMaterialProperties(
            parseInt(materialColor.replace("#", "0x"), 16),
            wireframe,
            xray,
          );
          // Apply custom zoom if provided
          if (zoom !== 1) {
            viewerRef.current?.fitToScreen(zoom);
          }
        } catch (err: any) {
          console.error("Failed to load file:", err);
          setError(err.message || "Failed to load file");
        } finally {
          setIsLoading(false);
        }
      };

      load();
    }, [file, show3D]);

    // Handle Resize
    useEffect(() => {
      if (!autoResize || !show3D) return;

      const resizeObserver = new ResizeObserver(() => {
        viewerRef.current?.resize();
      });

      if (containerRef.current) {
        resizeObserver.observe(containerRef.current);
      }

      return () => {
        resizeObserver.disconnect();
      };
    }, [autoResize, show3D]);

    // Measurement Logic
    const handleViewportClick = (event: React.MouseEvent<HTMLDivElement>) => {
      if (
        !showControls ||
        !measureMode ||
        !viewerRef.current ||
        !containerRef.current
      )
        return;

      const rect = containerRef.current.getBoundingClientRect();
      const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      const y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      const picked = viewerRef.current.pickAtScreenPosition(x, y);
      if (!picked) return;

      // First point
      if (measurePoints.length === 0) {
        setMeasurePoints([picked]);
        viewerRef.current.setMeasurementSegment(null, null, null);
        setMeasureMM(null);
        return;
      }

      // Second point
      if (measurePoints.length === 1) {
        const p1 = measurePoints[0];
        const p2 = picked;
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const dz = p2.z - p1.z;
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

        setMeasurePoints([p1, p2]);
        setMeasureMM(dist);
        const valueInUnits = convert(dist, units);
        const label = `${fmt(valueInUnits)} ${units}`;
        viewerRef.current.setMeasurementSegment(p1, p2, label);
        return;
      }

      // Reset loop
      setMeasurePoints([picked]);
      setMeasureMM(null);
      viewerRef.current.setMeasurementSegment(null, null, null);
    };

    // Update label when units change
    useEffect(() => {
      if (!viewerRef.current) return;
      if (measureMM == null) {
        if (measurePoints.length === 0) {
          viewerRef.current.setMeasurementSegment(null, null, null);
        }
        return;
      }
      if (measurePoints.length === 2) {
        const [p1, p2] = measurePoints;
        const valueInUnits = convert(measureMM, units);
        const label = `${fmt(valueInUnits)} ${units}`;
        viewerRef.current.setMeasurementSegment(p1, p2, label);
      }
    }, [units, measureMM, measurePoints]);

    const handleSnapshot = (type: "normal" | "outline") => {
      if (!viewerRef.current) return;
      const dataURL =
        type === "normal"
          ? viewerRef.current.getScreenshotDataURL()
          : viewerRef.current.getOutlineSnapshotDataURL();
      const link = document.createElement("a");
      link.href = dataURL;
      link.download = `cad_snapshot_${type}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    };

    return (
      <div
        className={className}
        style={{
          position: "relative",
          width: "100%",
          height: "100%",
          minHeight: "200px",
          overflow: "hidden",
          backgroundColor: "#ffffff",
          ...style,
        }}
      >
        {/* 3D Viewport */}
        <div
          ref={containerRef}
          onClick={handleViewportClick}
          style={{
            width: "100%",
            height: "100%",
            cursor: measureMode ? "crosshair" : "default",
          }}
        />

        {/* Controls Overlay */}
        {showControls && (
          <div className="absolute top-6 left-6 z-10 flex flex-col gap-3 rounded-2xl bg-white/80 p-4 backdrop-blur-xl shadow-[0_8px_30px_rgba(0,0,0,0.08)] border border-slate-200/50 min-w-[220px] text-sm text-slate-600 ring-1 ring-black/[0.02]">
            {/* Views */}
            <div className="grid grid-cols-3 gap-1.5">
              <button
                onClick={() => viewerRef.current?.setView("iso")}
                className="rounded-lg bg-slate-50 border border-slate-200/60 py-1.5 hover:bg-white hover:border-blue-200 hover:text-blue-600 transition-all text-xs font-medium"
              >
                Iso
              </button>
              <button
                onClick={() => viewerRef.current?.setView("top")}
                className="rounded-lg bg-slate-50 border border-slate-200/60 py-1.5 hover:bg-white hover:border-blue-200 hover:text-blue-600 transition-all text-xs font-medium"
              >
                Top
              </button>
              <button
                onClick={() => viewerRef.current?.setView("front")}
                className="rounded-lg bg-slate-50 border border-slate-200/60 py-1.5 hover:bg-white hover:border-blue-200 hover:text-blue-600 transition-all text-xs font-medium"
              >
                Front
              </button>
              <button
                onClick={() => viewerRef.current?.setView("right")}
                className="rounded-lg bg-slate-50 border border-slate-200/60 py-1.5 hover:bg-white hover:border-blue-200 hover:text-blue-600 transition-all text-xs font-medium"
              >
                Right
              </button>
              <button
                onClick={() => viewerRef.current?.fitToScreen(1)}
                className="col-span-2 rounded-lg bg-blue-50 border border-blue-100 py-1.5 hover:bg-blue-100 text-blue-600 transition-all text-xs font-medium flex items-center justify-center gap-1.5"
                title="Fit to Screen"
              >
                Fit Model
              </button>
            </div>

            <div className="h-px bg-slate-200/60 mx-1" />

            {/* Measurements */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  const next = !measureMode;
                  setMeasureMode(next);
                  if (!next && viewerRef.current) {
                    setMeasurePoints([]);
                    setMeasureMM(null);
                    viewerRef.current.setMeasurementSegment(null, null, null);
                  }
                }}
                className={`flex-1 rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                  measureMode
                    ? "bg-blue-600 text-white shadow-md shadow-blue-200"
                    : "bg-slate-50 border border-slate-200/60 text-slate-600 hover:bg-white hover:border-blue-200"
                }`}
              >
                Measure
              </button>
              <select
                value={units}
                onChange={(e) => setUnits(e.target.value as Units)}
                className="bg-slate-50 border border-slate-200/60 rounded-lg px-2 py-1.5 text-xs font-medium text-slate-700 outline-none hover:border-blue-200 transition-all"
              >
                <option value="mm">mm</option>
                <option value="cm">cm</option>
                <option value="m">m</option>
                <option value="in">in</option>
              </select>
            </div>

            {measureMode && (
              <div className="bg-blue-50/50 rounded-lg p-2 border border-blue-100/50">
                <div className="text-[10px] uppercase tracking-wider text-blue-500 font-bold mb-1">
                  {measurePoints.length === 0 && "Select Point 1"}
                  {measurePoints.length === 1 && "Select Point 2"}
                  {measurePointsHasResult(measurePoints) && "Result"}
                </div>
                {measurePointsHasResult(measurePoints) && (
                  <div className="text-blue-700 font-mono text-xs font-bold">
                    {fmt(convert(measureMM!, units))} {units}
                  </div>
                )}
              </div>
            )}

            <div className="h-px bg-slate-200/60 mx-1" />

            {/* Style Controls */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-slate-500 text-xs font-medium">
                  Wireframe
                </span>
                <button
                  onClick={() => setWireframe(!wireframe)}
                  className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${
                    wireframe ? "bg-blue-600" : "bg-slate-200"
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      wireframe ? "translate-x-4" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 text-xs font-medium">
                  X-Ray View
                </span>
                <button
                  onClick={() => setXray(!xray)}
                  className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${
                    xray ? "bg-blue-600" : "bg-slate-200"
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      xray ? "translate-x-4" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>
              <div className="flex justify-between items-center pt-1">
                {[
                  "#b8c2ff", // Default Blue
                  "#ef4444", // Red
                  "#22c55e", // Green
                  "#f59e0b", // Amber
                  "#d1d5db", // Grey
                  "#334155", // Slate
                ].map((c) => (
                  <button
                    key={c}
                    onClick={() => setMaterialColor(c)}
                    className={`h-5 w-5 rounded-full border ring-offset-2 transition-all ${
                      materialColor === c
                        ? "ring-2 ring-blue-500 scale-110 border-white"
                        : "border-slate-200 hover:scale-110"
                    }`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>

            <div className="h-px bg-slate-200/60 mx-1" />

            {/* Slicing Controls */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-slate-500 text-xs font-medium">
                  Cross Section
                </span>
                <button
                  onClick={() => setSliceEnabled(!sliceEnabled)}
                  className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${
                    sliceEnabled ? "bg-blue-600" : "bg-slate-200"
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      sliceEnabled ? "translate-x-4" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>
              {sliceEnabled && (
                <div className="px-0.5 pt-1">
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={sliceLevel}
                    onChange={(e) => setSliceLevel(Number(e.target.value))}
                    className="w-full h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                  />
                </div>
              )}
            </div>

            <div className="h-px bg-slate-200/60 mx-1" />

            {/* Snapshots */}
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => handleSnapshot("normal")}
                className="rounded-lg bg-slate-50 border border-slate-200/60 py-1.5 text-[11px] font-semibold text-slate-600 hover:bg-white hover:border-blue-200 hover:text-blue-600 transition-all"
              >
                Screenshot
              </button>
              <button
                onClick={() => handleSnapshot("outline")}
                className="rounded-lg bg-slate-50 border border-slate-200/60 py-1.5 text-[11px] font-semibold text-slate-600 hover:bg-white hover:border-blue-200 hover:text-blue-600 transition-all"
              >
                Outline Snap
              </button>
            </div>

            {/* Dimensions Info */}
            {dimsMM && (
              <>
                <div className="h-px bg-slate-200/60 mx-1" />
                <div className="bg-slate-50/50 rounded-xl p-3 border border-slate-200/40">
                  <div className="text-[10px] uppercase tracking-wider text-slate-400 font-bold mb-2">
                    Model Bounds
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-[11px] font-mono">
                    <div className="flex flex-col">
                      <span className="text-slate-400">X</span>
                      <span className="text-slate-700 font-bold">
                        {fmt(convert(dimsMM.x, units))}
                      </span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-slate-400">Y</span>
                      <span className="text-slate-700 font-bold">
                        {fmt(convert(dimsMM.y, units))}
                      </span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-slate-400">Z</span>
                      <span className="text-slate-700 font-bold">
                        {fmt(convert(dimsMM.z, units))}
                      </span>
                    </div>
                  </div>
                  <div className="mt-1 text-[10px] text-right text-slate-400 uppercase font-medium">
                    {units}
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* Loading Overlay */}
        {isLoading && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "rgba(0,0,0,0.5)",
              color: "white",
              zIndex: 20,
              pointerEvents: "none",
            }}
          >
            Loading...
          </div>
        )}
        {/* Error Overlay */}
        {error && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "rgba(0,0,0,0.7)",
              color: "#ff6b6b",
              zIndex: 20,
              padding: "20px",
              textAlign: "center",
            }}
          >
            {error}
          </div>
        )}
      </div>
    );
  },
);

CadViewer.displayName = "CadViewer";
