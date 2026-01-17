"use client";

import React, { useEffect, useState, useRef } from "react";
import { Canvas, useThree, useFrame } from "@react-three/fiber";
import { OrbitControls, Environment, Html } from "@react-three/drei";
import * as THREE from "three";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader.js";

interface STLViewerProps {
  meshUrl: string | null;
  selectedIssue?: {
    id: string;
    label?: string;
    selection_hint?: {
      type: string;
      location?: { x: number; y: number; z: number };
      triangles?: number[];
      description?: string;
    };
  } | null;
  highlightColor?: string;
  className?: string;
}

interface LoadedMesh {
  geometry: THREE.BufferGeometry;
  highlightGeometry?: THREE.BufferGeometry | null;
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
    const i1 = indexAttr ? (indexAttr.array as any)[baseIndex + 1] : baseIndex + 1;
    const i2 = indexAttr ? (indexAttr.array as any)[baseIndex + 2] : baseIndex + 2;
    
    for (let idx of [i0, i1, i2]) {
      vertices[offset++] = positionAttr.getX(idx);
      vertices[offset++] = positionAttr.getY(idx);
      vertices[offset++] = positionAttr.getZ(idx);
    }
  }

  highlight.setAttribute("position", new THREE.BufferAttribute(vertices, 3));
  highlight.computeVertexNormals();
  return highlight;
}

const STLMesh: React.FC<{ loaded: LoadedMesh; highlightColor: string }> = ({
  loaded,
  highlightColor,
}) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const highlightRef = useRef<THREE.Mesh>(null);
  
  // Pulsing animation for highlighted feature
  useEffect(() => {
    if (!highlightRef.current || !loaded.highlightGeometry) return;
    
    let animationId: number;
    let time = 0;
    
    const animate = () => {
      time += 0.05;
      const pulseScale = 1 + Math.sin(time) * 0.05;
      const emissiveIntensity = 0.5 + Math.sin(time * 2) * 0.3;
      
      if (highlightRef.current && highlightRef.current.material) {
        (highlightRef.current.material as THREE.MeshStandardMaterial).emissiveIntensity = emissiveIntensity;
        highlightRef.current.scale.setScalar(pulseScale);
      }
      
      animationId = requestAnimationFrame(animate);
    };
    
    animate();
    return () => cancelAnimationFrame(animationId);
  }, [loaded.highlightGeometry]);
  
  return (
    <group>
      {/* Main mesh */}
      <mesh ref={meshRef} geometry={loaded.geometry}>
        <meshStandardMaterial
          color="#e8e8e8"
          roughness={0.3}
          metalness={0.4}
          side={THREE.DoubleSide}
        />
      </mesh>
      
      {/* Wireframe overlay for better depth perception */}
      <mesh geometry={loaded.geometry}>
        <meshBasicMaterial
          color="#cccccc"
          wireframe
          transparent
          opacity={0.1}
          side={THREE.DoubleSide}
        />
      </mesh>
      
      {/* Highlight mesh with pulsing effect */}
      {loaded.highlightGeometry && (
        <>
          <mesh ref={highlightRef} geometry={loaded.highlightGeometry} position={[0, 0, 0.02]}>
            <meshStandardMaterial
              color={highlightColor}
              emissive={highlightColor}
              emissiveIntensity={0.7}
              roughness={0.1}
              metalness={0.9}
              transparent
              opacity={0.95}
              side={THREE.DoubleSide}
            />
          </mesh>
          {/* Glow effect */}
          <mesh geometry={loaded.highlightGeometry} position={[0, 0, 0.04]}>
            <meshBasicMaterial
              color={highlightColor}
              transparent
              opacity={0.3}
              side={THREE.DoubleSide}
            />
          </mesh>
        </>
      )}
    </group>
  );
};

const CameraFocus: React.FC<{ 
  geometry: THREE.BufferGeometry | null;
  focusLocation?: { x: number; y: number; z: number } | null;
}> = ({ geometry, focusLocation }) => {
  const { camera, controls } = useThree((state) => ({
    camera: state.camera,
    controls: state.controls as any,
  }));

  useEffect(() => {
    if (!geometry || !controls) return;
    
    // If we have a specific focus location, animate to it
    if (focusLocation) {
      const target = new THREE.Vector3(focusLocation.x, focusLocation.y, focusLocation.z);
      const currentDir = camera.position.clone().sub(controls.target).normalize();
      const distance = 50; // Closer view for feature inspection
      const newPosition = target.clone().add(currentDir.multiplyScalar(distance));

      // Smooth animation to feature
      const animateCamera = () => {
        camera.position.lerp(newPosition, 0.1);
        controls.target.lerp(target, 0.1);
        controls.update();
        
        const distanceToTarget = camera.position.distanceTo(newPosition);
        if (distanceToTarget > 0.1) {
          requestAnimationFrame(animateCamera);
        }
      };
      animateCamera();
      return;
    }
    
    // Default: fit entire model in view
    geometry.computeBoundingSphere();
    const sphere = geometry.boundingSphere;
    if (!sphere) return;

    const target = sphere.center.clone();
    const currentDir = camera.position.clone().sub(controls.target).normalize();
    const distance = Math.max(sphere.radius * 2.5, 10);
    const newPosition = target.clone().add(currentDir.multiplyScalar(distance));

    camera.position.lerp(newPosition, 0.5);
    controls.target.copy(target);
    controls.update();
  }, [geometry, focusLocation, camera, controls]);

  return null;
};

export const STLViewer: React.FC<STLViewerProps> = ({
  meshUrl,
  selectedIssue,
  highlightColor = "#3b82f6",
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
        const response = await fetch(meshUrl);
        if (!response.ok) {
          throw new Error(`Failed to load STL (${response.status})`);
        }
        const arrayBuffer = await response.arrayBuffer();
        const loader = new STLLoader();
        const geometry = loader.parse(arrayBuffer);
        geometry.computeVertexNormals();
        geometry.center();
        
        if (!cancelled) {
          setLoaded({ geometry, highlightGeometry: null });
        }
      } catch (err) {
        if (!cancelled) {
          console.error("STL load error:", err);
          setError(err instanceof Error ? err.message : "Failed to load STL");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [meshUrl]);

  useEffect(() => {
    if (!loaded || !selectedIssue?.selection_hint?.triangles) {
      if (loaded) {
        setLoaded({ ...loaded, highlightGeometry: null });
      }
      return;
    }

    const triangles = selectedIssue.selection_hint.triangles;
    const highlightGeometry = buildHighlightGeometry(loaded.geometry, triangles);
    setLoaded({ ...loaded, highlightGeometry });
  }, [selectedIssue, loaded?.geometry]);

  if (error) {
    return (
      <div className={className}>
        <div className="h-full flex items-center justify-center text-red-600">
          <p className="text-sm">{error}</p>
        </div>
      </div>
    );
  }

  if (loading || !loaded) {
    return (
      <div className={className}>
        <div className="h-full flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      </div>
    );
  }

  return (
    <div className={className}>
      <Canvas
        camera={{ position: [100, 100, 100], fov: 50 }}
        style={{ background: "#f8fafc" }}
      >
        <ambientLight intensity={0.6} />
        <directionalLight position={[10, 10, 5]} intensity={1.0} castShadow />
        <directionalLight position={[-10, -10, -5]} intensity={0.4} />
        <pointLight position={[0, 50, 0]} intensity={0.3} />
        <STLMesh loaded={loaded} highlightColor={highlightColor} />
        <CameraFocus 
          geometry={loaded.geometry} 
          focusLocation={selectedIssue?.selection_hint?.location}
        />
        <OrbitControls
          enableDamping
          dampingFactor={0.05}
          rotateSpeed={0.5}
          enablePan
          panSpeed={0.5}
          zoomSpeed={0.8}
        />
        <Environment preset="studio" />
        <gridHelper args={[200, 20, "#d0d0d0", "#f0f0f0"]} position={[0, -50, 0]} />
        
        {/* Feature annotation */}
        {selectedIssue?.selection_hint?.description && (
          <Html
            position={[
              selectedIssue.selection_hint.location?.x || 0,
              (selectedIssue.selection_hint.location?.y || 0) + 10,
              selectedIssue.selection_hint.location?.z || 0
            ]}
            center
          >
            <div className="bg-blue-600 text-white px-3 py-1.5 rounded-lg shadow-lg text-xs font-bold whitespace-nowrap">
              {selectedIssue.selection_hint.description}
            </div>
          </Html>
        )}
      </Canvas>
    </div>
  );
};

export default STLViewer;
