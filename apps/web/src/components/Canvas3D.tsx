"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { OrbitControls, Environment, Html } from "@react-three/drei";
import * as THREE from "three";

import type { DfmSelectionHint } from "@cnc-quote/shared";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

interface SelectedIssue {
  id: string;
  label?: string;
  selection_hint?: DfmSelectionHint;
}

interface Canvas3DProps {
  meshUrl: string | null;
  meshVersion?: string;
  selectedIssue?: SelectedIssue | null;
  highlightColor?: string;
  className?: string;
}

interface LoadedMesh {
  scene: THREE.Group;
  primaryMesh: THREE.Mesh | null;
}

interface GLTFLike {
  scene: THREE.Group;
}

function findFirstMesh(object: THREE.Object3D): THREE.Mesh | null {
  if ((object as THREE.Mesh).isMesh) {
    return object as THREE.Mesh;
  }
  for (const child of object.children) {
    const mesh = findFirstMesh(child);
    if (mesh) return mesh;
  }
  return null;
}

function cloneScene(scene: THREE.Group | null) {
  return scene ? scene.clone(true) : null;
}

async function parseGlb(arrayBuffer: ArrayBuffer): Promise<GLTFLike> {
  const loader = new GLTFLoader();
  return new Promise((resolve, reject) => {
    loader.parse(arrayBuffer, "", resolve, reject);
  });
}

function buildHighlightGeometry(
  source: THREE.BufferGeometry,
  triangles: readonly number[],
): THREE.BufferGeometry | null {
  const positionAttr = source.getAttribute("position");
  if (!positionAttr) return null;
  const indexAttr = source.getIndex();
  const totalTriangles = indexAttr
    ? indexAttr.count / 3
    : positionAttr.count / 3;
  if (!Number.isFinite(totalTriangles) || totalTriangles <= 0) return null;

  const validTriangles = triangles.filter(
    (tri) => tri >= 0 && tri < totalTriangles,
  );
  if (!validTriangles.length) return null;

  const highlight = new THREE.BufferGeometry();
  const vertices = new Float32Array(validTriangles.length * 9);
  let offset = 0;

  for (const tri of validTriangles) {
    const baseIndex = tri * 3;
    const i0 = indexAttr ? (indexAttr.array as any)[baseIndex] : baseIndex;
    const i1 = indexAttr
      ? (indexAttr.array as any)[baseIndex + 1]
      : baseIndex + 1;
    const i2 = indexAttr
      ? (indexAttr.array as any)[baseIndex + 2]
      : baseIndex + 2;
    const v0 = [
      positionAttr.getX(i0),
      positionAttr.getY(i0),
      positionAttr.getZ(i0),
    ];
    const v1 = [
      positionAttr.getX(i1),
      positionAttr.getY(i1),
      positionAttr.getZ(i1),
    ];
    const v2 = [
      positionAttr.getX(i2),
      positionAttr.getY(i2),
      positionAttr.getZ(i2),
    ];
    vertices.set([...v0, ...v1, ...v2], offset);
    offset += 9;
  }

  highlight.setAttribute("position", new THREE.BufferAttribute(vertices, 3));
  highlight.computeVertexNormals();
  highlight.computeBoundingBox();
  highlight.computeBoundingSphere();
  return highlight;
}

const HighlightMesh: React.FC<{
  geometry: THREE.BufferGeometry | null;
  color: string;
}> = ({ geometry, color }) => {
  const material = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.45,
        side: THREE.DoubleSide,
      }),
    [color],
  );

  useEffect(() => () => material.dispose(), [material]);

  if (!geometry) return null;
  return <mesh geometry={geometry} material={material} />;
};

const CameraFocus: React.FC<{ geometry: THREE.BufferGeometry | null }> = ({
  geometry,
}) => {
  const { camera, controls } = useThree((state) => ({
    camera: state.camera,
    controls: state.controls as any,
  }));

  useEffect(() => {
    if (!geometry || !controls) return;
    geometry.computeBoundingSphere();
    const sphere = geometry.boundingSphere;
    if (!sphere) return;

    const target = sphere.center.clone();
    const currentDir = camera.position.clone().sub(controls.target).normalize();
    const distance = Math.max(sphere.radius * 3, 10);
    const newPosition = target.clone().add(currentDir.multiplyScalar(distance));

    camera.position.lerp(newPosition, 0.45);
    controls.target.copy(target);
    controls.update();
  }, [geometry, camera, controls]);

  return null;
};

export const Canvas3D: React.FC<Canvas3DProps> = ({
  meshUrl,
  meshVersion,
  selectedIssue,
  highlightColor = "#f97316",
  className,
}) => {
  const [loaded, setLoaded] = useState<LoadedMesh | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!meshUrl) {
      setLoaded(null);
      return;
    }

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(meshUrl, {
          method: "GET",
          credentials: "include",
          cache: "no-store",
          headers: {
            Accept: "model/gltf-binary",
          },
        });
        if (!response.ok) {
          throw new Error(`Mesh request failed (${response.status})`);
        }
        const arrayBuffer = await response.arrayBuffer();
        const gltf = await parseGlb(arrayBuffer);
        if (!cancelled) {
          const primaryMesh = findFirstMesh(gltf.scene);
          setLoaded({ scene: gltf.scene, primaryMesh });
        }
      } catch (err) {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : String(err);
          setError(message);
          setLoaded(null);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [meshUrl, meshVersion]);

  const highlightGeometry = useMemo(() => {
    if (
      !loaded?.primaryMesh ||
      !selectedIssue?.selection_hint?.triangle_indices?.length
    ) {
      return null;
    }
    const geometry = loaded.primaryMesh.geometry;
    try {
      return buildHighlightGeometry(
        geometry,
        selectedIssue.selection_hint.triangle_indices,
      );
    } catch (err) {
      console.warn("Failed to build highlight geometry", err);
      return null;
    }
  }, [loaded, selectedIssue]);

  useEffect(
    () => () => {
      highlightGeometry?.dispose();
    },
    [highlightGeometry],
  );

  const sceneClone = useMemo(() => cloneScene(loaded?.scene ?? null), [loaded]);

  return (
    <div className={`relative h-full w-full ${className ?? ""}`}>
      <Canvas camera={{ position: [120, 90, 120], fov: 45 }} dpr={[1, 2]}>
        <color attach="background" args={["#f8f9fb"]} />
        <ambientLight intensity={0.6} />
        <directionalLight intensity={0.9} position={[80, 120, 60]} />
        {sceneClone ? (
          <primitive object={sceneClone} />
        ) : (
          <Html center>
            <div className="text-xs text-gray-500">
              {loading ? "Loading mesh…" : "Mesh unavailable"}
            </div>
          </Html>
        )}
        <HighlightMesh geometry={highlightGeometry} color={highlightColor} />
        <CameraFocus geometry={highlightGeometry} />
        <OrbitControls makeDefault enablePan enableRotate enableZoom />
        <Environment preset="city" />
      </Canvas>
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/70 text-sm text-gray-600">
          Loading 3D model…
        </div>
      )}
      {error && !loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-red-100 text-sm text-red-600">
          {error}
        </div>
      )}
      {selectedIssue?.label && (
        <div className="absolute top-2 left-2 bg-black/70 text-white text-xs px-2 py-1 rounded">
          {selectedIssue.label}
        </div>
      )}
    </div>
  );
};

export default Canvas3D;
