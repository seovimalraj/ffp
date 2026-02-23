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
import {
  analyzeCadSheetMetal,
  loadCadAssemblyFile,
  loadMeshAssemblyAsObject3D,
  loadMeshFile,
  SheetMetalMeta,
  unfoldCadSheetMetal,
} from "./mesh-loader";
import { loadDxfFromArrayBuffer, parseDxfFromArrayBuffer } from "./dxf";
import buildSolidFromDxf from "./dxf_solid";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2 } from "lucide-react";

type Units = "mm" | "cm" | "m" | "in";
type AssemblyLoadMode = "flat" | "parts";
type CADExt = "step" | "stp" | "iges" | "igs" | "brep";
type MeshAssemblyExt = "obj" | "3mf" | "gltf" | "glb";

export const CAD_EXTS: ReadonlySet<CADExt> = new Set<CADExt>([
  "step",
  "stp",
  "iges",
  "igs",
  "brep",
]);

export const MESH_ASSEMBLY_EXTS: ReadonlySet<MeshAssemblyExt> =
  new Set<MeshAssemblyExt>([
    "obj",
    "3mf",
    "gltf",
    "glb",
  ]);

function isCadExt(ext: string | undefined): ext is CADExt {
  if (!ext) return false;
  return CAD_EXTS.has(ext as CADExt);
}

function isMeshAssemblyExt(ext: string | undefined): ext is MeshAssemblyExt {
  if (!ext) return false;
  return MESH_ASSEMBLY_EXTS.has(ext as MeshAssemblyExt);
}

function getFileExt(file: File | string | null | undefined): string | undefined {
  if (!file) return undefined;

  const raw = typeof file === "string" ? file : file.name;
  const withoutHash = raw.split("#")[0] ?? raw;
  const withoutQuery = withoutHash.split("?")[0] ?? withoutHash;
  const basename = withoutQuery.split("/").pop() ?? withoutQuery;
  const lastDotIndex = basename.lastIndexOf(".");

  if (lastDotIndex < 0 || lastDotIndex === basename.length - 1) {
    return undefined;
  }

  return basename.slice(lastDotIndex + 1).toLowerCase();
}

function getFileCacheKey(file: File | string | null | undefined): string | null {
  if (!file) return null;
  if (typeof file === "string") return `url:${file}`;
  return `file:${file.name}:${file.size}:${file.lastModified}`;
}

function clampKFactor(value: number): number {
  if (!Number.isFinite(value)) return 0.33;
  return Math.min(1, Math.max(0, value));
}

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

function measureHasResult(measureMM: number | null) {
  return measureMM !== null;
}

const FORCE_SHOW_FLATTEN = false;
const SHOW_SHEET_META_DEBUG = false;

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
  showViewCube?: boolean;
  assemblyLoadMode?: AssemblyLoadMode;
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
      showViewCube = true,
      assemblyLoadMode: assemblyLoadModeProp,
    },
    ref,
  ) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const viewerRef = useRef<Viewer | null>(null);
    const workerRef = useRef<Worker | null>(null);
    const wasDxfViewRef = useRef(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [show3D, setShow3D] = useState(!previewUrl);
    const [assemblyMode, setAssemblyMode] = useState<AssemblyLoadMode>(
      assemblyLoadModeProp ?? "flat",
    );
    const [parts, setParts] = useState<
      Array<{ name: string; object: THREE.Object3D }>
    >([]);
    const [lastPickName, setLastPickName] = useState<string>("");
    const [currentExt, setCurrentExt] = useState<string>("");
    const [sheetMeta, setSheetMeta] = useState<SheetMetalMeta | null>(null);
    const [flatEnabled, setFlatEnabled] = useState(false);
    const [formedGeom, setFormedGeom] = useState<THREE.BufferGeometry | null>(null);
    const [flatGeom, setFlatGeom] = useState<THREE.BufferGeometry | null>(null);
    const [kFactor, setKFactor] = useState(0.33);
    const [thicknessOverrideMM, setThicknessOverrideMM] = useState<
      number | undefined
    >(undefined);
    const [isUnfolding, setIsUnfolding] = useState(false);
    const [flattenError, setFlattenError] = useState<string | null>(null);
    const snapshotTakenRef = useRef(false);
    const loadRequestRef = useRef(0);
    const unfoldRequestRef = useRef(0);
    const activeFileKeyRef = useRef<string | null>(null);
    const flatCacheKeyRef = useRef<string | null>(null);

    // Synchronize show3D state with previewUrl prop
    useEffect(() => {
      setShow3D(!previewUrl);
    }, [previewUrl]);

    useEffect(() => {
      if (assemblyLoadModeProp) {
        setAssemblyMode(assemblyLoadModeProp);
      }
    }, [assemblyLoadModeProp]);

    useEffect(() => {
      setCurrentExt(getFileExt(file) ?? "");
      if (!file) {
        setPartMenu(null);
        setParts([]);
        setLastPickName("");
        activeFileKeyRef.current = null;
        setSheetMeta(null);
        setFlatEnabled(false);
        setFlattenError(null);
        setIsUnfolding(false);
        unfoldRequestRef.current += 1;
        clearFlatCache();
        clearFormedCache();
      }
    }, [file]);

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
    const [measureMM, setMeasureMM] = useState<number | null>(null);
    const [dimScale, _setDimScale] = useState(0.6);
    const pointerDownPosRef = useRef<{ x: number; y: number } | null>(null);
    const pointerMovedRef = useRef(false);
    const partPointerDownPosRef = useRef<{ x: number; y: number } | null>(null);
    const partPointerMovedRef = useRef(false);
    const [partMenu, setPartMenu] = useState<null | {
      x: number;
      y: number;
      target: THREE.Object3D;
    }>(null);
    const partMenuRef = useRef<HTMLDivElement | null>(null);

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
      wasDxfViewRef.current = false;
      viewerRef.current.setMeasurementGraphicsScale(dimScale);
      if (backgroundColor && viewerRef.current.setBackgroundColor) {
        viewerRef.current.setBackgroundColor(backgroundColor);
      }
      if (viewerRef.current.setShowViewCube) {
        viewerRef.current.setShowViewCube(showViewCube);
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
      if (viewerRef.current?.setShowViewCube) {
        viewerRef.current.setShowViewCube(showViewCube);
      }
    }, [showViewCube]);

    useEffect(() => {
      if (backgroundColor && viewerRef.current?.setBackgroundColor) {
        viewerRef.current.setBackgroundColor(backgroundColor);
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

    function setDimsFromObject(object: THREE.Object3D) {
      const bounds = new THREE.Box3().setFromObject(object);
      if (bounds.isEmpty()) {
        setDimsMM(null);
        return;
      }
      const size = bounds.getSize(new THREE.Vector3());
      setDimsMM({ x: size.x, y: size.y, z: size.z });
    }

    function disposeGeometrySafe(geom: THREE.BufferGeometry | null | undefined) {
      if (!geom) return;
      try {
        geom.dispose();
      } catch {
        /* ignore */
      }
    }

    function clearFlatCache() {
      setFlatGeom((prev) => {
        disposeGeometrySafe(prev);
        return null;
      });
      flatCacheKeyRef.current = null;
    }

    function clearFormedCache() {
      setFormedGeom((prev) => {
        disposeGeometrySafe(prev);
        return null;
      });
    }

    // Load file when it changes
    useEffect(() => {
      if (!file || !viewerRef.current || !workerRef.current) return;
      const ext = getFileExt(file);
      const fileKey = getFileCacheKey(file);

      const load = async () => {
        const requestId = ++loadRequestRef.current;
        const isStale = () => loadRequestRef.current !== requestId;
        activeFileKeyRef.current = fileKey;

        setPartMenu(null);
        setParts([]);
        setLastPickName("");
        setIsLoading(true);
        setError(null);
        setDimsMM(null);
        setMeasureMode(false);
        setMeasureMM(null);
        setSheetMeta(null);
        setFlatEnabled(false);
        setFlattenError(null);
        setIsUnfolding(false);
        unfoldRequestRef.current += 1;
        clearFlatCache();
        clearFormedCache();
        viewerRef.current?.setMeasurementSegment(null, null, null);

        try {
          viewerRef.current?.clear();
          if (ext === "dxf") {
            const buf =
              typeof file === "string"
                ? await fetch(file).then((resp) => {
                    if (!resp.ok) {
                      throw new Error(
                        `Failed to fetch file: ${resp.statusText}`,
                      );
                    }
                    return resp.arrayBuffer();
                  })
                : await file.arrayBuffer();
            const dxfUnits = units === "in" ? "inch" : "mm";
            let object: THREE.Object3D;
            let bounds: THREE.Box3;
            let didBuildSolid = false;
            const parsed = parseDxfFromArrayBuffer(buf);
            const scaleToMm = dxfUnits === "inch" ? 25.4 : dxfUnits === "mm" ? 1 : parsed.meta.scaleToMm;

            try {
              const solid = buildSolidFromDxf(parsed.dxf, scaleToMm, {
                thicknessMm: 2,
                chordalToleranceMm: 0.1,
                edgeThresholdDeg: 25,
              });

              const positionCount =
                solid?.mesh.geometry.getAttribute("position")?.count ?? 0;
              if (!solid || positionCount <= 0) {
                throw new Error("DXF solid builder returned empty geometry");
              }

              object = solid.mesh;
              bounds = solid.bounds.clone();
              didBuildSolid = true;
            } catch (solidErr) {
              console.warn(
                "Failed to build DXF solid, falling back to linework:",
                solidErr,
              );
              const linework = loadDxfFromArrayBuffer(buf, {
                units: dxfUnits,
                includeAnnotations: false,
                chordalToleranceMm: 0.1,
              });
              object = linework.object;
              bounds = linework.bounds;
              didBuildSolid = false;
            }

            const size = new THREE.Vector3();
            bounds.getSize(size);
            if (isStale()) return;
            setDimsMM({ x: size.x, y: size.y, z: size.z });
            object.userData.__source = didBuildSolid
              ? "dxf-solid"
              : "dxf-linework";
            viewerRef.current?.loadObject3D(object);
            if (didBuildSolid) {
              viewerRef.current?.setProjection("perspective");
              viewerRef.current?.setControlsPreset("orbit3d");
              viewerRef.current?.setView("iso");
            } else {
              viewerRef.current?.setProjection("orthographic");
              viewerRef.current?.setControlsPreset("dxf2d");
              viewerRef.current?.setView("top");
            }
            viewerRef.current?.frameObject(object);
            wasDxfViewRef.current = !didBuildSolid;
          } else {
            viewerRef.current?.setControlsPreset("orbit3d");
            if (wasDxfViewRef.current) {
              viewerRef.current?.setProjection("perspective");
              wasDxfViewRef.current = false;
            }

            const usePartsMode = assemblyMode === "parts";
            if (usePartsMode && isCadExt(ext)) {
              const assembly = await loadCadAssemblyFile(file, workerRef.current!);
              if (isStale()) return;
              const loadedParts = assembly.object.children
                .filter((child: THREE.Object3D) => (child as any).isMesh)
                .map((child, index) => ({
                  name:
                    typeof child.name === "string" && child.name.trim().length > 0
                      ? child.name
                      : `Part ${index + 1}`,
                  object: child,
                }));

              setDimsFromObject(assembly.object);
              viewerRef.current?.loadObject3D(assembly.object, {
                explodeTopLevel: true,
              });
              setParts(loadedParts);
            } else if (usePartsMode && isMeshAssemblyExt(ext)) {
              const object = await loadMeshAssemblyAsObject3D(file);
              const loadedParts: Array<{
                name: string;
                object: THREE.Object3D;
              }> = [];
              object.traverse((child: any) => {
                if (child?.isMesh && child.parent === object) {
                  loadedParts.push({
                    name:
                      typeof child.name === "string" && child.name.trim().length > 0
                        ? child.name
                        : `Part ${loadedParts.length + 1}`,
                    object: child,
                  });
                }
              });
              if (loadedParts.length === 0) {
                object.children.forEach((child, index) => {
                  loadedParts.push({
                    name:
                      typeof child.name === "string" && child.name.trim().length > 0
                        ? child.name
                        : `Part ${index + 1}`,
                    object: child,
                  });
                });
              }

              setDimsFromObject(object);
              viewerRef.current?.loadObject3D(object, { explodeTopLevel: true });
              setParts(loadedParts);
            } else {
              const geom = await loadMeshFile(file, workerRef.current!);
              if (isStale()) return;
              const formedCache = geom.clone();
              setDimsFromGeometry(formedCache);
              viewerRef.current?.loadMeshFromGeometry(formedCache.clone());
              setFormedGeom((prev) => {
                disposeGeometrySafe(prev);
                return formedCache;
              });
              setParts([]);

              if (assemblyMode !== "parts" && isCadExt(ext)) {
                analyzeCadSheetMetal(file, workerRef.current!)
                  .then((meta) => {
                    if (isStale()) return;
                    if (activeFileKeyRef.current !== fileKey) return;
                    setSheetMeta(meta);
                  })
                  .catch(() => {
                    if (isStale()) return;
                    if (activeFileKeyRef.current !== fileKey) return;
                    setSheetMeta({
                      isAssembly: false,
                      isSheetMetal: false,
                      reason: "analysis_failed",
                    });
                  });
              }
            }
          }

          if (isStale()) return;
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
          if (isStale()) return;
          console.error("Failed to load file:", err);
          setError(err.message || "Failed to load file");
        } finally {
          if (!isStale()) {
            setIsLoading(false);
          }
        }
      };

      load();
      return () => {
        loadRequestRef.current += 1;
        unfoldRequestRef.current += 1;
      };
    }, [file, show3D, assemblyMode]);

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
    const handleViewportPointerMove = (
      event: React.PointerEvent<HTMLDivElement>,
    ) => {
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

      if (pointerDownPosRef.current) {
        const dx = event.clientX - pointerDownPosRef.current.x;
        const dy = event.clientY - pointerDownPosRef.current.y;
        if (Math.hypot(dx, dy) >= 3) {
          pointerMovedRef.current = true;
        }
      }

      if (viewerRef.current.highlightEdgeAtScreenPosition) {
        viewerRef.current.highlightEdgeAtScreenPosition(x, y);
      }
    };

    const handleViewportPointerDown = (
      event: React.PointerEvent<HTMLDivElement>,
    ) => {
      if (!showControls || !measureMode) return;
      pointerDownPosRef.current = { x: event.clientX, y: event.clientY };
      pointerMovedRef.current = false;
    };

    const handleViewportPointerUp = (
      event: React.PointerEvent<HTMLDivElement>,
    ) => {
      if (
        !showControls ||
        !measureMode ||
        !viewerRef.current ||
        !containerRef.current
      )
        return;

      if (pointerMovedRef.current) {
        pointerDownPosRef.current = null;
        return;
      }

      const rect = containerRef.current.getBoundingClientRect();
      const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      const y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      const length = viewerRef.current.measureEdgeAtScreenPosition(x, y);
      if (length === null) return;
      setMeasureMM(length);
      pointerDownPosRef.current = null;
    };

    const handleViewportPointerDownCapture = (
      event: React.PointerEvent<HTMLDivElement>,
    ) => {
      if (event.button !== 0) return;
      partPointerDownPosRef.current = { x: event.clientX, y: event.clientY };
      partPointerMovedRef.current = false;
    };

    const handleViewportPointerMoveCapture = (
      event: React.PointerEvent<HTMLDivElement>,
    ) => {
      if (!partPointerDownPosRef.current) return;
      const dx = event.clientX - partPointerDownPosRef.current.x;
      const dy = event.clientY - partPointerDownPosRef.current.y;
      if (Math.hypot(dx, dy) > 3) {
        partPointerMovedRef.current = true;
      }
    };

    const handleViewportPointerUpCapture = (
      event: React.PointerEvent<HTMLDivElement>,
    ) => {
      if (event.button !== 0) return;
      if (!partPointerDownPosRef.current) return;

      const reset = () => {
        partPointerDownPosRef.current = null;
        partPointerMovedRef.current = false;
      };

      if (assemblyMode !== "parts" || measureMode) {
        reset();
        return;
      }
      if (partPointerMovedRef.current) {
        reset();
        return;
      }
      if (!viewerRef.current || !containerRef.current) {
        reset();
        return;
      }

      const rect = containerRef.current.getBoundingClientRect();
      const ndcX = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      const ndcY = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      const hit = viewerRef.current.pickMeshAtScreenPosition(ndcX, ndcY);
      if (hit) {
        setLastPickName(
          typeof hit.object.name === "string" && hit.object.name.length > 0
            ? hit.object.name
            : "unnamed",
        );
        setPartMenu({ x: event.clientX, y: event.clientY, target: hit.object });
      } else {
        setPartMenu(null);
      }
      reset();
    };

    useEffect(() => {
      if (!measureMode) return;
      setPartMenu(null);
    }, [measureMode]);

    useEffect(() => {
      setPartMenu(null);
    }, [file, show3D]);

    useEffect(() => {
      setPartMenu(null);
    }, [assemblyMode]);

    useEffect(() => {
      if (!partMenu) return;

      const handleWindowPointerDown = (event: PointerEvent) => {
        const target = event.target;
        if (
          partMenuRef.current &&
          target instanceof Node &&
          partMenuRef.current.contains(target)
        ) {
          return;
        }
        setPartMenu(null);
      };

      window.addEventListener("pointerdown", handleWindowPointerDown);
      return () => {
        window.removeEventListener("pointerdown", handleWindowPointerDown);
      };
    }, [partMenu]);

    // Clear edge highlight when measure mode is disabled
    useEffect(() => {
      if (!measureMode && viewerRef.current?.clearEdgeHighlight) {
        viewerRef.current.clearEdgeHighlight();
      }
    }, [measureMode]);

    useEffect(() => {
      viewerRef.current?.setControlsEnabled?.(true);
    }, [measureMode]);

    useEffect(() => {
      if (assemblyMode !== "parts") return;
      setFlatEnabled(false);
      setFlattenError(null);
      setIsUnfolding(false);
      unfoldRequestRef.current += 1;
    }, [assemblyMode]);

    const baseFlattenEligible =
      showControls && assemblyMode !== "parts" && isCadExt(currentExt);
    const naturalFlattenVisible =
      baseFlattenEligible &&
      sheetMeta?.isAssembly === false &&
      sheetMeta?.isSheetMetal === true;
    const forceFlattenVisible =
      FORCE_SHOW_FLATTEN &&
      baseFlattenEligible &&
      (currentExt === "step" || currentExt === "stp") &&
      sheetMeta?.isAssembly === false;
    const flattenControlVisible = naturalFlattenVisible || forceFlattenVisible;

    const handleFlatToggle = async (nextEnabled: boolean) => {
      const viewer = viewerRef.current;
      if (!viewer || !formedGeom || !file) return;

      if (!nextEnabled) {
        viewer.replacePrimaryGeometry(formedGeom.clone(), { refit: true });
        setDimsFromGeometry(formedGeom);
        setFlatEnabled(false);
        setFlattenError(null);
        return;
      }

      const currentFileKey = getFileCacheKey(file);
      if (!currentFileKey) return;

      const normalizedK = clampKFactor(kFactor);
      const thicknessKey =
        typeof thicknessOverrideMM === "number" &&
        Number.isFinite(thicknessOverrideMM)
          ? thicknessOverrideMM.toString()
          : "";
      const cacheKey = `${currentFileKey}::${normalizedK.toFixed(4)}::${thicknessKey}`;
      setFlattenError(null);

      if (flatGeom && flatCacheKeyRef.current === cacheKey) {
        viewer.replacePrimaryGeometry(flatGeom.clone(), { refit: true });
        setDimsFromGeometry(flatGeom);
        setFlatEnabled(true);
        return;
      }

      const worker = workerRef.current;
      if (!worker) return;

      setIsUnfolding(true);
      setFlatEnabled(false);
      const unfoldId = ++unfoldRequestRef.current;
      try {
        const result = await unfoldCadSheetMetal(file, worker, {
          kFactor: normalizedK,
          thicknessOverrideMM,
        });
        if (unfoldRequestRef.current !== unfoldId) return;
        if (activeFileKeyRef.current !== currentFileKey) return;

        const flatCache = result.flat.clone();
        setFlatGeom((prev) => {
          disposeGeometrySafe(prev);
          return flatCache;
        });
        flatCacheKeyRef.current = cacheKey;
        setSheetMeta(result.meta);
        viewer.replacePrimaryGeometry(flatCache.clone(), { refit: true });
        setDimsFromGeometry(flatCache);
        setFlatEnabled(true);
      } catch (err: any) {
        if (unfoldRequestRef.current !== unfoldId) return;
        if (activeFileKeyRef.current !== currentFileKey) return;
        setFlattenError(err?.message || "Failed to unfold sheet metal.");
        setFlatEnabled(false);
        viewer.replacePrimaryGeometry(formedGeom.clone(), { refit: true });
        setDimsFromGeometry(formedGeom);
      } finally {
        if (unfoldRequestRef.current === unfoldId) {
          setIsUnfolding(false);
        }
      }
    };

    const handleKFactorChange = (raw: string) => {
      const parsed = Number(raw);
      if (!Number.isFinite(parsed)) return;
      const next = clampKFactor(parsed);
      setKFactor(next);
      setFlattenError(null);
      unfoldRequestRef.current += 1;
      setIsUnfolding(false);
      if (flatEnabled && formedGeom && viewerRef.current) {
        viewerRef.current.replacePrimaryGeometry(formedGeom.clone(), {
          refit: true,
        });
        setDimsFromGeometry(formedGeom);
        setFlatEnabled(false);
      }
      clearFlatCache();
    };

    const handleThicknessOverrideChange = (raw: string) => {
      const trimmed = raw.trim();
      if (!trimmed) {
        setThicknessOverrideMM(undefined);
      } else {
        const parsed = Number(trimmed);
        if (!Number.isFinite(parsed)) return;
        setThicknessOverrideMM(parsed);
      }
      setFlattenError(null);
      unfoldRequestRef.current += 1;
      setIsUnfolding(false);
      if (flatEnabled && formedGeom && viewerRef.current) {
        viewerRef.current.replacePrimaryGeometry(formedGeom.clone(), {
          refit: true,
        });
        setDimsFromGeometry(formedGeom);
        setFlatEnabled(false);
      }
      clearFlatCache();
    };

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
          onPointerDownCapture={handleViewportPointerDownCapture}
          onPointerMoveCapture={handleViewportPointerMoveCapture}
          onPointerUpCapture={handleViewportPointerUpCapture}
          onPointerDown={handleViewportPointerDown}
          onPointerUp={handleViewportPointerUp}
          onPointerMove={handleViewportPointerMove}
          style={{
            width: "100%",
            height: "100%",
            cursor: measureMode ? "crosshair" : "default",
          }}
        />

        {partMenu && (
          <div
            ref={partMenuRef}
            style={{
              position: "fixed",
              left: partMenu.x + 8,
              top: partMenu.y + 8,
              zIndex: 9999,
              display: "flex",
              gap: "6px",
              padding: "8px",
              borderRadius: "10px",
              border: "1px solid rgba(148, 163, 184, 0.6)",
              background: "rgba(255, 255, 255, 0.96)",
              boxShadow: "0 10px 30px rgba(15, 23, 42, 0.2)",
              backdropFilter: "blur(6px)",
            }}
          >
            <button
              onClick={() => {
                viewerRef.current?.isolateObject(partMenu.target);
                setPartMenu(null);
              }}
              style={{
                padding: "5px 10px",
                borderRadius: "7px",
                border: "1px solid rgba(148, 163, 184, 0.5)",
                background: "#f8fafc",
                color: "#0f172a",
                fontSize: "12px",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Isolate
            </button>
            <button
              onClick={() => {
                viewerRef.current?.showAllParts();
                setPartMenu(null);
              }}
              style={{
                padding: "5px 10px",
                borderRadius: "7px",
                border: "1px solid rgba(148, 163, 184, 0.5)",
                background: "#f8fafc",
                color: "#0f172a",
                fontSize: "12px",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Show all
            </button>
            <button
              onClick={() => {
                viewerRef.current?.clearIsolation();
                setPartMenu(null);
              }}
              style={{
                padding: "5px 10px",
                borderRadius: "7px",
                border: "1px solid rgba(148, 163, 184, 0.5)",
                background: "#f8fafc",
                color: "#0f172a",
                fontSize: "12px",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Clear
            </button>
          </div>
        )}

        <div
          style={{
            position: "absolute",
            top: 12,
            right: 12,
            zIndex: 35,
            display: "flex",
            gap: 6,
            padding: 6,
            borderRadius: 10,
            background: "rgba(255, 255, 255, 0.9)",
            border: "1px solid rgba(148, 163, 184, 0.4)",
            backdropFilter: "blur(4px)",
          }}
        >
          <button
            onClick={() => setAssemblyMode("flat")}
            style={{
              border: "1px solid rgba(148, 163, 184, 0.6)",
              borderRadius: 8,
              padding: "4px 8px",
              fontSize: 12,
              fontWeight: 600,
              color: assemblyMode === "flat" ? "#ffffff" : "#0f172a",
              background: assemblyMode === "flat" ? "#0f172a" : "#f8fafc",
              cursor: "pointer",
            }}
          >
            Flat
          </button>
          <button
            onClick={() => setAssemblyMode("parts")}
            style={{
              border: "1px solid rgba(148, 163, 184, 0.6)",
              borderRadius: 8,
              padding: "4px 8px",
              fontSize: 12,
              fontWeight: 600,
              color: assemblyMode === "parts" ? "#ffffff" : "#0f172a",
              background: assemblyMode === "parts" ? "#0f172a" : "#f8fafc",
              cursor: "pointer",
            }}
          >
            Parts
          </button>
        </div>

        {assemblyMode === "parts" && parts.length > 0 && (
          <div
            style={{
              position: "absolute",
              top: 62,
              right: 12,
              zIndex: 34,
              width: 220,
              maxHeight: "55%",
              overflow: "hidden",
              display: "flex",
              flexDirection: "column",
              gap: 8,
              padding: 10,
              borderRadius: 12,
              background: "rgba(255,255,255,0.94)",
              border: "1px solid rgba(148, 163, 184, 0.45)",
              boxShadow: "0 10px 24px rgba(15, 23, 42, 0.12)",
              backdropFilter: "blur(4px)",
            }}
          >
            <div
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: "#0f172a",
              }}
            >
              Parts ({parts.length})
            </div>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 6,
                overflowY: "auto",
                paddingRight: 2,
              }}
            >
              {parts.map((part, index) => {
                const label =
                  typeof part.name === "string" && part.name.trim().length > 0
                    ? part.name
                    : `Part ${index + 1}`;
                return (
                  <button
                    key={`${label}-${index}`}
                    onClick={() => {
                      setLastPickName(label);
                      viewerRef.current?.isolateObject(part.object);
                      setPartMenu(null);
                    }}
                    style={{
                      textAlign: "left",
                      border: "1px solid rgba(148, 163, 184, 0.45)",
                      borderRadius: 8,
                      padding: "6px 8px",
                      fontSize: 12,
                      fontWeight: 600,
                      color: "#0f172a",
                      background: "#f8fafc",
                      cursor: "pointer",
                    }}
                    title={label}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              <button
                onClick={() => {
                  viewerRef.current?.showAllParts();
                  setPartMenu(null);
                }}
                style={{
                  flex: 1,
                  border: "1px solid rgba(148, 163, 184, 0.45)",
                  borderRadius: 8,
                  padding: "6px 8px",
                  fontSize: 12,
                  fontWeight: 600,
                  color: "#0f172a",
                  background: "#f8fafc",
                  cursor: "pointer",
                }}
              >
                Show all
              </button>
              <button
                onClick={() => {
                  viewerRef.current?.clearIsolation();
                  setPartMenu(null);
                }}
                style={{
                  flex: 1,
                  border: "1px solid rgba(148, 163, 184, 0.45)",
                  borderRadius: 8,
                  padding: "6px 8px",
                  fontSize: 12,
                  fontWeight: 600,
                  color: "#0f172a",
                  background: "#f8fafc",
                  cursor: "pointer",
                }}
              >
                Clear
              </button>
            </div>
          </div>
        )}

        <div
          style={{
            position: "absolute",
            left: 12,
            bottom: 12,
            zIndex: 35,
            padding: "8px 10px",
            borderRadius: 10,
            border: "1px solid rgba(148, 163, 184, 0.5)",
            background: "rgba(15, 23, 42, 0.82)",
            color: "#e2e8f0",
            fontSize: 11,
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
            lineHeight: 1.45,
            pointerEvents: "none",
          }}
        >
          <div>Mode: {assemblyMode}</div>
          <div>Ext: {currentExt || "-"}</div>
          <div>Parts detected: {parts.length}</div>
          <div>Last pick: {lastPickName || "-"}</div>
        </div>

        {/* Controls Overlay */}
        {showControls && (
          <div className="absolute top-6 left-6 z-10 flex flex-col gap-3 rounded-2xl bg-white/80 p-4 backdrop-blur-xl shadow-[0_8px_30px_rgba(0,0,0,0.08)] border border-slate-200/50 min-w-[220px] text-sm text-slate-600 ring-1 ring-black/[0.02]">
            {/* Views: replaced by corner view cube */}

            <div className="h-px bg-slate-200/60 mx-1" />

            {/* Measurements */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  const next = !measureMode;
                  setMeasureMode(next);
                  if (!next && viewerRef.current) {
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
                  {!measureHasResult(measureMM) && "Click an Edge"}
                  {measureHasResult(measureMM) && "Result"}
                </div>
                {measureHasResult(measureMM) && (
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

            {flattenControlVisible && (
              <>
                <div className="h-px bg-slate-200/60 mx-1" />
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 text-xs font-medium">
                      Flatten
                    </span>
                    <button
                      disabled={isUnfolding}
                      onClick={() => handleFlatToggle(!flatEnabled)}
                      className={`relative inline-flex h-5 w-9 flex-shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${
                        flatEnabled ? "bg-blue-600" : "bg-slate-200"
                      } ${
                        isUnfolding ? "cursor-not-allowed opacity-60" : "cursor-pointer"
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                          flatEnabled ? "translate-x-4" : "translate-x-0"
                        }`}
                      />
                    </button>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-slate-500 text-xs font-medium">
                      K-Factor
                    </span>
                    <input
                      type="number"
                      min={0}
                      max={1}
                      step={0.01}
                      value={kFactor}
                      onChange={(e) => handleKFactorChange(e.target.value)}
                      className="w-20 rounded-md border border-slate-200/70 bg-slate-50 px-2 py-1 text-right text-xs font-medium text-slate-700 outline-none focus:border-blue-300"
                    />
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-slate-500 text-xs font-medium">
                      Thickness
                    </span>
                    <input
                      type="number"
                      min={0}
                      step={0.01}
                      placeholder="auto"
                      value={thicknessOverrideMM ?? ""}
                      onChange={(e) => handleThicknessOverrideChange(e.target.value)}
                      className="w-20 rounded-md border border-slate-200/70 bg-slate-50 px-2 py-1 text-right text-xs font-medium text-slate-700 outline-none focus:border-blue-300"
                    />
                  </div>
                  {isUnfolding && (
                    <div className="text-[11px] font-medium text-blue-600">
                      Unfolding...
                    </div>
                  )}
                  {flattenError && (
                    <div className="text-[11px] font-medium text-rose-600">
                      {flattenError}
                    </div>
                  )}
                  {SHOW_SHEET_META_DEBUG && sheetMeta && (
                    <div className="text-[10px] font-mono text-slate-500">
                      {`sheet=${sheetMeta.isSheetMetal ? "true" : "false"} assembly=${
                        sheetMeta.isAssembly ? "true" : "false"
                      } reason=${sheetMeta.reason ?? "none"}`}
                    </div>
                  )}
                </div>
              </>
            )}

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
        <AnimatePresence>
          {isLoading && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-20 flex items-center justify-center bg-slate-900/10 backdrop-blur-sm pointer-events-none"
            >
              <div className="flex flex-col items-center gap-3 rounded-2xl bg-white/90 p-8 shadow-2xl border border-slate-200/50 backdrop-blur-xl ring-1 ring-black/[0.05]">
                <div className="relative">
                  <div className="absolute inset-0 rounded-full bg-blue-500/20 blur-xl animate-pulse" />
                  <Loader2 className="h-10 w-10 animate-spin text-blue-600 relative z-10" />
                </div>
                <div className="flex flex-col items-center gap-1">
                  <span className="text-sm font-semibold text-slate-900">
                    Processing Model
                  </span>
                  <span className="text-[11px] text-slate-500 font-medium">
                    Preparing 3D environment...
                  </span>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        {/* Error Overlay */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="absolute inset-0 z-20 flex items-center justify-center bg-slate-900/40 backdrop-blur-md p-6"
            >
              <div className="flex flex-col items-center gap-4 rounded-2xl bg-white p-8 shadow-2xl border border-red-100 max-w-[80%] text-center">
                <div className="h-12 w-12 rounded-full bg-red-50 flex items-center justify-center">
                  <span className="text-2xl">⚠️</span>
                </div>
                <div className="flex flex-col gap-1">
                  <h3 className="text-sm font-bold text-slate-900">
                    Failed to Load Model
                  </h3>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    {error}
                  </p>
                </div>
                <button
                  onClick={() => window.location.reload()}
                  className="mt-2 rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 transition-colors"
                >
                  Retry
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  },
);

CadViewer.displayName = "CadViewer";
