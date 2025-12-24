"use client";
import React, { useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Grid, Edges } from '@react-three/drei';

interface ThreeDViewerProps {
  geometry?: any; // future: typed geometry metrics / mesh reference
  className?: string;
}

const PlaceholderPart: React.FC<{ geometry?: any }> = ({ geometry }) => {
  // Derive bounding box dims if provided
  const dims = useMemo<[number, number, number]>(() => {
    if (geometry?.bbox && Array.isArray(geometry.bbox) && geometry.bbox.length >= 3) {
      return [geometry.bbox[0] || 10, geometry.bbox[1] || 10, geometry.bbox[2] || 10];
    }
    return [20, 10, 8];
  }, [geometry]);
  return (
    <mesh position={[0, dims[1] / 2, 0]}> {/* raise so sits on grid */}
      <boxGeometry args={dims} />
      <meshStandardMaterial color="#4f83ff" roughness={0.55} metalness={0.1} />
      <Edges renderOrder={2}>
        <lineBasicMaterial color="#1d3b7a" linewidth={1} />
      </Edges>
    </mesh>
  );
};

export const ThreeDViewer: React.FC<ThreeDViewerProps> = ({ geometry, className }) => {
  return (
    <div className={"relative w-full h-full rounded bg-gray-100 dark:bg-gray-800 overflow-hidden " + (className || '')}>
      <Canvas camera={{ position: [40, 30, 40], fov: 40 }} shadows>
        <ambientLight intensity={0.6} />
        <directionalLight position={[25, 40, 20]} intensity={0.8} castShadow />
        <gridHelper args={[120, 30, '#666', '#bbb']} />
        <Grid infiniteGrid sectionColor={'#888'} fadeDistance={60} />
        <PlaceholderPart geometry={geometry} />
        <OrbitControls enablePan enableZoom enableRotate />
      </Canvas>
      {!geometry && (
        <div className="absolute inset-0 flex items-center justify-center text-[10px] text-gray-500 pointer-events-none">
          Waiting for geometry…
        </div>
      )}
    </div>
  );
};

export default ThreeDViewer;
