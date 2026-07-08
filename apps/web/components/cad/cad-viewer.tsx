"use client";

import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
  useImperativeHandle,
  forwardRef,
} from "react";
import * as THREE from "three";
import * as BufferGeometryUtils from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { createViewer, Viewer } from "./viewer";
import {
  analyzeCadSheetMetal,
  DEFAULT_WORKER_CAPABILITIES,
  getWorkerCapabilities,
  loadCadAssemblyWithTopology,
  loadMeshAssemblyAsObject3D,
  loadMeshFile,
  SheetMetalMeta,
  type CadTopologyAvailability,
  unfoldCadSheetMetal,
  type CadTopologyResult,
  type WorkerCapabilities,
} from "./mesh-loader";
import {
  detectSheetMetal,
  type DetectionResult,
} from "./sheet-metal-detector";
import { unfoldGeometry, type UnfoldGeometryResult } from "./sm-unfold-engine";
import { parseDxfFromArrayBuffer } from "./dxf";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Download, ExternalLink, Loader2 } from "lucide-react";
import { getSafePartDisplayName } from "./part-display-name";
import {
  createCadModelSession,
  createMeshModelSession,
  findPartRootByKey,
  resolveObjectByPath,
  type ModelSession,
  type PartDescriptor,
} from "./model-session";
import { triggerSelectedPartExport } from "./cad-viewer-export-controller";
import {
  cloneWorldBakedSubtree,
  getWorkingPartExportPlan,
  type PartExportPlan,
} from "./exporters/part-export";
import {
  applyMainDxfObjectToViewer,
  applyPreviewDxfObjectToViewer,
  buildFreshDxf2DObject,
  buildFreshDxf3DObject,
  createLoadedDxfDocument,
  disposeDxfPreviewViewer,
  type LoadedDxfDocument,
} from "./dxf-preview-session";
import {
  buildDxfPreviewDimensionPlan,
  selectDxfPreviewDimensionsFromPlan,
} from "./dxf-preview-dimensions";
import {
  buildDxf2DFeatureModel,
  type Dxf2DFeatureModel,
} from "./dxf-preview-feature-model";
import {
  clearDxfPreviewDimensionSvg,
  renderDxfPreviewDimensions,
} from "./dxf-preview-dimension-renderer";
import {
  collapseDxfPreviewPanel,
  createDefaultDxfPreviewPanelState,
  expandDxfPreviewPanel,
  getDxfPreviewPanelVisibility,
  toggleDxfPreviewPanelDimensions,
} from "./dxf-preview-panel-state";
import {
  runMeasurementClickInteraction,
  runMeasurementHoverInteraction,
} from "./cad-viewer-measurement-interaction";

type Units = "mm" | "cm" | "m" | "in";
type AssemblyLoadMode = "flat" | "parts";
type CADExt = "step" | "stp" | "iges" | "igs" | "brep";
type MeshAssemblyExt = "obj" | "3mf" | "gltf" | "glb";
type ViewerMode = { kind: "assembly" } | { kind: "part"; partKey: string };
type LoadedPart = {
  key: string;
  name: string;
  rawName?: string;
  object: THREE.Object3D;
};
type DisplayAssemblySnapshot = {
  root: THREE.Group;
  partRoots: Map<string, THREE.Object3D>;
};
type CadTopologyViewerContext = {
  ext: CADExt;
  topology: CadTopologyResult | null;
  topologyAvailability: CadTopologyAvailability;
};
type PartUnfoldState = {
  status: "folded" | "unfolding" | "unfolded" | "error";
  flatGeometry: THREE.BufferGeometry | null;
  originalGeometry: THREE.BufferGeometry | null;
  flatDimensions: { width: number; height: number } | null;
  errorReason: string | null;
};

export const CAD_EXTS: ReadonlySet<CADExt> = new Set<CADExt>([
  "step",
  "stp",
  "iges",
  "igs",
  "brep",
]);

export const MESH_ASSEMBLY_EXTS: ReadonlySet<MeshAssemblyExt> =
  new Set<MeshAssemblyExt>(["obj", "3mf", "gltf", "glb"]);

function buildMergedGeometryFromObject(
  object: THREE.Object3D,
): THREE.BufferGeometry | null {
  const meshGeometries: THREE.BufferGeometry[] = [];
  object.updateWorldMatrix(true, true);
  object.traverse((node: any) => {
    if (!node?.isMesh) return;
    const mesh = node as THREE.Mesh;
    const sourceGeometry = mesh.geometry as THREE.BufferGeometry | undefined;
    if (!sourceGeometry) return;
    const worldBakedGeometry = sourceGeometry.clone();
    worldBakedGeometry.applyMatrix4(mesh.matrixWorld);
    meshGeometries.push(worldBakedGeometry);
  });

  if (meshGeometries.length === 0) return null;

  let merged: THREE.BufferGeometry | null = null;
  try {
    merged =
      meshGeometries.length === 1
        ? meshGeometries[0]
        : BufferGeometryUtils.mergeGeometries(meshGeometries, true);
  } catch {
    merged = null;
  }

  if (!merged) {
    for (const geom of meshGeometries) {
      try {
        geom.dispose();
      } catch {
        /* ignore */
      }
    }
    return null;
  }

  for (const geom of meshGeometries) {
    if (geom === merged) continue;
    try {
      geom.dispose();
    } catch {
      /* ignore */
    }
  }

  if (!merged.getAttribute("normal")) {
    try {
      merged.computeVertexNormals();
    } catch {
      /* ignore */
    }
  }

  return merged;
}

function applyPartMetadata(object: THREE.Object3D, descriptor: PartDescriptor): void {
  object.userData.__partKey = descriptor.key;
  object.userData.__partKind = descriptor.kind;
  if (descriptor.kind === "cad") {
    object.userData.__cadPartId = descriptor.cadPartId;
  }
}

function resolveSourcePartObject(
  session: ModelSession,
  partKey: string,
): THREE.Object3D | null {
  const descriptor = session.partMap.get(partKey);
  if (!descriptor) return null;
  if (!session.sourceObject) return null;

  if (descriptor.kind === "mesh") {
    return resolveObjectByPath(session.sourceObject, descriptor.objectPath);
  }

  return findPartRootByKey(session.sourceObject, descriptor.key);
}

function reconstructAssemblyDisplayFromSource(
  session: ModelSession,
): { root: THREE.Group; parts: LoadedPart[] } | null {
  const root = new THREE.Group();
  root.name =
    session.sourceObject?.name ||
    session.originalName.replace(/\.[^.]+$/, "") ||
    "Assembly";
  const parts: LoadedPart[] = [];
  let index = 0;

  for (const descriptor of session.partMap.values()) {
    const sourcePart = resolveSourcePartObject(session, descriptor.key);
    if (!sourcePart) continue;
    const partObject = cloneWorldBakedSubtree(sourcePart);
    partObject.name = descriptor.name;
    applyPartMetadata(partObject, descriptor);
    root.add(partObject);
    parts.push({
      key: descriptor.key,
      name: getSafePartDisplayName(descriptor.name, index),
      rawName: descriptor.name,
      object: partObject,
    });
    index += 1;
  }

  if (parts.length === 0) return null;
  return { root, parts };
}

function cloneDisplayPartRoot(
  sourcePartRoot: THREE.Object3D,
  descriptor: PartDescriptor,
): THREE.Object3D {
  const partObject = cloneWorldBakedSubtree(sourcePartRoot);
  partObject.name = descriptor.name;
  applyPartMetadata(partObject, descriptor);
  return partObject;
}

function buildDisplayAssemblySnapshotFromParts(
  session: ModelSession,
  loadedParts: LoadedPart[],
): DisplayAssemblySnapshot | null {
  const loadedPartByKey = new Map<string, LoadedPart>();
  for (const part of loadedParts) {
    loadedPartByKey.set(part.key, part);
  }

  const root = new THREE.Group();
  root.name =
    session.sourceObject?.name ||
    session.originalName.replace(/\.[^.]+$/, "") ||
    "Assembly";
  const partRoots = new Map<string, THREE.Object3D>();

  for (const descriptor of session.partMap.values()) {
    const loadedPart = loadedPartByKey.get(descriptor.key);
    if (!loadedPart) continue;
    const partRoot = cloneDisplayPartRoot(loadedPart.object, descriptor);
    root.add(partRoot);
    partRoots.set(descriptor.key, partRoot);
  }

  if (partRoots.size === 0) return null;
  return { root, partRoots };
}

function cloneAssemblyDisplayFromSnapshot(
  session: ModelSession,
  snapshot: DisplayAssemblySnapshot,
): { root: THREE.Group; parts: LoadedPart[] } | null {
  const root = new THREE.Group();
  root.name =
    snapshot.root.name ||
    session.sourceObject?.name ||
    session.originalName.replace(/\.[^.]+$/, "") ||
    "Assembly";
  const parts: LoadedPart[] = [];
  let index = 0;

  for (const descriptor of session.partMap.values()) {
    const snapshotPartRoot = snapshot.partRoots.get(descriptor.key);
    if (!snapshotPartRoot) continue;
    const partObject = cloneDisplayPartRoot(snapshotPartRoot, descriptor);
    root.add(partObject);
    parts.push({
      key: descriptor.key,
      name: getSafePartDisplayName(descriptor.name, index),
      rawName: descriptor.name,
      object: partObject,
    });
    index += 1;
  }

  if (parts.length === 0) return null;
  return { root, parts };
}

function isCadExt(ext: string | undefined): ext is CADExt {
  if (!ext) return false;
  return CAD_EXTS.has(ext as CADExt);
}

function isMeshAssemblyExt(ext: string | undefined): ext is MeshAssemblyExt {
  if (!ext) return false;
  return MESH_ASSEMBLY_EXTS.has(ext as MeshAssemblyExt);
}

function getFileExt(
  file: File | string | null | undefined,
): string | undefined {
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

function getFileCacheKey(
  file: File | string | null | undefined,
): string | null {
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
const MISSING_RUNTIME_TOPOLOGY_WARNING_MESSAGE =
  "Exact CAD topology unavailable in current OCC runtime. Circle/arc measurement is running in approximate mode.";

type StepFileMetadata = {
  fileName?: string;
  timestamp?: string;
  author?: string;
  organization?: string;
  preprocessorVersion?: string;
  originatingSystem?: string;
  description?: string;
  schema?: string;
};

function readStepString(
  str: string,
  start: number,
): { value: string; next: number } {
  let i = start + 1;
  let value = "";
  while (i < str.length) {
    if (str[i] === "'" && str[i + 1] === "'") {
      value += "'";
      i += 2;
    } else if (str[i] === "'") {
      i++;
      break;
    } else {
      value += str[i];
      i++;
    }
  }
  return { value, next: i };
}

function findMatchingParen(text: string, openIndex: number): number {
  let depth = 0;
  let inString = false;
  for (let i = openIndex; i < text.length; i++) {
    const c = text[i];
    if (inString) {
      if (c === "'" && text[i + 1] === "'") {
        i++;
      } else if (c === "'") {
        inString = false;
      }
    } else if (c === "'") {
      inString = true;
    } else if (c === "(") {
      depth++;
    } else if (c === ")") {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

function parseStepEntityArgs(body: string): string[] {
  const results: string[] = [];
  let i = 0;
  while (i < body.length) {
    while (i < body.length && /[\s,]/.test(body[i])) i++;
    if (i >= body.length) break;
    if (body[i] === "(") {
      const list: string[] = [];
      i++;
      while (i < body.length && body[i] !== ")") {
        while (i < body.length && /[\s,]/.test(body[i])) i++;
        if (i < body.length && body[i] === "'") {
          const { value, next } = readStepString(body, i);
          const trimmed = value.trim();
          if (trimmed) list.push(trimmed);
          i = next;
        } else if (i < body.length && body[i] !== ")") {
          i++;
        }
      }
      if (i < body.length && body[i] === ")") i++;
      results.push(list.join(", "));
    } else if (body[i] === "'") {
      const { value, next } = readStepString(body, i);
      results.push(value.trim());
      i = next;
    } else {
      while (i < body.length && body[i] !== "," && body[i] !== ")") i++;
      results.push("");
    }
  }
  return results;
}

function extractStepMetadata(buffer: ArrayBuffer): StepFileMetadata | null {
  const text = new TextDecoder("utf-8", { fatal: false }).decode(buffer);
  if (!/ISO-10303-21/i.test(text.slice(0, 64))) return null;

  const endsecIdx = text.indexOf("ENDSEC");
  const headerText = endsecIdx > 0 ? text.slice(0, endsecIdx) : text;

  function extractEntity(name: string): string[] | null {
    const pattern = new RegExp(`\\b${name}\\s*\\(`, "i");
    const match = pattern.exec(headerText);
    if (!match) return null;
    const openIdx = match.index + match[0].length - 1;
    const closeIdx = findMatchingParen(headerText, openIdx);
    if (closeIdx === -1) return null;
    return parseStepEntityArgs(headerText.slice(openIdx + 1, closeIdx));
  }

  const meta: StepFileMetadata = {};

  const fn = extractEntity("FILE_NAME");
  if (fn) {
    if (fn[0]) meta.fileName = fn[0];
    if (fn[1]) meta.timestamp = fn[1];
    if (fn[2]) meta.author = fn[2];
    if (fn[3]) meta.organization = fn[3];
    if (fn[4]) meta.preprocessorVersion = fn[4];
    if (fn[5]) meta.originatingSystem = fn[5];
  }

  const fd = extractEntity("FILE_DESCRIPTION");
  if (fd && fd[0]) meta.description = fd[0];

  const fs = extractEntity("FILE_SCHEMA");
  if (fs && fs[0]) meta.schema = fs[0];

  const hasAny = Object.values(meta).some((v) => v && v.trim().length > 0);
  return hasAny ? meta : null;
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
  showViewCube?: boolean;
  showHomeButton?: boolean;
  showFlatParts?: boolean;
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
      showHomeButton = true,
      showFlatParts = false,
      assemblyLoadMode: assemblyLoadModeProp,
    },
    ref,
  ) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const dxfPreviewContainerRef = useRef<HTMLDivElement>(null);
    const dxfDimensionSvgRef = useRef<SVGSVGElement>(null);
    const viewerRef = useRef<Viewer | null>(null);
    const dxfPreviewViewerRef = useRef<Viewer | null>(null);
    const dxfPreviewRootRef = useRef<THREE.Object3D | null>(null);
    const workerRef = useRef<Worker | null>(null);
    const wasDxfViewRef = useRef(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [show3D, setShow3D] = useState(!previewUrl);
    const [loadedDxfDocument, setLoadedDxfDocument] =
      useState<LoadedDxfDocument | null>(null);
    const [dxfPreviewPanelState, setDxfPreviewPanelState] = useState(
      createDefaultDxfPreviewPanelState(),
    );
    const isDxfPreviewExpanded = dxfPreviewPanelState.expanded;
    const showDimensions = dxfPreviewPanelState.dimensionsEnabled;
    const [dxfFeatureModel, setDxfFeatureModel] =
      useState<Dxf2DFeatureModel | null>(null);
    const [dxfPreviewSize, setDxfPreviewSize] = useState({
      width: 0,
      height: 0,
    });
    const [dxfOverlayRevision, setDxfOverlayRevision] = useState(0);
    const [assemblyMode, setAssemblyMode] = useState<AssemblyLoadMode>(
      assemblyLoadModeProp ?? "flat",
    );
    const [parts, setParts] = useState<LoadedPart[]>([]);
    const [modelSession, setModelSession] = useState<ModelSession | null>(null);
    const modelSessionRef = useRef<ModelSession | null>(null);
    const [viewerMode, setViewerMode] = useState<ViewerMode>({
      kind: "assembly",
    });
    const [selectedPartKey, setSelectedPartKey] = useState<string | null>(null);
    const [partExportMessage, setPartExportMessage] = useState<string | null>(
      null,
    );
    const [isExportingPart, setIsExportingPart] = useState(false);
    const [cadFileMetadata, setCadFileMetadata] = useState<StepFileMetadata | null>(null);
    const [showMetadataPanel, setShowMetadataPanel] = useState(false);
    const [currentExt, setCurrentExt] = useState<string>("");
    const [cadTopologyAvailability, setCadTopologyAvailability] =
      useState<CadTopologyAvailability | null>(null);
    const [cadTopologyEdgeCount, setCadTopologyEdgeCount] = useState(0);
    const [sheetMeta, setSheetMeta] = useState<SheetMetalMeta | null>(null);
    const [flatEnabled, setFlatEnabled] = useState(false);
    const [workerReady, setWorkerReady] = useState(false);
    const [workerCapabilities, setWorkerCapabilities] =
      useState<WorkerCapabilities>(DEFAULT_WORKER_CAPABILITIES);
    const [assemblyProbeCount, setAssemblyProbeCount] = useState(0);
    const [isProbingAssembly, setIsProbingAssembly] = useState(false);
    const [formedGeom, setFormedGeom] = useState<THREE.BufferGeometry | null>(
      null,
    );
    const [flatGeom, setFlatGeom] = useState<THREE.BufferGeometry | null>(null);
    const [kFactor, setKFactor] = useState(0.33);
    const [thicknessOverrideMM, setThicknessOverrideMM] = useState<
      number | undefined
    >(undefined);
    const [isUnfolding, setIsUnfolding] = useState(false);
    const [flattenError, setFlattenError] = useState<string | null>(null);
    const [partDetectionResults, setPartDetectionResults] = useState<Map<string, DetectionResult>>(new Map());
    const [partUnfoldStates, setPartUnfoldStates] = useState<Map<string, PartUnfoldState>>(new Map());
    const [flatModeDetection, setFlatModeDetection] = useState<DetectionResult | null>(null);
    const [tessUnfoldFlatDimensions, setTessUnfoldFlatDimensions] = useState<{ width: number; height: number } | null>(null);
    // Cached tessellation-unfold result for flat mode (single-part CAD view).
    // Computed once per file on first Unfold click; formedGeom stays the exact refold source.
    const tessUnfoldCacheRef = useRef<UnfoldGeometryResult | null>(null);
    const snapshotTakenRef = useRef(false);
    const loadRequestRef = useRef(0);
    const unfoldRequestRef = useRef(0);
    const assemblyProbeReqRef = useRef(0);
    const activeFileKeyRef = useRef<string | null>(null);
    const flatCacheKeyRef = useRef<string | null>(null);
    const displayAssemblySnapshotRef = useRef<DisplayAssemblySnapshot | null>(
      null,
    );
    const cadTopologyContextRef = useRef<CadTopologyViewerContext | null>(null);
    const missingRuntimeTopologyWarningLoggedRef = useRef(false);

    // Synchronize show3D state with previewUrl prop
    useEffect(() => {
      setShow3D(!previewUrl);
    }, [previewUrl]);

    useEffect(() => {
      if (assemblyLoadModeProp) {
        setAssemblyMode(assemblyLoadModeProp);
      }
    }, [assemblyLoadModeProp]);

    const isDxfFile = currentExt === "dxf";
    const showDxfPreviewPanel =
      show3D && isDxfFile && loadedDxfDocument !== null;
    const showMissingRuntimeTopologyWarning =
      cadTopologyAvailability?.reason === "missing_runtime_support" &&
      cadTopologyEdgeCount <= 0;
    const dxfPreviewPanelVisibility = useMemo(
      () => getDxfPreviewPanelVisibility(dxfPreviewPanelState),
      [dxfPreviewPanelState],
    );

    useEffect(() => {
      if (!showMissingRuntimeTopologyWarning) return;
      if (missingRuntimeTopologyWarningLoggedRef.current) return;
      missingRuntimeTopologyWarningLoggedRef.current = true;
      console.warn(MISSING_RUNTIME_TOPOLOGY_WARNING_MESSAGE, {
        reason: cadTopologyAvailability?.reason ?? null,
        message: cadTopologyAvailability?.message ?? null,
      });
    }, [
      showMissingRuntimeTopologyWarning,
      cadTopologyAvailability?.reason,
      cadTopologyAvailability?.message,
    ]);

    useEffect(() => {
      if (!showDxfPreviewPanel || !dxfPreviewContainerRef.current) {
        setDxfFeatureModel(null);
        dxfPreviewRootRef.current = null;
        dxfPreviewViewerRef.current = disposeDxfPreviewViewer(
          dxfPreviewViewerRef.current,
        );
        return;
      }

      if (!dxfPreviewViewerRef.current) {
        dxfPreviewViewerRef.current = createViewer(
          dxfPreviewContainerRef.current,
        );
      }
      const dxfPreviewViewer = dxfPreviewViewerRef.current;
      const unsubscribe = dxfPreviewViewer.onViewChanged(() => {
        setDxfOverlayRevision((prev) => prev + 1);
      });
      dxfPreviewViewer.resize();
      setDxfOverlayRevision((prev) => prev + 1);
      return () => {
        unsubscribe();
      };
    }, [showDxfPreviewPanel]);

    useEffect(() => {
      return () => {
        setDxfFeatureModel(null);
        dxfPreviewRootRef.current = null;
        dxfPreviewViewerRef.current = disposeDxfPreviewViewer(
          dxfPreviewViewerRef.current,
        );
      };
    }, []);

    useEffect(() => {
      if (
        !showDxfPreviewPanel ||
        !loadedDxfDocument ||
        !dxfPreviewViewerRef.current
      ) {
        return;
      }

      try {
        const previewBuilt = buildFreshDxf2DObject(loadedDxfDocument);
        dxfPreviewRootRef.current = previewBuilt.object;
        setDxfFeatureModel(
          buildDxf2DFeatureModel({
            doc: loadedDxfDocument,
          }),
        );
        applyPreviewDxfObjectToViewer(
          dxfPreviewViewerRef.current,
          previewBuilt.object,
          {
            fitZoom: 1.05,
            controlsEnabled: false,
          },
        );
      } catch (previewErr) {
        console.error("Failed to rebuild DXF preview:", previewErr);
        dxfPreviewRootRef.current = null;
        setDxfFeatureModel(null);
      }
    }, [showDxfPreviewPanel, loadedDxfDocument]);

    useEffect(() => {
      if (!showDxfPreviewPanel || !dxfPreviewViewerRef.current) return;
      dxfPreviewViewerRef.current.setControlsEnabled(isDxfPreviewExpanded);

      const frame = requestAnimationFrame(() => {
        dxfPreviewViewerRef.current?.resize();
      });
      return () => cancelAnimationFrame(frame);
    }, [showDxfPreviewPanel, isDxfPreviewExpanded]);

    useEffect(() => {
      const node = dxfPreviewContainerRef.current;
      if (!showDxfPreviewPanel || !node) {
        setDxfPreviewSize({ width: 0, height: 0 });
        return;
      }

      const syncSize = () => {
        setDxfPreviewSize({
          width: Math.max(0, node.clientWidth),
          height: Math.max(0, node.clientHeight),
        });
        dxfPreviewViewerRef.current?.resize();
      };
      syncSize();

      const observer = new ResizeObserver(() => syncSize());
      observer.observe(node);
      return () => observer.disconnect();
    }, [showDxfPreviewPanel, isDxfPreviewExpanded]);

    useEffect(() => {
      setCurrentExt(getFileExt(file) ?? "");
      setCadFileMetadata(null);
      setShowMetadataPanel(false);
      setViewerMode({ kind: "assembly" });
      setSelectedPartKey(null);
      setPartExportMessage(null);
      setLoadedDxfDocument(null);
      setDxfPreviewPanelState(createDefaultDxfPreviewPanelState());
      setDxfFeatureModel(null);
      dxfPreviewRootRef.current = null;
      setDxfOverlayRevision(0);
      displayAssemblySnapshotRef.current = null;
      cadTopologyContextRef.current = null;
      setCadTopologyAvailability(null);
      setCadTopologyEdgeCount(0);
      if (!file) {
        setPartMenu(null);
        setParts([]);
        activeFileKeyRef.current = null;
        replaceModelSession(null);
        setSheetMeta(null);
        setFlatEnabled(false);
        setFlattenError(null);
        setIsUnfolding(false);
        unfoldRequestRef.current += 1;
        clearFlatCache();
        clearFormedCache();
        setPartDetectionResults(new Map());
        setFlatModeDetection(null);
        setTessUnfoldFlatDimensions(null);
        clearTessUnfoldCache();
        clearPartUnfoldStates();
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
      partKey: string | null;
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
      let disposed = false;

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
      if (viewerRef.current.setShowHomeButton) {
        viewerRef.current.setShowHomeButton(showHomeButton);
      }

      // Initialize worker
      try {
        workerRef.current = new Worker(
          new URL("../../workers/occ-worker.ts", import.meta.url),
        );
        setWorkerReady(true);
        setWorkerCapabilities(DEFAULT_WORKER_CAPABILITIES);
        // Send origin to worker for robust path resolution (mostly for dev)
        if (typeof window !== "undefined") {
          workerRef.current.postMessage({
            type: "init",
            payload: { origin: window.location.origin },
          });
        }
        void getWorkerCapabilities(workerRef.current)
          .then((caps) => {
            if (!disposed) {
              setWorkerCapabilities(caps);
            }
          })
          .catch(() => {
            if (!disposed) {
              setWorkerCapabilities(DEFAULT_WORKER_CAPABILITIES);
            }
          });
      } catch (e) {
        console.error("Failed to initialize worker:", e);
        setError("Failed to initialize CAD worker");
        setWorkerReady(false);
        setWorkerCapabilities(DEFAULT_WORKER_CAPABILITIES);
      }

      // Initial resize to ensure correct dimensions
      if (autoResize) {
        setTimeout(() => {
          viewerRef.current?.resize();
        }, 0);
      }

      return () => {
        disposed = true;
        viewerRef.current?.dispose();
        workerRef.current?.terminate();
        workerRef.current = null;
        setWorkerReady(false);
        setWorkerCapabilities(DEFAULT_WORKER_CAPABILITIES);
        replaceModelSession(null);
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
      if (viewerRef.current?.setShowHomeButton) {
        viewerRef.current.setShowHomeButton(showHomeButton);
      }
    }, [showHomeButton]);

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

    function disposeGeometrySafe(
      geom: THREE.BufferGeometry | null | undefined,
    ) {
      if (!geom) return;
      try {
        geom.dispose();
      } catch {
        /* ignore */
      }
    }

    function disposeObject3DSafe(obj: THREE.Object3D | null | undefined) {
      if (!obj) return;
      obj.traverse((child) => {
        const mesh = child as THREE.Mesh;
        if (!(mesh as any)?.isMesh) return;

        disposeGeometrySafe(mesh.geometry);

        const { material } = mesh;
        if (Array.isArray(material)) {
          material.forEach((mat) => {
            try {
              mat.dispose();
            } catch {
              /* ignore */
            }
          });
          return;
        }

        try {
          material?.dispose();
        } catch {
          /* ignore */
        }
      });
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

    // Phase 1 gate — log the real render meshes that feed the unfold engine
    function logSheetMetalMeshes(source: THREE.Object3D | THREE.BufferGeometry) {
      if ((source as THREE.BufferGeometry).isBufferGeometry) {
        const geom = source as THREE.BufferGeometry;
        console.log(
          "[SM-MESH]", "(merged primary geometry)",
          "verts:", geom.attributes.position?.count ?? 0,
          "indexed:", !!geom.index,
        );
        return;
      }
      (source as THREE.Object3D).traverse((o: any) => {
        if (!o?.isMesh) return;
        const mesh = o as THREE.Mesh;
        console.log(
          "[SM-MESH]", mesh.name || "(unnamed)",
          "verts:", mesh.geometry?.attributes?.position?.count ?? 0,
          "indexed:", !!mesh.geometry?.index,
        );
      });
    }

    function clearTessUnfoldCache() {
      const cached = tessUnfoldCacheRef.current;
      if (cached) disposeGeometrySafe(cached.flatGeometry);
      tessUnfoldCacheRef.current = null;
    }

    function clearPartUnfoldStates() {
      setPartUnfoldStates((prev) => {
        for (const state of prev.values()) {
          disposeGeometrySafe(state.flatGeometry);
          disposeGeometrySafe(state.originalGeometry);
        }
        return new Map();
      });
    }

    function setCadTopologyContext(
      context: CadTopologyViewerContext | null,
    ): void {
      cadTopologyContextRef.current = context;
      setCadTopologyAvailability(context?.topologyAvailability ?? null);
      setCadTopologyEdgeCount(context?.topology?.edges?.length ?? 0);
    }

    function setCadTopologyContextFromCadLoad(
      ext: CADExt,
      topology: CadTopologyResult | null | undefined,
      topologyAvailability: CadTopologyAvailability,
    ): void {
      const normalizedTopology = topology ?? null;
      setCadTopologyContext({
        ext,
        topology: normalizedTopology,
        topologyAvailability,
      });
      console.info("[CadViewer] CAD topology availability", {
        ext,
        reason: topologyAvailability.reason,
        message: topologyAvailability.message,
        exact: topologyAvailability.exact,
        hasTopology: !!normalizedTopology,
        edgeCount: normalizedTopology?.edges?.length ?? 0,
      });
    }

    function logCadTopologyLoadPath(path: string): void {
      const context = cadTopologyContextRef.current;
      if (!context) return;
      console.info("[CadViewer] loadObject3D CAD topology context", {
        path,
        ext: context.ext,
        reason: context.topologyAvailability.reason,
        message: context.topologyAvailability.message,
      });
    }

    function attachCadTopologyContext(object: THREE.Object3D): void {
      const context = cadTopologyContextRef.current;
      if (context) {
        object.userData.__cadTopologyContext = {
          ext: context.ext,
          topology: context.topology,
        };
        object.userData.__cadTopologyAvailability = context.topologyAvailability;
      } else {
        if ("__cadTopologyContext" in object.userData) {
          delete object.userData.__cadTopologyContext;
        }
        if ("__cadTopologyAvailability" in object.userData) {
          delete object.userData.__cadTopologyAvailability;
        }
      }
    }

    function replaceModelSession(next: ModelSession | null) {
      const prev = modelSessionRef.current;
      if (prev?.sourceObject && prev.sourceObject !== next?.sourceObject) {
        disposeObject3DSafe(prev.sourceObject);
      }
      modelSessionRef.current = next;
      setModelSession(next);
    }

    function restoreAssemblyView(session: ModelSession): boolean {
      const viewer = viewerRef.current;
      if (!viewer) return false;

      const snapshot = displayAssemblySnapshotRef.current;
      if (!snapshot) return false;
      const assemblyDisplay = cloneAssemblyDisplayFromSnapshot(
        session,
        snapshot,
      );
      if (!assemblyDisplay) return false;

      setDimsFromObject(assemblyDisplay.root);
      attachCadTopologyContext(assemblyDisplay.root);
      logCadTopologyLoadPath("restore_assembly_view");
      viewer.loadObject3D(assemblyDisplay.root, { explodeTopLevel: true });
      viewer.setMaterialProperties(
        parseInt(materialColor.replace("#", "0x"), 16),
        wireframe,
        xray,
      );
      setParts(assemblyDisplay.parts);
      setViewerMode({ kind: "assembly" });
      setPartMenu(null);
      return true;
    }

    async function openPartView(partKey: string): Promise<void> {
      const viewer = viewerRef.current;
      const session = modelSessionRef.current;
      if (!viewer || !session) return;

      const descriptor = session.partMap.get(partKey);
      if (!descriptor) {
        setPartExportMessage(
          "Selected part is unavailable. Select a part again.",
        );
        return;
      }

      const latestSnapshot = buildDisplayAssemblySnapshotFromParts(
        session,
        parts,
      );
      if (latestSnapshot) {
        displayAssemblySnapshotRef.current = latestSnapshot;
      }
      const snapshot = displayAssemblySnapshotRef.current;
      if (!snapshot) {
        setPartExportMessage(
          "Assembly snapshot is unavailable. Reload the file in Assembly parts mode and try again.",
        );
        return;
      }
      const snapshotPartRoot = snapshot.partRoots.get(partKey);
      if (!snapshotPartRoot) {
        setPartExportMessage(
          "Selected part is unavailable in the current assembly snapshot. Reload and try again.",
        );
        return;
      }
      const partObject = cloneDisplayPartRoot(snapshotPartRoot, descriptor);

      attachCadTopologyContext(partObject);
      logCadTopologyLoadPath("open_part_view");
      viewer.loadObject3D(partObject, { explodeTopLevel: false });
      viewer.setMaterialProperties(
        parseInt(materialColor.replace("#", "0x"), 16),
        wireframe,
        xray,
      );
      setDimsFromObject(partObject);
      setViewerMode({ kind: "part", partKey });
      setSelectedPartKey(partKey);
      setPartMenu(null);
      // Reset unfold state for this part — the viewer just loaded fresh geometry
      setPartUnfoldStates((prev) => {
        const next = new Map(prev);
        const existing = next.get(partKey);
        if (existing) {
          disposeGeometrySafe(existing.flatGeometry);
          disposeGeometrySafe(existing.originalGeometry);
        }
        next.delete(partKey);
        return next;
      });
    }

    function backToAssemblyView(): void {
      const session = modelSessionRef.current;
      if (!session) return;
      if (!restoreAssemblyView(session)) {
        setPartExportMessage(
          "Assembly snapshot is unavailable. Reload the file in Assembly parts mode and try again.",
        );
      }
    }

    useEffect(() => {
      const probeReqId = ++assemblyProbeReqRef.current;
      const isStale = () => assemblyProbeReqRef.current !== probeReqId;

      if (!file) {
        setAssemblyProbeCount(0);
        setIsProbingAssembly(false);
        return;
      }

      const ext = getFileExt(file);
      if (!isCadExt(ext) && !isMeshAssemblyExt(ext)) {
        setAssemblyProbeCount(0);
        setIsProbingAssembly(false);
        return;
      }

      if (isCadExt(ext) && (!workerReady || !workerRef.current)) {
        setIsProbingAssembly(false);
        return;
      }

      const probe = async () => {
        setIsProbingAssembly(true);
        try {
          if (isCadExt(ext)) {
            const worker = workerRef.current;
            if (!worker) {
              if (!isStale()) setAssemblyProbeCount(0);
              return;
            }

            const assembly = await loadCadAssemblyWithTopology(file, worker);
            const session = createCadModelSession(assembly, {
              ext,
              originalName:
                typeof file === "string"
                  ? file.split("/").pop() || file
                  : file.name,
              originalFile: typeof file === "string" ? undefined : file,
              originalBytes: assembly.originalBytes,
            });
            const meshCount = session.partMap.size;
            disposeObject3DSafe(assembly.object);
            disposeObject3DSafe(session.sourceObject);
            disposeObject3DSafe(session.displayObject);

            if (isStale()) return;
            setAssemblyProbeCount(meshCount);
            return;
          }

          const object = await loadMeshAssemblyAsObject3D(file);
          const session = createMeshModelSession(object, {
            ext,
            originalName:
              typeof file === "string"
                ? file.split("/").pop() || file
                : file.name,
            originalFile: typeof file === "string" ? undefined : file,
          });
          const meshCount = session.partMap.size;
          disposeObject3DSafe(session.sourceObject);
          disposeObject3DSafe(session.displayObject);
          disposeObject3DSafe(object);

          if (isStale()) return;
          setAssemblyProbeCount(meshCount);
        } catch {
          if (isStale()) return;
          setAssemblyProbeCount(0);
        } finally {
          if (!isStale()) {
            setIsProbingAssembly(false);
          }
        }
      };

      probe();
    }, [file, workerReady]);

    // Load file when it changes
    useEffect(() => {
      if (!file || !viewerRef.current || !workerRef.current) return;
      const ext = getFileExt(file);
      const fileKey = getFileCacheKey(file);

      const load = async () => {
        const requestId = ++loadRequestRef.current;
        const isStale = () => loadRequestRef.current !== requestId;
        activeFileKeyRef.current = fileKey;
        displayAssemblySnapshotRef.current = null;

        clearTessUnfoldCache();
        let loadedAssemblySession: ModelSession | null = null;
        let loadedAssemblyParts: LoadedPart[] = [];
        // Phase 3 — raw STEP text for Layer 1 analysis (populated below for STEP/STP files)
        let rawStepText: string | null = null;

        setPartMenu(null);
        setParts([]);
        setViewerMode({ kind: "assembly" });
        setSelectedPartKey(null);
        setPartExportMessage(null);
        setLoadedDxfDocument(null);
        setDxfPreviewPanelState(createDefaultDxfPreviewPanelState());
        replaceModelSession(null);
        setIsLoading(true);
        setError(null);
        setDimsMM(null);
        setMeasureMode(false);
        setMeasureMM(null);
        setSheetMeta(null);
        setFlatModeDetection(null);
        setFlatEnabled(false);
        setFlattenError(null);
        setIsUnfolding(false);
        unfoldRequestRef.current += 1;
        clearFlatCache();
        clearFormedCache();
        viewerRef.current?.setMeasurementSegment(null, null, null);

        try {
          setCadTopologyContext(null);
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
            const parsed = parseDxfFromArrayBuffer(buf);
            const scaleToMm =
              dxfUnits === "inch"
                ? 25.4
                : dxfUnits === "mm"
                  ? 1
                  : parsed.meta.scaleToMm;
            const fileName =
              typeof file === "string"
                ? file.split("/").pop() || file
                : file.name;

            const doc = createLoadedDxfDocument({
              fileName,
              buffer: buf,
              parsed: parsed.dxf,
              scaleToMm,
              insUnits: parsed.meta.insUnits,
            });
            const builtMain = buildFreshDxf3DObject(doc, {
              thicknessMm: 2,
              chordalToleranceMm: 0.1,
              edgeThresholdDeg: 25,
            });
            const nextDoc: LoadedDxfDocument = {
              ...doc,
              consumedEntityUids: [...builtMain.consumedEntityUids],
            };

            const size = new THREE.Vector3();
            builtMain.bounds.getSize(size);
            if (isStale()) return;
            setDimsMM({ x: size.x, y: size.y, z: size.z });
            setLoadedDxfDocument(nextDoc);
            setDxfPreviewPanelState(createDefaultDxfPreviewPanelState());

            if (viewerRef.current) {
              applyMainDxfObjectToViewer(viewerRef.current, builtMain);
            }
            wasDxfViewRef.current = !builtMain.didBuildSolid;
          } else {
            viewerRef.current?.setControlsPreset("orbit3d");
            if (wasDxfViewRef.current) {
              viewerRef.current?.setProjection("perspective"); wasDxfViewRef.current = false;
            }

            const usePartsMode = assemblyMode === "parts";
            if (isCadExt(ext)) {
              const assembly = await loadCadAssemblyWithTopology(
                file,
                workerRef.current!,
              );
              if ((ext === "step" || ext === "stp") && !isStale()) {
                try {
                  setCadFileMetadata(
                    extractStepMetadata(assembly.originalBytes.slice(0, 65536)),
                  );
                } catch {
                  /* metadata extraction is best-effort */
                }
                // Phase 3 — decode full STEP body for Layer 1 analysis
                if (assembly.originalBytes.byteLength > 0 && assembly.originalBytes.byteLength <= 50 * 1024 * 1024) {
                  try {
                    rawStepText = new TextDecoder("utf-8", { fatal: false }).decode(assembly.originalBytes);
                    console.log("[SM-STEP] Raw text captured, length:", rawStepText.length, "chars");
                  } catch {
                    rawStepText = null;
                  }
                }
              }
              setCadTopologyContextFromCadLoad(
                ext,
                assembly.topology,
                assembly.topologyAvailability,
              );
              if (usePartsMode) {
                const session = createCadModelSession(assembly, {
                  ext,
                  originalName:
                    typeof file === "string"
                      ? file.split("/").pop() || file
                      : file.name,
                  originalFile: typeof file === "string" ? undefined : file,
                  originalBytes: assembly.originalBytes,
                });
                disposeObject3DSafe(assembly.object);
                if (isStale()) {
                  disposeObject3DSafe(session.sourceObject);
                  disposeObject3DSafe(session.displayObject);
                  return;
                }

                const assemblyDisplay = reconstructAssemblyDisplayFromSource(session);
                if (!assemblyDisplay) {
                  throw new Error("Failed to reconstruct CAD assembly session.");
                }
                setDimsFromObject(assemblyDisplay.root);
                attachCadTopologyContext(assemblyDisplay.root);
                logCadTopologyLoadPath("load_cad_parts_mode");
                viewerRef.current?.loadObject3D(assemblyDisplay.root, {
                  explodeTopLevel: true,
                });
                replaceModelSession(session);
                setParts(assemblyDisplay.parts);
                setViewerMode({ kind: "assembly" });
                loadedAssemblySession = session;
                loadedAssemblyParts = assemblyDisplay.parts;
              } else {
                const formedCache = buildMergedGeometryFromObject(assembly.object);
                if (isStale()) {
                  disposeObject3DSafe(assembly.object);
                  disposeGeometrySafe(formedCache);
                  return;
                }

                if (formedCache) {
                  try {
                    // TEMP Phase-1 diagnostic: confirm Box3 dims are available at load time
                    const _bb = new THREE.Box3();
                    formedCache.computeBoundingBox();
                    if (formedCache.boundingBox) _bb.copy(formedCache.boundingBox);
                    console.log(
                      "[SM-BB]",
                      "W:", (_bb.max.x - _bb.min.x).toFixed(1),
                      "L:", (_bb.max.z - _bb.min.z).toFixed(1),
                      "H:", (_bb.max.y - _bb.min.y).toFixed(1),
                    );
                    const rawName = typeof file === "string" ? (file.split("/").pop() || file) : file.name;
                    const baseName = rawName.replace(/\.[^.]+$/, "");
                    const flatDetection = detectSheetMetal(formedCache, baseName, rawStepText);
                    setFlatModeDetection(flatDetection);
                  } catch {
                    setFlatModeDetection(null);
                  }
                }

                setDimsFromObject(assembly.object);
                attachCadTopologyContext(assembly.object);
                logCadTopologyLoadPath("load_cad_flat_mode");
                viewerRef.current?.loadObject3D(assembly.object, {
                  explodeTopLevel: false,
                });
                setFormedGeom((prev) => {
                  disposeGeometrySafe(prev);
                  return formedCache;
                });
                replaceModelSession(null);
                setParts([]);
                setViewerMode({ kind: "assembly" });
                displayAssemblySnapshotRef.current = null;
              }
            } else if (usePartsMode && isMeshAssemblyExt(ext)) {
              const object = await loadMeshAssemblyAsObject3D(file);
              setCadTopologyContext(null);
              const session = createMeshModelSession(object, {
                ext,
                originalName:
                  typeof file === "string"
                    ? file.split("/").pop() || file
                    : file.name,
                originalFile: typeof file === "string" ? undefined : file,
              });
              disposeObject3DSafe(object);
              if (isStale()) {
                disposeObject3DSafe(session.sourceObject);
                disposeObject3DSafe(session.displayObject);
                return;
              }

              const assemblyDisplay =
                reconstructAssemblyDisplayFromSource(session);
              if (!assemblyDisplay) {
                throw new Error("Failed to reconstruct mesh assembly session.");
              }
              setDimsFromObject(assemblyDisplay.root);
              attachCadTopologyContext(assemblyDisplay.root);
              viewerRef.current?.loadObject3D(assemblyDisplay.root, {
                explodeTopLevel: true,
              });
              replaceModelSession(session);
              setParts(assemblyDisplay.parts);
              setViewerMode({ kind: "assembly" });
              loadedAssemblySession = session;
              loadedAssemblyParts = assemblyDisplay.parts;
            } else {
              setCadTopologyContext(null);
              const geom = await loadMeshFile(file, workerRef.current!);
              if (isStale()) return;
              const formedCache = geom.clone();
              setDimsFromGeometry(formedCache);
              viewerRef.current?.loadMeshFromGeometry(formedCache.clone());
              setFormedGeom((prev) => {
                disposeGeometrySafe(prev);
                return formedCache;
              });
              replaceModelSession(null);
              setParts([]);
              setViewerMode({ kind: "assembly" });
              displayAssemblySnapshotRef.current = null;
            }

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
          if (loadedAssemblySession && loadedAssemblyParts.length > 0) {
            displayAssemblySnapshotRef.current =
              buildDisplayAssemblySnapshotFromParts(
                loadedAssemblySession,
                loadedAssemblyParts,
              );
          }

          // Per-part sheet metal detection — runs for every loaded part independently
          // {/* SHEET_METAL_DETECTION_HOOK — parts mode: S1-S4 detection per loaded part */}
          if (loadedAssemblyParts.length > 0) {
            const detectionMap = new Map<string, DetectionResult>();
            for (const lp of loadedAssemblyParts) {
              try {
                const merged = buildMergedGeometryFromObject(lp.object);
                if (merged) {
                  const partName = lp.rawName ?? lp.name;
                  const result = detectSheetMetal(merged, partName, rawStepText);
                  detectionMap.set(lp.key, result);
                  merged.dispose();
                }
              } catch (detectionErr) {
                console.error("[CadViewer] Sheet metal detection failed for part:", lp.key, detectionErr);
              }
            }
            if (!isStale()) {
              setPartDetectionResults(detectionMap);
            }
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

      runMeasurementHoverInteraction({
        viewer: viewerRef.current,
        ndcX: x,
        ndcY: y,
      });
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

      const { length } = runMeasurementClickInteraction({
        viewer: viewerRef.current,
        ndcX: x,
        ndcY: y,
      });
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

      if (
        assemblyMode !== "parts" ||
        measureMode ||
        viewerMode.kind !== "assembly"
      ) {
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
        const partKey =
          typeof hit.object.userData?.__partKey === "string"
            ? hit.object.userData.__partKey
            : null;
        setSelectedPartKey(partKey);
        setPartExportMessage(null);
        setPartMenu({
          x: event.clientX,
          y: event.clientY,
          target: hit.object,
          partKey,
        });
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
      setPartDetectionResults(new Map());
      clearPartUnfoldStates();
    }, [assemblyMode]);

    useEffect(() => {
      if (assemblyMode !== "parts") {
        setViewerMode({ kind: "assembly" });
        setSelectedPartKey(null);
        setPartExportMessage(null);
      }
    }, [assemblyMode]);

    useEffect(() => {
      if (viewerMode.kind !== "part") return;
      if (!modelSession || !modelSession.partMap.has(viewerMode.partKey)) {
        setViewerMode({ kind: "assembly" });
      }
    }, [viewerMode, modelSession]);

    const detectedCount = Math.max(assemblyProbeCount, parts.length);
    const hasAssembly = detectedCount > 1;

    useEffect(() => {
      if (isProbingAssembly) return;
      if (assemblyMode !== "parts") return;
      if (detectedCount > 1) return;

      setAssemblyMode("flat");
      viewerRef.current?.showAllParts();
      viewerRef.current?.clearIsolation();
      setPartMenu(null);
      setSelectedPartKey(null);
      setPartExportMessage(null);
    }, [assemblyMode, detectedCount, isProbingAssembly]);

    const baseFlattenEligible =
      showControls && assemblyMode !== "parts" && isCadExt(currentExt);
    const hasExplicitSheetMetalData =
      sheetMeta?.isAssembly === false && sheetMeta?.isSheetMetal === true;
    const sheetMetalUiEnabled = showFlatParts === true;
    const naturalFlattenVisible =
      baseFlattenEligible &&
      hasExplicitSheetMetalData;
    const forceFlattenVisible =
      FORCE_SHOW_FLATTEN &&
      baseFlattenEligible &&
      (currentExt === "step" || currentExt === "stp") &&
      hasExplicitSheetMetalData;
    const flattenControlVisible =
      sheetMetalUiEnabled && (naturalFlattenVisible || forceFlattenVisible);

    // Per-part unfold control: visible when in part view and the selected part is sheet metal
    const activePartKeyForUnfold =
      assemblyMode === "parts" && viewerMode.kind === "part" ? viewerMode.partKey : null;
    const activePartDetection = activePartKeyForUnfold
      ? partDetectionResults.get(activePartKeyForUnfold)
      : null;
    const partUnfoldControlVisible =
      showControls && activePartDetection?.isSheetMetal === true && activePartDetection?.hasBends === true;

    const partAlreadyFlatVisible =
      showControls && activePartDetection?.isSheetMetal === true && activePartDetection?.hasBends === false;

    const flatModeTessUnfoldVisible =
      showControls &&
      assemblyMode !== "parts" &&
      isCadExt(currentExt) &&
      flatModeDetection?.isSheetMetal === true &&
      flatModeDetection?.hasBends === true;

    const flatModeAlreadyFlatVisible =
      showControls &&
      assemblyMode !== "parts" &&
      isCadExt(currentExt) &&
      flatModeDetection?.isSheetMetal === true &&
      flatModeDetection?.hasBends === false;

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

    const handleTessUnfoldToggle = (nextEnabled: boolean) => {
      const viewer = viewerRef.current;
      if (!viewer || !formedGeom) return;

      if (!nextEnabled) {
        // ── REFOLD: restore the original folded geometry exactly ─────────────
        // formedGeom was cached before any unfold and is never mutated, so
        // putting a clone of it back is an exact restore.
        viewer.replacePrimaryGeometry(formedGeom.clone(), { refit: true });
        setDimsFromGeometry(formedGeom);
        setFlatEnabled(false);
        setFlattenError(null);
        setTessUnfoldFlatDimensions(null);
        return;
      }

      if (!flatModeDetection?.isSheetMetal || !flatModeDetection?.hasBends) return;
      setFlattenError(null);

      try {
        if (!tessUnfoldCacheRef.current) {
          logSheetMetalMeshes(formedGeom);
          tessUnfoldCacheRef.current = unfoldGeometry(formedGeom);
        }
        const result = tessUnfoldCacheRef.current;
        if (!result) {
          setFlattenError("No folds detected — cannot unfold this part.");
          return;
        }
        // Real mesh transformation: the flat sheet is the actual part geometry
        // with unbent vertices, lying on the grid bed as a 3D object.
        viewer.replacePrimaryGeometry(result.flatGeometry.clone(), { refit: true });
        setDimsFromGeometry(result.flatGeometry);
        setFlatEnabled(true);
        setTessUnfoldFlatDimensions({ width: result.flatWidth, height: result.flatLength });
      } catch (err: any) {
        setFlattenError(err?.message || "Failed to unfold sheet metal mesh.");
        viewer.replacePrimaryGeometry(formedGeom.clone(), { refit: true });
        setDimsFromGeometry(formedGeom);
        setFlatEnabled(false);
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

    const setPartUnfoldError = (partKey: string, reason: string): void => {
      setPartUnfoldStates((prev) => {
        const next = new Map(prev);
        const existing = next.get(partKey);
        if (existing) disposeGeometrySafe(existing.flatGeometry);
        next.set(partKey, {
          status: "error",
          flatGeometry: null,
          originalGeometry: null,
          flatDimensions: null,
          errorReason: reason,
        });
        return next;
      });
    };

    const handlePartUnfold = (partKey: string): void => {
      const viewer = viewerRef.current;
      if (!viewer) return;

      const detection = partDetectionResults.get(partKey);
      if (!detection?.isSheetMetal) return;

      // The pristine assembly snapshot holds the part's real render meshes;
      // it is never mutated, so it doubles as the exact refold source.
      const snapshot = displayAssemblySnapshotRef.current;
      const partRoot = snapshot?.partRoots.get(partKey);
      if (!partRoot) return;

      const cached = partUnfoldStates.get(partKey);
      let flatGeometry = cached?.flatGeometry ?? null;
      let flatDimensions = cached?.flatDimensions ?? null;

      if (!flatGeometry || !flatDimensions) {
        logSheetMetalMeshes(partRoot);
        const merged = buildMergedGeometryFromObject(partRoot);
        if (!merged) {
          setPartUnfoldError(partKey, "Part has no mesh geometry to unfold.");
          return;
        }
        let result: UnfoldGeometryResult | null = null;
        try {
          result = unfoldGeometry(merged);
        } catch (err: any) {
          merged.dispose();
          setPartUnfoldError(partKey, err?.message || "Failed to unfold sheet metal mesh.");
          return;
        }
        merged.dispose();
        if (!result) {
          setPartUnfoldError(partKey, "No folds detected — cannot unfold this part.");
          return;
        }
        flatGeometry = result.flatGeometry;
        flatDimensions = { width: result.flatWidth, height: result.flatLength };
      }
      if (!flatGeometry || !flatDimensions) return;

      // Show the unbent sheet as the real 3D object on the grid bed — the
      // camera stays the normal perspective camera with orbit controls.
      viewer.loadMeshFromGeometry(flatGeometry.clone());
      viewer.setMaterialProperties(
        parseInt(materialColor.replace("#", "0x"), 16),
        wireframe,
        xray,
      );
      setDimsFromGeometry(flatGeometry);

      const finalFlatGeometry = flatGeometry;
      const finalFlatDimensions = flatDimensions;
      setPartUnfoldStates((prev) => {
        const next = new Map(prev);
        next.set(partKey, {
          status: "unfolded",
          flatGeometry: finalFlatGeometry,
          originalGeometry: null,
          flatDimensions: finalFlatDimensions,
          errorReason: null,
        });
        return next;
      });
    };

    const handlePartRefold = (partKey: string): void => {
      const viewer = viewerRef.current;
      const session = modelSessionRef.current;
      if (!viewer || !session) return;

      const descriptor = session.partMap.get(partKey);
      const snapshot = displayAssemblySnapshotRef.current;
      const snapshotPartRoot = snapshot?.partRoots.get(partKey);
      if (!descriptor || !snapshotPartRoot) return;

      // Reload the untouched folded part from the assembly snapshot — an
      // exact restore of the original geometry, same path as openPartView.
      const partObject = cloneDisplayPartRoot(snapshotPartRoot, descriptor);
      attachCadTopologyContext(partObject);
      viewer.loadObject3D(partObject, { explodeTopLevel: false });
      viewer.setMaterialProperties(
        parseInt(materialColor.replace("#", "0x"), 16),
        wireframe,
        xray,
      );
      setDimsFromObject(partObject);

      setPartUnfoldStates((prev) => {
        const next = new Map(prev);
        const existing = next.get(partKey);
        next.set(partKey, {
          status: "folded",
          // Keep the computed flat geometry so re-unfolding is instant
          flatGeometry: existing?.flatGeometry ?? null,
          originalGeometry: null,
          flatDimensions: existing?.flatDimensions ?? null,
          errorReason: null,
        });
        return next;
      });
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

    const workingPartExportPlan = modelSession
      ? getWorkingPartExportPlan(modelSession, workerCapabilities)
      : null;

    const resolvePartExportState = (
      partKey: string | null | undefined,
    ): { enabled: boolean; plan: PartExportPlan | null; reason: string } => {
      if (!modelSession) {
        return {
          enabled: false,
          plan: null,
          reason:
            "Selected-part export is only available for assembly files with part metadata.",
        };
      }
      if (!partKey || !modelSession.partMap.has(partKey)) {
        return {
          enabled: false,
          plan: null,
          reason: "Select an assembly part first.",
        };
      }
      const effectivePlan: PartExportPlan | null =
        modelSession.kind === "cad"
          ? { mode: "exact", format: "step" }
          : workingPartExportPlan;
      if (!effectivePlan) {
        return {
          enabled: false,
          plan: null,
          reason: "Per-part export is unavailable for this file type.",
        };
      }
      if (isExportingPart) {
        return {
          enabled: false,
          plan: effectivePlan,
          reason: "Export in progress.",
        };
      }
      return {
        enabled: true,
        plan: effectivePlan,
        reason: `Export part as ${effectivePlan.format.toUpperCase()}`,
      };
    };

    const handleExportSelectedPart = async (
      explicitPartKey?: string | null,
    ) => {
      const partKey = explicitPartKey ?? selectedPartKey;
      const state = resolvePartExportState(partKey);
      if (!partKey || !state.enabled || !state.plan) {
        setPartExportMessage(state.reason);
        return;
      }

      setIsExportingPart(true);
      try {
        const result = await triggerSelectedPartExport({
          session: modelSession,
          selectedPartKey: partKey,
          plan: state.plan,
          worker: workerRef.current,
        });
        setPartExportMessage(result.message);
        if (result.ok) {
          setSelectedPartKey(partKey);
        }
      } finally {
        setIsExportingPart(false);
      }
    };

    const dxfPreviewDimensionPlan = useMemo(() => {
      if (!dxfFeatureModel) return null;
      return buildDxfPreviewDimensionPlan({
        featureModel: dxfFeatureModel,
      });
    }, [dxfFeatureModel]);

    const handleExpandDxfPreview = () => {
      const transition = expandDxfPreviewPanel();
      setDxfPreviewPanelState(transition.nextState);
    };

    const handleCollapseDxfPreview = () => {
      const transition = collapseDxfPreviewPanel();
      setDxfPreviewPanelState(transition.nextState);
    };

    const dxfPreviewDimensions = useMemo(() => {
      if (
        !isDxfPreviewExpanded ||
        !showDimensions ||
        !dxfPreviewDimensionPlan
      ) {
        return [];
      }
      return selectDxfPreviewDimensionsFromPlan({
        plan: dxfPreviewDimensionPlan,
        mode: "expanded",
      });
    }, [isDxfPreviewExpanded, showDimensions, dxfPreviewDimensionPlan]);

    useEffect(() => {
      const svg = dxfDimensionSvgRef.current;
      if (!svg) return;
      const viewer = dxfPreviewViewerRef.current;
      const previewRoot = dxfPreviewRootRef.current;
      if (
        !showDxfPreviewPanel ||
        !isDxfPreviewExpanded ||
        !showDimensions ||
        !viewer ||
        !previewRoot ||
        !dxfFeatureModel
      ) {
        clearDxfPreviewDimensionSvg(svg);
        return;
      }
      renderDxfPreviewDimensions({
        svg,
        viewer,
        previewRoot,
        featureModel: dxfFeatureModel,
        dimensions: dxfPreviewDimensions,
      });
    }, [
      showDxfPreviewPanel,
      isDxfPreviewExpanded,
      showDimensions,
      dxfFeatureModel,
      dxfPreviewDimensions,
      dxfPreviewSize.width,
      dxfPreviewSize.height,
      dxfOverlayRevision,
    ]);

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

        {showMissingRuntimeTopologyWarning && (
          <div
            style={{
              position: "absolute",
              top: "14px",
              left: "50%",
              transform: "translateX(-50%)",
              zIndex: 15,
              maxWidth: "min(92%, 720px)",
              borderRadius: "10px",
              border: "1px solid rgba(245, 158, 11, 0.7)",
              background: "rgba(255, 251, 235, 0.96)",
              boxShadow: "0 6px 18px rgba(120, 53, 15, 0.14)",
              padding: "8px 12px",
              fontSize: "12px",
              fontWeight: 600,
              lineHeight: 1.35,
              color: "#7c2d12",
              pointerEvents: "none",
              textAlign: "center",
            }}
          >
            {MISSING_RUNTIME_TOPOLOGY_WARNING_MESSAGE}
          </div>
        )}

        {showDxfPreviewPanel && (
          <div
            style={{
              position: "absolute",
              top: "14px",
              right: "14px",
              zIndex: 14,
              width: isDxfPreviewExpanded ? "420px" : "250px",
              borderRadius: "12px",
              border: "1px solid rgba(148, 163, 184, 0.55)",
              background: "rgba(249, 248, 242, 0.96)",
              boxShadow: "0 10px 28px rgba(15, 23, 42, 0.16)",
              backdropFilter: "blur(8px)",
              padding: "10px",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "8px",
              }}
            >
              <div
                style={{
                  fontSize: "12px",
                  fontWeight: 700,
                  color: "#0f172a",
                  letterSpacing: "0.02em",
                }}
              >
                DXF 2D Preview
              </div>
              <div
                style={{
                  display: "flex",
                  gap: "6px",
                }}
              >
                {dxfPreviewPanelVisibility.showDimensionsToggle && (
                  <button
                    type="button"
                    onClick={() =>
                      setDxfPreviewPanelState((prev) =>
                        toggleDxfPreviewPanelDimensions(prev),
                      )
                    }
                    style={{
                      borderRadius: "8px",
                      border: "1px solid rgba(148, 163, 184, 0.6)",
                      background: showDimensions ? "#0f172a" : "#f8fafc",
                      color: showDimensions ? "#f8fafc" : "#0f172a",
                      fontSize: "11px",
                      fontWeight: 700,
                      padding: "5px 8px",
                      cursor: "pointer",
                    }}
                  >
                    Dimensions
                  </button>
                )}
                {dxfPreviewPanelVisibility.showCollapseButton && (
                  <button
                    type="button"
                    onClick={handleCollapseDxfPreview}
                    style={{
                      borderRadius: "8px",
                      border: "1px solid rgba(148, 163, 184, 0.6)",
                      background: "#f8fafc",
                      color: "#0f172a",
                      fontSize: "11px",
                      fontWeight: 700,
                      padding: "5px 8px",
                      cursor: "pointer",
                    }}
                  >
                    Collapse
                  </button>
                )}
                {dxfPreviewPanelVisibility.showExpandButton && (
                  <button
                    type="button"
                    onClick={handleExpandDxfPreview}
                    style={{
                      borderRadius: "8px",
                      border: "1px solid rgba(148, 163, 184, 0.6)",
                      background: "#f8fafc",
                      color: "#0f172a",
                      fontSize: "11px",
                      fontWeight: 700,
                      padding: "5px 8px",
                      cursor: "pointer",
                    }}
                  >
                    Expand
                  </button>
                )}
              </div>
            </div>

            <div
              style={{
                marginTop: "8px",
                height: isDxfPreviewExpanded ? "300px" : "150px",
                borderRadius: "10px",
                border: "1px solid rgba(148, 163, 184, 0.4)",
                overflow: "hidden",
                background:
                  "radial-gradient(circle at 18% 20%, #fcfbf5 0%, #f8f6ef 62%, #f2efe5 100%)",
                position: "relative",
              }}
            >
              <div
                ref={dxfPreviewContainerRef}
                style={{
                  width: "100%",
                  height: "100%",
                  pointerEvents: isDxfPreviewExpanded ? "auto" : "none",
                  touchAction: isDxfPreviewExpanded ? "auto" : "none",
                }}
              />
              {dxfPreviewPanelVisibility.showDimensionsOverlay && (
                <svg
                  ref={dxfDimensionSvgRef}
                  width={dxfPreviewSize.width}
                  height={dxfPreviewSize.height}
                  viewBox={`0 0 ${Math.max(1, dxfPreviewSize.width)} ${Math.max(1, dxfPreviewSize.height)}`}
                  style={{
                    position: "absolute",
                    inset: 0,
                    pointerEvents: "none",
                    overflow: "visible",
                  }}
                />
              )}
            </div>
          </div>
        )}

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

        {/* Controls Overlay */}
        {showControls && (
          <div className="absolute top-6 left-6 z-10 flex items-start gap-3">
            <div className="flex flex-col gap-3 rounded-2xl bg-white/80 p-4 backdrop-blur-xl shadow-[0_8px_30px_rgba(0,0,0,0.08)] border border-slate-200/50 min-w-[220px] text-sm text-slate-600 ring-1 ring-black/[0.02]">
              {/* Views: replaced by corner view cube */}

              {hasAssembly && (
                <button
                  type="button"
                  disabled={isProbingAssembly}
                  onClick={() => {
                    if (assemblyMode === "parts") {
                      setAssemblyMode("flat");
                      viewerRef.current?.showAllParts();
                      viewerRef.current?.clearIsolation();
                      setPartMenu(null);
                      setSelectedPartKey(null);
                      return;
                    }
                    setAssemblyMode("parts");
                  }}
                  className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition-all ${
                    assemblyMode === "parts"
                      ? "bg-blue-600 text-white shadow-md shadow-blue-200 ring-2 ring-blue-500/30 border border-blue-600"
                      : "bg-slate-50 text-slate-700 border border-blue-200/70 hover:bg-white hover:border-blue-300"
                  } ${
                    isProbingAssembly
                      ? "cursor-not-allowed opacity-60"
                      : "cursor-pointer"
                  }`}
                >
                  Assembly parts
                </button>
              )}

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

              {/* SHEET METAL — already flat label (no bends) */}
              {partAlreadyFlatVisible && (
                <>
                  <div className="h-px bg-slate-200/60 mx-1" />
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500 text-xs font-medium">Sheet Metal</span>
                      <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-500">
                        Already flat
                      </span>
                    </div>
                  </div>
                </>
              )}

              {/* UNFOLD_OPTION_SLOT */}
              {partUnfoldControlVisible && activePartKeyForUnfold && (() => {
                const partKey = activePartKeyForUnfold;
                const unfoldState = partUnfoldStates.get(partKey);
                const isUnfoldingPart = unfoldState?.status === "unfolding";
                const isUnfolded = unfoldState?.status === "unfolded";
                const hasUnfoldError = unfoldState?.status === "error";

                return (
                  <>
                    <div className="h-px bg-slate-200/60 mx-1" />
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500 text-xs font-medium">
                          Sheet Metal
                        </span>
                        <button
                          type="button"
                          disabled={isUnfoldingPart}
                          onClick={() => {
                            if (isUnfolded) {
                              handlePartRefold(partKey);
                            } else {
                              void handlePartUnfold(partKey);
                            }
                          }}
                          className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                            isUnfolded
                              ? "bg-blue-600 text-white shadow-md shadow-blue-200 border border-blue-600"
                              : "bg-slate-50 border border-blue-200/70 text-slate-700 hover:bg-white hover:border-blue-300"
                          } ${isUnfoldingPart ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`}
                        >
                          {isUnfoldingPart
                            ? "Unfolding..."
                            : isUnfolded
                              ? "Refold"
                              : "Unfold"}
                        </button>
                      </div>
                      {unfoldState?.flatDimensions && (
                        <div className="bg-slate-50/50 rounded-lg px-2 py-1 border border-slate-200/40">
                          <div className="text-[10px] uppercase tracking-wider text-slate-400 font-bold mb-0.5">
                            Flat Pattern
                          </div>
                          <div className="text-[11px] font-mono text-slate-700">
                            {`${fmt(convert(unfoldState.flatDimensions.width, units))} × ${fmt(convert(unfoldState.flatDimensions.height, units))} ${units}`}
                          </div>
                        </div>
                      )}
                      {hasUnfoldError && (
                        <div className="text-[11px] font-medium text-rose-600 leading-snug">
                          {unfoldState?.errorReason ??
                            "Unfold not available for this part's geometry."}
                        </div>
                      )}
                    </div>
                  </>
                );
              })()}

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
                          isUnfolding
                            ? "cursor-not-allowed opacity-60"
                            : "cursor-pointer"
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
                        onChange={(e) =>
                          handleThicknessOverrideChange(e.target.value)
                        }
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

              {/* SHEET METAL — already flat label (flat mode, no bends) */}
              {flatModeAlreadyFlatVisible && (
                <>
                  <div className="h-px bg-slate-200/60 mx-1" />
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500 text-xs font-medium">Sheet Metal</span>
                      <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-500">
                        Already flat
                      </span>
                    </div>
                  </div>
                </>
              )}

              {/* UNFOLD_OPTION_SLOT — flat mode */}
              {flatModeTessUnfoldVisible && (
                <>
                  <div className="h-px bg-slate-200/60 mx-1" />
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500 text-xs font-medium">
                        Sheet Metal
                      </span>
                      <button
                        type="button"
                        disabled={isUnfolding}
                        onClick={() => void handleTessUnfoldToggle(!flatEnabled)}
                        className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                          flatEnabled
                            ? "bg-blue-600 text-white shadow-md shadow-blue-200 border border-blue-600"
                            : "bg-slate-50 border border-blue-200/70 text-slate-700 hover:bg-white hover:border-blue-300"
                        } ${isUnfolding ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`}
                      >
                        {isUnfolding ? "Unfolding..." : flatEnabled ? "3D View" : "Unfold"}
                      </button>
                    </div>
                    {flatEnabled && tessUnfoldFlatDimensions && (
                      <div className="bg-slate-50/50 rounded-lg px-2 py-1 border border-slate-200/40">
                        <div className="text-[10px] uppercase tracking-wider text-slate-400 font-bold mb-0.5">
                          Flat Pattern
                        </div>
                        <div className="text-[11px] font-mono text-slate-700">
                          {`${fmt(convert(tessUnfoldFlatDimensions.width, units))} × ${fmt(convert(tessUnfoldFlatDimensions.height, units))} ${units}`}
                        </div>
                      </div>
                    )}
                    {flattenError && (
                      <div className="text-[11px] font-medium text-rose-600 leading-snug">
                        {flattenError}
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

              {cadFileMetadata !== null && (
                <button
                  onClick={() => setShowMetadataPanel((prev) => !prev)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                    showMetadataPanel
                      ? "bg-blue-600 text-white shadow-md shadow-blue-200 border border-blue-600"
                      : "bg-slate-50 border border-slate-200/60 text-slate-600 hover:bg-white hover:border-blue-200"
                  }`}
                >
                  View Metadata
                </button>
              )}

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

            {showMetadataPanel && cadFileMetadata !== null && (
              <div className="flex flex-col gap-2 rounded-2xl bg-white/80 p-4 backdrop-blur-xl shadow-[0_8px_30px_rgba(0,0,0,0.08)] border border-slate-200/50 w-[260px] max-h-[70vh] overflow-y-auto text-sm text-slate-600 ring-1 ring-black/[0.02]">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900 tracking-wide">
                    File Metadata
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowMetadataPanel(false)}
                    className="bg-transparent border-0 cursor-pointer text-slate-400 hover:text-slate-600 text-base leading-none px-1 py-0.5"
                    aria-label="Close metadata panel"
                  >
                    ×
                  </button>
                </div>
                <div className="h-px bg-slate-200/60 mx-1" />
                <div className="flex flex-col gap-2">
                  {(
                    [
                      ["File Name", cadFileMetadata.fileName],
                      ["Author", cadFileMetadata.author],
                      ["Organization", cadFileMetadata.organization],
                      ["Description", cadFileMetadata.description],
                      ["Timestamp", cadFileMetadata.timestamp],
                      ["Originating System", cadFileMetadata.originatingSystem],
                      ["Preprocessor", cadFileMetadata.preprocessorVersion],
                      ["Schema", cadFileMetadata.schema],
                    ] as [string, string | undefined][]
                  )
                    .filter(([, value]) => value && value.trim().length > 0)
                    .map(([label, value]) => (
                      <div key={label} className="flex gap-2 items-start">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider min-w-[88px] flex-shrink-0 pt-0.5">
                          {label}
                        </span>
                        <span className="text-[11px] text-slate-800 font-medium break-words">
                          {value}
                        </span>
                      </div>
                    ))}
                </div>
              </div>
            )}

            {assemblyMode === "parts" && parts.length > 0 && (
              <div className="w-[220px] max-h-[55vh] overflow-hidden flex flex-col gap-2 p-3 rounded-xl bg-white/90 border border-slate-200/70 shadow-[0_10px_24px_rgba(15,23,42,0.12)] backdrop-blur-xl ring-1 ring-black/[0.03]">
                <div className="text-xs font-bold text-slate-900">
                  Parts ({parts.length})
                </div>
                {viewerMode.kind === "assembly" ? (
                  <>
                    <div className="flex flex-col gap-1.5 overflow-y-auto pr-1">
                      {parts.map((part, index) => {
                        const label = getSafePartDisplayName(part.name, index);
                        const exportState = resolvePartExportState(part.key);
                        const isExportEnabled = exportState.enabled;
                        const showExportAction = exportState.plan !== null;
                        return (
                          <div
                            key={part.key}
                            onClick={() => {
                              setSelectedPartKey(part.key);
                              setPartExportMessage(null);
                              viewerRef.current?.isolateObject(part.object);
                              setPartMenu(null);
                            }}
                            className={`rounded-md px-2 py-1.5 text-xs font-semibold transition-colors ${
                              selectedPartKey === part.key
                                ? "bg-blue-600 text-white border border-blue-600 shadow-md shadow-blue-200"
                                : "bg-slate-50 text-slate-700 border border-slate-200/60 hover:bg-white hover:border-blue-200"
                            }`}
                            title={part.rawName ?? label}
                          >
                            <div className="flex items-center gap-1.5">
                              <div className="flex-1 truncate">{label}</div>
                              {showExportAction && (
                                <button
                                  type="button"
                                  onClick={(event) => {
                                    event.preventDefault();
                                    event.stopPropagation();
                                    setSelectedPartKey(part.key);
                                    void handleExportSelectedPart(part.key);
                                  }}
                                  disabled={!isExportEnabled}
                                  className={`rounded-md p-1 transition-colors ${
                                    isExportEnabled
                                      ? "bg-white/90 text-slate-700 hover:text-blue-700 hover:bg-white"
                                      : "bg-slate-100 text-slate-400 cursor-not-allowed"
                                  }`}
                                  title={exportState.reason}
                                  aria-label={`Export ${label}`}
                                >
                                  <Download className="h-3.5 w-3.5" />
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <div className="h-px bg-slate-200/60 my-1" />
                    <button
                      disabled={!selectedPartKey}
                      onClick={() => {
                        if (!selectedPartKey) {
                          setPartExportMessage("Select a part first.");
                          return;
                        }
                        void openPartView(selectedPartKey);
                      }}
                      className={`rounded-md px-2 py-1.5 text-[11px] font-semibold transition-colors ${
                        selectedPartKey
                          ? "bg-blue-50 text-blue-700 border border-blue-200 hover:bg-white"
                          : "bg-slate-100 text-slate-400 border border-slate-200/60 cursor-not-allowed"
                      }`}
                    >
                      <span className="inline-flex items-center gap-1">
                        <ExternalLink className="h-3.5 w-3.5" />
                        Open Selected Part
                      </span>
                    </button>
                    {partExportMessage && (
                      <div className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] text-slate-600">
                        {partExportMessage}
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    {(() => {
                      const selectedIndex = parts.findIndex(
                        (part) => part.key === viewerMode.partKey,
                      );
                      if (selectedIndex < 0) return null;
                      const selectedPart = parts[selectedIndex];
                      const selectedLabel = getSafePartDisplayName(
                        selectedPart.name,
                        selectedIndex,
                      );
                      return (
                        <div className="rounded-md border border-blue-200 bg-blue-50 px-2 py-1 text-[11px] font-medium text-blue-700 truncate">
                          {selectedLabel}
                        </div>
                      );
                    })()}
                    <div className="h-px bg-slate-200/60 my-1" />
                    <button
                      onClick={backToAssemblyView}
                      className="rounded-md px-2 py-1.5 text-[11px] font-semibold transition-colors bg-slate-50 text-slate-700 border border-slate-200/60 hover:bg-white hover:border-blue-200"
                    >
                      <span className="inline-flex items-center gap-1">
                        <ArrowLeft className="h-3.5 w-3.5" />
                        Back to Assembly
                      </span>
                    </button>
                  </>
                )}
              </div>
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
