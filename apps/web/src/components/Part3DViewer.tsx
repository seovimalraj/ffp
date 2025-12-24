"use client";
import React, { Suspense, useMemo, useRef, useState, useCallback } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
  OrbitControls,
  GizmoHelper,
  GizmoViewport,
  Html,
  Line,
} from "@react-three/drei";
import * as THREE from "three";

// Types for geometry payload (very light abstraction; adapt when server sends mesh data)
export interface PartGeometryPayload {
  vertices?: number[]; // flat array x,y,z,...
  indices?: number[]; // triangle indices
  bbox?: [number, number, number, number, number, number];
  status?: string;
  metrics?: { volume_cc?: number; surface_area_cm2?: number };
  features?: any[];
}

interface Part3DViewerProps {
  geometry?: PartGeometryPayload | any; // raw server geometry event
  className?: string;
}

// Simple converter: builds BufferGeometry from flat arrays
function buildGeometry(g: PartGeometryPayload) {
  const geom = new THREE.BufferGeometry();
  if (g.vertices) {
    const pos = new Float32Array(g.vertices);
    geom.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  }
  if (g.indices) {
    const idx = new Uint32Array(g.indices);
    geom.setIndex(new THREE.BufferAttribute(idx, 1));
  }
  geom.computeBoundingBox();
  geom.computeBoundingSphere();
  try {
    geom.computeVertexNormals();
  } catch {
    /* ignore */
  }
  return geom;
}

const AutoRotate: React.FC<{ enabled: boolean; speed?: number }> = ({
  enabled,
  speed = 0.3,
}) => {
  const group = useRef<THREE.Group>(null);
  useFrame((_, delta) => {
    if (!enabled || !group.current) return;
    group.current.rotation.y += speed * delta;
  });
  return <group ref={group} />;
};

const DynamicClipping: React.FC<{ plane: THREE.Plane | null }> = ({
  plane,
}) => {
  const { gl } = useThree();
  // Enable/disable clipping globally
  useMemo(() => {
    gl.localClippingEnabled = !!plane;
    return () => {
      gl.localClippingEnabled = false;
    };
  }, [gl, plane]);
  return null;
};

const MeshViewer: React.FC<{
  geom: THREE.BufferGeometry;
  color: string;
  wireframe: boolean;
  sectionPlane: THREE.Plane | null;
  showEdges: boolean;
}> = ({ geom, color, wireframe, sectionPlane, showEdges }) => {
  const material = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color,
        metalness: 0.1,
        roughness: 0.8,
        clippingPlanes: sectionPlane ? [sectionPlane] : [],
        side: THREE.DoubleSide,
      }),
    [color, sectionPlane],
  );
  const edges = useMemo(() => new THREE.EdgesGeometry(geom), [geom]);
  return (
    <group>
      <mesh geometry={geom} material={material}>
        {wireframe && (
          <meshBasicMaterial
            color="#ffffff"
            wireframe
            transparent
            opacity={0.35}
          />
        )}
      </mesh>
      {showEdges && (
        <lineSegments geometry={edges}>
          <lineBasicMaterial color="#111" linewidth={1} />
        </lineSegments>
      )}
    </group>
  );
};

interface MeasurePoint {
  position: THREE.Vector3;
}

const MeasurementLayer: React.FC<{
  active: boolean;
  onComplete: (d: number) => void;
}> = ({ active, onComplete }) => {
  const { gl } = useThree();
  const [points, setPoints] = useState<MeasurePoint[]>([]);
  const handleClick = useCallback(
    (e: any) => {
      if (!active) return;
      e.stopPropagation();
      const pt = e.point.clone();
      setPoints((prev) => {
        if (prev.length === 1) {
          const dist = prev[0].position.distanceTo(pt);
          onComplete(dist);
          return [];
        }
        return [...prev, { position: pt }];
      });
    },
    [active, onComplete],
  );
  useFrame(() => {
    gl.autoClear = true;
  });
  return (
    <group onClick={handleClick}>
      {points.map((p, i) => (
        <mesh key={i} position={p.position}>
          <sphereGeometry args={[0.4, 12, 12]} />
          <meshBasicMaterial color={i === 0 ? "#ff9800" : "#2196f3"} />
        </mesh>
      ))}
      {points.length === 2 && (
        <Line
          points={[points[0].position, points[1].position]}
          color="#2196f3"
          lineWidth={2}
        >
          <Html distanceFactor={8} center>
            <div className="px-1 py-0.5 rounded bg-blue-600 text-white text-[10px] font-mono">
              {points[0].position.distanceTo(points[1].position).toFixed(2)}
            </div>
          </Html>
        </Line>
      )}
    </group>
  );
};

export const Part3DViewer: React.FC<Part3DViewerProps> = ({
  geometry,
  className,
}) => {
  const [color, setColor] = useState("#4372ff");
  const [bg, setBg] = useState<"light" | "dark" | "grid">("light");
  const [wireframe, setWireframe] = useState(false);
  const [showEdges, setShowEdges] = useState(true);
  const [autoRotate, setAutoRotate] = useState(false);
  const [section, setSection] = useState(false);
  const [measure, setMeasure] = useState(false);
  const [lastMeasurement, setLastMeasurement] = useState<number | null>(null);

  const geom = useMemo(
    () =>
      geometry && (geometry.vertices || geometry.indices)
        ? buildGeometry(geometry)
        : null,
    [geometry],
  );
  const sectionPlane = useMemo(
    () => (section ? new THREE.Plane(new THREE.Vector3(0, -1, 0), 0) : null),
    [section],
  );

  const resetView = () => {
    // For now: just toggle autoRotate off and reset measurement
    setAutoRotate(false);
    setLastMeasurement(null);
  };

  return (
    <div
      className={
        "rounded border border-gray-200 dark:border-gray-700 p-2 flex flex-col gap-2 " +
        (className || "")
      }
    >
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold text-gray-500">3D VIEWER</h3>
        <div className="flex gap-1">
          <button
            onClick={() => setWireframe((w) => !w)}
            className="px-2 py-0.5 rounded border text-[10px]"
            title="Toggle wireframe"
          >
            Wf
          </button>
          <button
            onClick={() => setShowEdges((e) => !e)}
            className="px-2 py-0.5 rounded border text-[10px]"
            title="Toggle edges"
          >
            Ed
          </button>
          <button
            onClick={() => setSection((s) => !s)}
            className={
              "px-2 py-0.5 rounded border text-[10px] " +
              (section ? "bg-blue-600 text-white" : "")
            }
            title="Section plane"
          >
            Sec
          </button>
          <button
            onClick={() => setMeasure((m) => !m)}
            className={
              "px-2 py-0.5 rounded border text-[10px] " +
              (measure ? "bg-blue-600 text-white" : "")
            }
            title="Measure distance"
          >
            Meas
          </button>
          <button
            onClick={() => setAutoRotate((a) => !a)}
            className={
              "px-2 py-0.5 rounded border text-[10px] " +
              (autoRotate ? "bg-blue-600 text-white" : "")
            }
            title="Auto rotate"
          >
            Rot
          </button>
          <button
            onClick={() => resetView()}
            className="px-2 py-0.5 rounded border text-[10px]"
            title="Reset view"
          >
            Rst
          </button>
        </div>
      </div>
      <div className="relative h-72 bg-gray-50 dark:bg-gray-900 rounded overflow-hidden">
        <Canvas
          camera={{ position: [60, 40, 60], fov: 45 }}
          dpr={[1, 2]}
          shadows
        >
          <color
            attach="background"
            args={[bg === "dark" ? "#111" : "#f8f9fb"]}
          />
          <ambientLight intensity={0.6} />
          <directionalLight
            position={[40, 60, 50]}
            intensity={0.8}
            castShadow
          />
          <Suspense
            fallback={
              <Html center>
                <div className="text-[10px] text-gray-500">Loading…</div>
              </Html>
            }
          >
            {geom ? (
              <group>
                <DynamicClipping plane={sectionPlane} />
                <MeshViewer
                  geom={geom}
                  color={color}
                  wireframe={wireframe}
                  sectionPlane={sectionPlane}
                  showEdges={showEdges}
                />
                <AutoRotate enabled={autoRotate} />
                {measure && (
                  <MeasurementLayer
                    active={measure}
                    onComplete={(d) => {
                      setLastMeasurement(d);
                      setMeasure(false);
                    }}
                  />
                )}
              </group>
            ) : (
              <Html center>
                <div className="text-[11px] text-gray-500">No mesh yet</div>
              </Html>
            )}
          </Suspense>
          <OrbitControls
            makeDefault
            enablePan
            enableRotate
            enableZoom
            zoomSpeed={0.75}
          />
          <GizmoHelper alignment="bottom-right" margin={[60, 60]}>
            <GizmoViewport
              axisColors={["#ff5555", "#55ff55", "#5555ff"]}
              labelColor="white"
            />
          </GizmoHelper>
        </Canvas>
        {lastMeasurement !== null && (
          <div className="absolute bottom-1 left-1 bg-black/60 text-white text-[10px] px-1 rounded">
            {lastMeasurement.toFixed(2)}
          </div>
        )}
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        <label className="text-[10px] text-gray-500">
          Color
          <input
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            className="ml-1 h-4 w-4 cursor-pointer"
          />
        </label>
        <label className="text-[10px] text-gray-500">
          BG
          <select
            value={bg}
            onChange={(e) => setBg(e.target.value as any)}
            className="ml-1 border rounded text-[10px] py-0.5"
          >
            <option value="light">Light</option>
            <option value="dark">Dark</option>
            <option value="grid">Grid</option>
          </select>
        </label>
        <div className="text-[10px] text-gray-400">
          {geometry?.status || "pending"}
        </div>
      </div>
      {/* NOTE(Future): Add STL/STEP loader, multi-part overlay, explode view, section plane orientation controls, translucency slider */}
    </div>
  );
};

export default Part3DViewer;
