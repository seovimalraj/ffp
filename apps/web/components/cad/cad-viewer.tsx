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

    // Update zoom when prop changes
    useEffect(() => {
      if (viewerRef.current && !isLoading) {
        viewerRef.current.fitToScreen(zoom);
      }
    }, [zoom, isLoading]);

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
          <div className="absolute top-14 left-4 z-10 flex flex-col gap-2 rounded-lg bg-gray-900/80 p-3 backdrop-blur-sm shadow-lg border border-gray-700 max-w-xs text-sm text-gray-200">
            {/* Views */}
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => viewerRef.current?.setView("iso")}
                className="rounded bg-gray-700 px-2 py-1 hover:bg-gray-600 transition-colors"
              >
                Iso
              </button>
              <button
                onClick={() => viewerRef.current?.setView("top")}
                className="rounded bg-gray-700 px-2 py-1 hover:bg-gray-600 transition-colors"
              >
                Top
              </button>
              <button
                onClick={() => viewerRef.current?.setView("front")}
                className="rounded bg-gray-700 px-2 py-1 hover:bg-gray-600 transition-colors"
              >
                Front
              </button>
              <button
                onClick={() => viewerRef.current?.setView("right")}
                className="rounded bg-gray-700 px-2 py-1 hover:bg-gray-600 transition-colors"
              >
                Right
              </button>
            </div>

            <div className="h-px bg-gray-700 my-1" />

            {/* Measurements */}
            <div className="flex items-center justify-between gap-2">
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
                className={`flex-1 rounded px-2 py-1 transition-colors ${
                  measureMode
                    ? "bg-blue-600 text-white"
                    : "bg-gray-700 hover:bg-gray-600"
                }`}
              >
                Measure
              </button>
              <select
                value={units}
                onChange={(e) => setUnits(e.target.value as Units)}
                className="bg-gray-700 rounded px-2 py-1 text-white border-none outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="mm">mm</option>
                <option value="cm">cm</option>
                <option value="m">m</option>
                <option value="in">in</option>
              </select>
            </div>

            {measureMode && (
              <div className="text-xs text-gray-400 mt-1">
                {measurePoints.length === 0 && "Click start point"}
                {measurePoints.length === 1 && "Click end point"}
                {measurePointsHasResult(measurePoints) && (
                  <span className="text-white font-mono">
                    {fmt(convert(measureMM!, units))} {units}
                  </span>
                )}
              </div>
            )}

            <div className="h-px bg-gray-700 my-1" />

            {/* Style Controls */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-gray-400 text-xs">Wireframe</span>
                <button
                  onClick={() => setWireframe(!wireframe)}
                  className={`h-4 w-8 rounded-full transition-colors ${
                    wireframe ? "bg-blue-600" : "bg-gray-600"
                  }`}
                >
                  <div
                    className={`h-2 w-2 rounded-full bg-white transition-transform ${
                      wireframe ? "translate-x-5" : "translate-x-1"
                    }`}
                    style={{ marginTop: 4 }}
                  />
                </button>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-400 text-xs">X-Ray</span>
                <button
                  onClick={() => setXray(!xray)}
                  className={`h-4 w-8 rounded-full transition-colors ${
                    xray ? "bg-blue-600" : "bg-gray-600"
                  }`}
                >
                  <div
                    className={`h-2 w-2 rounded-full bg-white transition-transform ${
                      xray ? "translate-x-5" : "translate-x-1"
                    }`}
                    style={{ marginTop: 4 }}
                  />
                </button>
              </div>
              <div className="flex justify-between gap-1">
                {[
                  "#b8c2ff", // Default Blue
                  "#ef4444", // Red
                  "#22c55e", // Green
                  "#eab308", // Yellow
                  "#d1d5db", // Grey
                  "#C0C0C0", // Grey
                ].map((c) => (
                  <button
                    key={c}
                    onClick={() => setMaterialColor(c)}
                    className={`h-5 w-5 rounded-full border border-white/20 hover:scale-110 transition-transform ${
                      materialColor === c ? "ring-2 ring-white" : ""
                    }`}
                    style={{ backgroundColor: c }}
                    title={c}
                  />
                ))}
              </div>
            </div>

            <div className="h-px bg-gray-700 my-1" />

            {/* Slicing Controls */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-gray-400 text-xs">Slice Model</span>
                <button
                  onClick={() => setSliceEnabled(!sliceEnabled)}
                  className={`h-4 w-8 rounded-full transition-colors ${
                    sliceEnabled ? "bg-blue-600" : "bg-gray-600"
                  }`}
                >
                  <div
                    className={`h-2 w-2 rounded-full bg-white transition-transform ${
                      sliceEnabled ? "translate-x-5" : "translate-x-1"
                    }`}
                    style={{ marginTop: 4 }}
                  />
                </button>
              </div>
              {sliceEnabled && (
                <div className="px-1">
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={sliceLevel}
                    onChange={(e) => setSliceLevel(Number(e.target.value))}
                    className="w-full h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-blue-500"
                  />
                </div>
              )}
            </div>

            <div className="h-px bg-gray-700 my-1" />

            {/* Snapshots */}
            <div className="flex gap-2">
              <button
                onClick={() => handleSnapshot("normal")}
                className="flex-1 rounded bg-gray-700 px-2 py-1 text-xs hover:bg-gray-600 transition-colors"
              >
                Snap
              </button>
              <button
                onClick={() => handleSnapshot("outline")}
                className="flex-1 rounded bg-gray-700 px-2 py-1 text-xs hover:bg-gray-600 transition-colors"
              >
                Outline
              </button>
            </div>

            <div className="h-px bg-gray-700 my-1" />

            {/* Dimensions Info */}
            {dimsMM ? (
              <div className="text-xs space-y-0.5 text-gray-400">
                <div className="font-semibold text-gray-300">Dimensions:</div>
                <div>
                  L: {fmt(convert(dimsMM.x, units))} {units}
                </div>
                <div>
                  W: {fmt(convert(dimsMM.z, units))} {units}
                </div>
                <div>
                  H: {fmt(convert(dimsMM.y, units))} {units}
                </div>
              </div>
            ) : (
              <div className="text-xs text-gray-500">Dimensions: —</div>
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
