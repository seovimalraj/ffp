"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";

import type { CadViewerRef } from "@/components/cad/cad-viewer";

import {
  deriveModelTransform,
  toCad,
  toWorld,
  type ModelTransform,
  type Vec3,
} from "../lib/model-transform";
import {
  KIND_COLORS,
  pickNearestEntity,
  type SelectableEntity,
} from "../lib/selectable";
import type { BoundingBox } from "@/types/machining-analysis";

/**
 * Hollow feature outlines drawn over the 3D viewer.
 *
 * Rendered as SVG in screen space rather than as meshes in the scene: an
 * outline cannot obscure the model it annotates, it needs no changes to the
 * shared viewer, and it stays crisp at any zoom. Each outline is real 3D
 * geometry - a hole's rim is a true circle on its own axis - projected through
 * the viewer's camera every time the view changes.
 */

interface FeatureOverlayProps {
  viewerRef: React.RefObject<CadViewerRef | null>;
  entities: SelectableEntity[];
  /** Bounding box of the analysed model, in CAD space. */
  analysisBox: BoundingBox | null;
  selectedId: string | null;
  hoveredId: string | null;
  onSelect: (id: string | null) => void;
  onHover: (id: string | null) => void;
  /** Model must be loaded before the viewer can report its bounds. */
  ready: boolean;
  onTransformResolved?: (transform: ModelTransform) => void;
}

interface ProjectedPoint {
  x: number;
  y: number;
  visible: boolean;
}

export function FeatureOverlay({
  viewerRef,
  entities,
  analysisBox,
  selectedId,
  hoveredId,
  onSelect,
  onHover,
  ready,
  onTransformResolved,
}: FeatureOverlayProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [transform, setTransform] = useState<ModelTransform | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  // Bumped on every camera move to force a re-project.
  const [tick, setTick] = useState(0);

  const selected = useMemo(
    () => entities.find((entity) => entity.id === selectedId) ?? null,
    [entities, selectedId],
  );
  const hovered = useMemo(
    () => entities.find((entity) => entity.id === hoveredId) ?? null,
    [entities, hoveredId],
  );

  // --- resolve the CAD -> world transform once the model is loaded ---------
  useEffect(() => {
    if (!ready || !analysisBox) return;
    let cancelled = false;

    // The viewer reports empty bounds until geometry lands; poll briefly.
    const attempt = (remaining: number) => {
      if (cancelled) return;
      const viewer = viewerRef.current?.getViewer?.();
      const box = viewer?.getModelWorldBox?.() ?? null;
      if (box) {
        const resolved = deriveModelTransform(analysisBox, box);
        setTransform(resolved);
        onTransformResolved?.(resolved);
        return;
      }
      if (remaining > 0) window.setTimeout(() => attempt(remaining - 1), 200);
    };
    attempt(25);

    return () => {
      cancelled = true;
    };
  }, [ready, analysisBox, viewerRef, onTransformResolved]);

  // --- follow the camera ---------------------------------------------------
  useEffect(() => {
    if (!ready) return;
    const viewer = viewerRef.current?.getViewer?.();
    if (!viewer) return;

    const sync = () => {
      const dimensions = viewer.getRendererSize();
      setSize((previous) =>
        previous.width === dimensions.width && previous.height === dimensions.height
          ? previous
          : dimensions,
      );
      setTick((value) => value + 1);
    };
    sync();
    return viewer.onViewChanged(sync);
  }, [ready, viewerRef, transform]);

  const project = useCallback(
    (point: Vec3): ProjectedPoint | null => {
      const viewer = viewerRef.current?.getViewer?.();
      if (!viewer || !transform?.valid) return null;
      const world = toWorld(point, transform);
      const screen = viewer.projectWorldToScreen(
        new THREE.Vector3(world[0], world[1], world[2]),
      );
      return screen;
    },
    // `tick` is intentionally in the dependency list: it is the signal that
    // the camera moved and every cached projection is stale.
    [viewerRef, transform, tick],
  );

  const projectPolyline = useCallback(
    (points: Vec3[]): string | null => {
      const projected = points.map(project);
      if (projected.some((p) => !p || !p.visible)) return null;
      return projected
        .map((p, index) => `${index === 0 ? "M" : "L"}${p!.x.toFixed(1)},${p!.y.toFixed(1)}`)
        .join(" ");
    },
    [project],
  );

  // --- picking -------------------------------------------------------------
  const handlePointer = useCallback(
    (event: React.MouseEvent<SVGSVGElement>, mode: "select" | "hover") => {
      const viewer = viewerRef.current?.getViewer?.();
      const svg = svgRef.current;
      if (!viewer || !svg || !transform?.valid) return;

      const rect = svg.getBoundingClientRect();
      const ndcX = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      const ndcY = -(((event.clientY - rect.top) / rect.height) * 2 - 1);

      const hit = viewer.pickMeshAtScreenPosition(ndcX, ndcY);
      if (!hit) {
        if (mode === "select") onSelect(null);
        else onHover(null);
        return;
      }

      const cad = toCad(hit.point, transform) as Vec3;
      // Tolerance scales with the model so it works for a 5 mm part and a 2 m one.
      const span = analysisBox
        ? Math.max(
            analysisBox.max.x - analysisBox.min.x,
            analysisBox.max.y - analysisBox.min.y,
            analysisBox.max.z - analysisBox.min.z,
          )
        : 100;
      const entity = pickNearestEntity(entities, cad, span * 0.08);

      if (mode === "select") onSelect(entity?.id ?? null);
      else onHover(entity?.id ?? null);
    },
    [viewerRef, transform, entities, analysisBox, onSelect, onHover],
  );

  if (!ready || !transform) return null;

  if (!transform.valid) {
    return (
      <div className="pointer-events-none absolute bottom-4 right-4 max-w-xs rounded-lg border border-amber-200 bg-amber-50/95 px-3 py-2 text-[11px] leading-relaxed text-amber-900 shadow-lg backdrop-blur">
        Feature highlighting is unavailable for this model: {transform.reason}
      </div>
    );
  }

  const highlights = [
    hovered && hovered.id !== selectedId
      ? { entity: hovered, opacity: 0.55, width: 1.5, dashed: true }
      : null,
    selected ? { entity: selected, opacity: 1, width: 2.25, dashed: false } : null,
  ].filter(Boolean) as Array<{
    entity: SelectableEntity;
    opacity: number;
    width: number;
    dashed: boolean;
  }>;

  return (
    <svg
      ref={svgRef}
      className="absolute inset-0 h-full w-full"
      style={{ cursor: hoveredId ? "pointer" : "default" }}
      width={size.width || undefined}
      height={size.height || undefined}
      onClick={(event) => handlePointer(event, "select")}
      onMouseMove={(event) => handlePointer(event, "hover")}
      onMouseLeave={() => onHover(null)}
    >
      <defs>
        {/* A soft glow keeps a thin outline readable against a light model. */}
        <filter id="feature-outline-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feDropShadow dx="0" dy="0" stdDeviation="2" floodColor="#ffffff" floodOpacity="0.9" />
        </filter>
      </defs>

      {highlights.map(({ entity, opacity, width, dashed }) => {
        const color = KIND_COLORS[entity.kind];
        const paths = entity.outline
          .map((polyline) => projectPolyline(polyline))
          .filter(Boolean) as string[];
        const anchor = project(entity.anchor);

        return (
          <g key={entity.id} filter="url(#feature-outline-glow)" opacity={opacity}>
            {paths.map((d, index) => (
              <path
                key={index}
                d={d}
                fill="none"
                stroke={color}
                strokeWidth={width}
                strokeDasharray={dashed ? "5 4" : undefined}
                strokeLinecap="round"
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
              />
            ))}

            {anchor?.visible && (
              <>
                <circle cx={anchor.x} cy={anchor.y} r={4} fill={color} fillOpacity={0.25} />
                <circle
                  cx={anchor.x}
                  cy={anchor.y}
                  r={4}
                  fill="none"
                  stroke={color}
                  strokeWidth={1.5}
                />
                {!dashed && (
                  <text
                    x={anchor.x + 10}
                    y={anchor.y - 8}
                    fill={color}
                    fontSize={11}
                    fontWeight={600}
                    style={{ paintOrder: "stroke", stroke: "#fff", strokeWidth: 3 }}
                  >
                    {entity.label}
                  </text>
                )}
              </>
            )}
          </g>
        );
      })}
    </svg>
  );
}
