"use client";

import {
  Suspense,
  useRef,
  useEffect,
  useState,
  Component,
  ReactNode,
} from "react";
import { Canvas } from "@react-three/fiber";
import {
  OrbitControls,
  PerspectiveCamera,
  Grid,
  Environment,
} from "@react-three/drei";
import * as THREE from "three";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader.js";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js";
import { Card } from "@/components/ui/card";
import { AlertCircle, Box, Loader2 } from "lucide-react";
import STEPViewer from "./step-file-viewer";

class ErrorBoundary extends Component<
  { children: ReactNode; fallback: ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: ReactNode; fallback: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error("3D Viewer Error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }
    return this.props.children;
  }
}

interface CadViewer3DProps {
  fileName: string;
  file?: File;
  width?: string;
  height?: string;
  className?: string;
}

function STLModel({ file }: { file: File }) {
  const meshRef = useRef<THREE.Mesh>(null);
  const [geometry, setGeometry] = useState<THREE.BufferGeometry | null>(null);

  useEffect(() => {
    const loader = new STLLoader();
    const reader = new FileReader();

    reader.onload = (event) => {
      const arrayBuffer = event.target?.result as ArrayBuffer;
      const loadedGeometry = loader.parse(arrayBuffer);

      // Center and normalize geometry
      loadedGeometry.computeBoundingBox();
      const boundingBox = loadedGeometry.boundingBox!;
      const center = new THREE.Vector3();
      boundingBox.getCenter(center);
      loadedGeometry.translate(-center.x, -center.y, -center.z);

      // Scale to fit
      const size = new THREE.Vector3();
      boundingBox.getSize(size);
      const maxDim = Math.max(size.x, size.y, size.z);
      const scale = 5 / maxDim; // Scale to 5 units
      loadedGeometry.scale(scale, scale, scale);

      loadedGeometry.computeVertexNormals();
      setGeometry(loadedGeometry);
    };

    reader.readAsArrayBuffer(file);

    return () => {
      geometry?.dispose();
    };
  }, [file]);

  if (!geometry) return null;

  return (
    <mesh ref={meshRef} geometry={geometry} castShadow receiveShadow>
      <meshStandardMaterial
        color="#4a90e2"
        metalness={0.6}
        roughness={0.3}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

function OBJModel({ file }: { file: File }) {
  const groupRef = useRef<THREE.Group>(null);
  const [object, setObject] = useState<THREE.Group | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loader = new OBJLoader();
    const reader = new FileReader();

    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const loadedObject = loader.parse(text);

        // Calculate bounding box and center
        const box = new THREE.Box3().setFromObject(loadedObject);
        const center = new THREE.Vector3();
        box.getCenter(center);
        loadedObject.position.sub(center);

        // Scale to fit
        const size = new THREE.Vector3();
        box.getSize(size);
        const maxDim = Math.max(size.x, size.y, size.z);
        const scale = 5 / maxDim;
        loadedObject.scale.set(scale, scale, scale);

        // Apply material to all meshes
        loadedObject.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            child.material = new THREE.MeshStandardMaterial({
              color: "#4a90e2",
              metalness: 0.6,
              roughness: 0.3,
            });
            child.castShadow = true;
            child.receiveShadow = true;
          }
        });

        setObject(loadedObject);
      } catch (err) {
        console.error("OBJ loading error:", err);
        setError(
          err instanceof Error ? err.message : "Failed to load OBJ file",
        );
      }
    };

    reader.onerror = () => {
      setError("Failed to read OBJ file");
    };

    reader.readAsText(file);

    return () => {
      object?.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.geometry?.dispose();
          if (Array.isArray(child.material)) {
            child.material.forEach((mat: THREE.Material) => mat.dispose());
          } else if (child.material) {
            child.material.dispose();
          }
        }
      });
    };
  }, [file]);

  if (error) {
    console.error("OBJ Model Error:", error);
    return null;
  }

  if (!object) return null;

  return <primitive ref={groupRef} object={object} />;
}



function Scene({ file, extension }: { file: File; extension: string }) {
  useEffect(() => {
    console.log(`Loading 3D model: ${file.name} (${extension})`);
  }, [file, extension]);

  return (
    <>
      <PerspectiveCamera makeDefault position={[8, 8, 8]} fov={50} />
      <OrbitControls
        enableDamping
        dampingFactor={0.05}
        minDistance={2}
        maxDistance={20}
        makeDefault
      />

      {/* Lighting */}
      <ambientLight intensity={0.5} />
      <directionalLight
        position={[10, 10, 10]}
        intensity={1}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
      />
      <directionalLight position={[-10, 10, -10]} intensity={0.4} />

      {/* Grid helper */}
      <Grid
        args={[20, 20]}
        cellSize={0.5}
        cellThickness={0.5}
        cellColor="#6b7280"
        sectionSize={2}
        sectionThickness={1}
        sectionColor="#4b5563"
        fadeDistance={25}
        fadeStrength={1}
        infiniteGrid
      />

      {/* Model */}
      <Suspense fallback={null}>
        {extension === "stl" && <STLModel file={file} />}
        {extension === "obj" && <OBJModel file={file} />}
        {(extension === "step" || extension === "stp") && (
          <STEPViewer file={file} />
        )}
      </Suspense>

      {/* Environment lighting */}
      <Environment preset="city" />
    </>
  );
}

export default function CadViewer3D({
  fileName,
  file,
  width = "100%",
  height = "400px",
  className = "",
}: CadViewer3DProps) {
  const getFileExtension = (name: string) => {
    return name.split(".").pop()?.toLowerCase() || "";
  };

  const extension = getFileExtension(fileName);
  const is3DFormat = [
    "step",
    "stp",
    "stl",
    "iges",
    "igs",
    "x_t",
    "x_b",
    "obj",
  ].includes(extension);
  // Temporarily disable STEP support due to opencascade.js initialization issues
  const supportedFormats = ["stl", "obj", "step"];

  if (!is3DFormat) {
    return (
      <Card
        className={`flex items-center justify-center bg-gray-50 border-2 border-dashed ${className}`}
        style={{ width, height }}
      >
        <div className="text-center p-6">
          <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-2" />
          <p className="text-gray-600">
            Preview not available for .{extension} files
          </p>
        </div>
      </Card>
    );
  }

  // Handle missing file prop
  if (supportedFormats.includes(extension) && !file) {
    return (
      <Card
        className={`flex flex-col items-center justify-center bg-gradient-to-br from-amber-50 to-orange-50 border-2 border-amber-200 ${className}`}
        style={{ width, height }}
      >
        <div className="text-center p-6">
          <AlertCircle className="w-12 h-12 text-amber-600 mx-auto mb-2" />
          <h3 className="font-semibold text-gray-900 mb-2">{fileName}</h3>
          <p className="text-sm text-gray-600 mb-1">
            3D CAD File (.{extension})
          </p>
          <p className="text-xs text-amber-700 font-medium mt-3">
            ⚠️ File data not provided
          </p>
          <p className="text-xs text-gray-500 mt-1">
            Pass the file prop to enable 3D preview
          </p>
        </div>
      </Card>
    );
  }

  if (supportedFormats.includes(extension) && file) {
    return (
      <div
        className={`relative bg-gradient-to-br from-slate-50 to-slate-100 rounded-lg overflow-hidden ${className}`}
        style={{ width, height }}
      >
        <ErrorBoundary
          fallback={
            <div className="absolute inset-0 flex items-center justify-center bg-red-50">
              <div className="text-center p-6">
                <AlertCircle className="w-12 h-12 text-red-600 mx-auto mb-2" />
                <p className="text-red-800 font-semibold">
                  Failed to load 3D model
                </p>
                <p className="text-sm text-red-600 mt-1">
                  Check console for details
                </p>
              </div>
            </div>
          }
        >
          <Canvas
            shadows
            dpr={[1, 2]}
            gl={{ antialias: true, alpha: false }}
            style={{
              background: "linear-gradient(to bottom right, #f8fafc, #f1f5f9)",
            }}
          >
            <Scene file={file} extension={extension} />
          </Canvas>
        </ErrorBoundary>

        {/* Controls overlay */}
        <div className="absolute top-3 left-3 bg-white/90 backdrop-blur-sm px-3 py-2 rounded-lg shadow-md text-xs text-gray-700 z-10">
          <div className="flex items-center gap-2">
            <span className="font-semibold">🖱️ Controls:</span>
            <span>Drag to Rotate</span>
            <span className="text-gray-400">|</span>
            <span>Scroll to Zoom</span>
          </div>
        </div>

        {/* File info overlay */}
        <div className="absolute bottom-3 right-3 bg-white/90 backdrop-blur-sm px-3 py-2 rounded-lg shadow-md text-xs text-gray-700 z-10">
          <div className="flex items-center gap-2">
            <Box className="w-4 h-4 text-blue-600" />
            <span className="font-medium">{fileName}</span>
            <span className="text-gray-400">|</span>
            <span>{(file.size / 1024 / 1024).toFixed(2)} MB</span>
            {["step", "stp"].includes(extension) && (
              <>
                <span className="text-gray-400">|</span>
                <span className="text-green-600 font-medium">✓ STEP</span>
              </>
            )}
          </div>
        </div>

        {/* Loading fallback */}
        <Suspense
          fallback={
            <div className="absolute inset-0 flex items-center justify-center bg-slate-50">
              <div className="text-center">
                <Loader2 className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-2" />
                <p className="text-sm text-gray-600">
                  Loading {extension.toUpperCase()} model...
                </p>
                {["step", "stp"].includes(extension) && (
                  <p className="text-xs text-gray-500 mt-1">
                    Processing CAD geometry...
                  </p>
                )}
              </div>
            </div>
          }
        />
      </div>
    );
  }

  // For STEP/IGES files - show coming soon message
  if (["step", "stp", "iges", "igs"].includes(extension)) {
    return (
      <Card
        className={`flex flex-col items-center justify-center bg-gradient-to-br from-amber-50 to-orange-50 border-2 border-amber-200 ${className}`}
        style={{ width, height }}
      >
        <div className="text-center p-6">
          <div className="relative inline-block mb-4">
            <Box className="w-16 h-16 text-amber-600 animate-pulse" />
            <div className="absolute inset-0 bg-amber-400 opacity-20 blur-xl rounded-full"></div>
          </div>
          <h3 className="font-semibold text-gray-900 mb-2">{fileName}</h3>
          <p className="text-sm text-gray-600 mb-1">
            3D CAD File (.{extension})
          </p>
          <p className="text-xs text-amber-700 font-medium mt-3">
            🚀 {extension.toUpperCase()} viewer coming soon
          </p>
          <p className="text-xs text-gray-500 mt-1">
            Interactive 3D preview currently available for STL & OBJ files
          </p>
        </div>
      </Card>
    );
  }

  return (
    <Card
      className={`flex flex-col items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-200 ${className}`}
      style={{ width, height }}
    >
      <div className="text-center p-6">
        <div className="relative inline-block mb-4">
          <Box className="w-16 h-16 text-blue-600 animate-pulse" />
          <div className="absolute inset-0 bg-blue-400 opacity-20 blur-xl rounded-full"></div>
        </div>
        <h3 className="font-semibold text-gray-900 mb-2">{fileName}</h3>
        <p className="text-sm text-gray-600 mb-1">3D CAD File (.{extension})</p>
        <p className="text-xs text-gray-500">
          Interactive 3D preview for STL, OBJ & STEP files
        </p>
      </div>
    </Card>
  );
}
