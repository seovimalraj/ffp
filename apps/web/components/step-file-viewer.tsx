"use client"

import React, { useState, useRef, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Sky, Center } from '@react-three/drei';
import * as THREE from 'three';

type Nullable<T> = T | null;

function useDisposeGeometry(geom: Nullable<THREE.BufferGeometry>) {
  useEffect(() => {
    return () => {
      if (geom) geom.dispose();
    };
  }, [geom]);
}

function STEPMesh({ geometry }: { geometry: Nullable<THREE.BufferGeometry> }) {
  useDisposeGeometry(geometry);
  if (!geometry) return null;

  return (
    <mesh geometry={geometry} castShadow receiveShadow>
      <meshStandardMaterial
        color="#4a90e2"
        metalness={0.6}
        roughness={0.3}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

export default function STEPViewer({ file }: { file: File | null }) {
  const [geometry, setGeometry] = useState<THREE.BufferGeometry | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const previousGeometryRef = useRef<THREE.BufferGeometry | null>(null);

  useEffect(() => {
    if (!file) {
      setGeometry(null);
      setError(null);
      return;
    }

    // Cancel any in-flight loading operation
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    (async () => {
      setLoading(true);
      setError(null);

      // Dispose previous geometry
      if (previousGeometryRef.current) {
        previousGeometryRef.current.dispose();
        previousGeometryRef.current = null;
      }
      setGeometry(null);

      try {
        // Check if aborted
        if (abortController.signal.aborted) return;

        const init = (await import('opencascade.js')).default;
        const oc = await init();

        if (abortController.signal.aborted) return;

        const buffer = await file.arrayBuffer();
        const bytes = new Uint8Array(buffer);
        const path = "/model.step";
        
        // Write file to virtual filesystem
        oc.FS.writeFile(path, bytes);

        try {
          const reader = new oc.STEPControl_Reader_1();
          const status = reader.ReadFile(path);
          
          if (status !== oc.IFSelect_RetDone) {
            throw new Error("Failed to read STEP file");
          }

          reader.TransferRoots();
          const shape = reader.OneShape();

          // Mesh the shape
          new oc.BRepMesh_IncrementalMesh_2(shape, 0.1, false, 0.5, true);

          const vertices: number[] = [];
          const indices: number[] = [];
          let offset = 0;

          const exp = new oc.TopExp_Explorer_2(shape, oc.TopAbs_FACE, oc.TopAbs_SHAPE);
          
          while (exp.More()) {
            if (abortController.signal.aborted) return;

            const face = oc.TopoDS.Face_1(exp.Current());
            const loc = new oc.TopLoc_Location_1();
            const tri = oc.BRep_Tool.Triangulation(face, loc, 0);

            if (!tri.IsNull()) {
              const trsf = loc.Transformation();
              const n = tri.NbNodes();

              for (let i = 1; i <= n; i++) {
                const p = tri.Node(i).Transformed(trsf);
                vertices.push(p.X(), p.Y(), p.Z());
              }

              const tCount = tri.NbTriangles();
              for (let i = 1; i <= tCount; i++) {
                const t = tri.Triangle(i);
                let a = t.Value(1) - 1 + offset;
                let b = t.Value(2) - 1 + offset;
                let c = t.Value(3) - 1 + offset;

                if (face.Orientation_1() === oc.TopAbs_REVERSED) {
                  [b, c] = [c, b];
                }

                indices.push(a, b, c);
              }

              offset += n;
            }

            exp.Next();
          }

          if (vertices.length === 0) {
            throw new Error("No geometry found in STEP file");
          }

          const geom = new THREE.BufferGeometry();
          geom.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
          geom.setIndex(indices);
          geom.computeVertexNormals();

          // Center and scale
          geom.computeBoundingBox();
          const box = geom.boundingBox!;
          const center = new THREE.Vector3();
          box.getCenter(center);
          geom.translate(-center.x, -center.y, -center.z);

          const size = new THREE.Vector3();
          box.getSize(size);
          const scale = 2 / Math.max(size.x, size.y, size.z);
          geom.scale(scale, scale, scale);

          if (!abortController.signal.aborted) {
            previousGeometryRef.current = geom;
            setGeometry(geom);
            setLoading(false);
          } else {
            geom.dispose();
          }
        } finally {
          // Clean up virtual filesystem
          try {
            oc.FS.unlink(path);
          } catch (e) {
            // File might not exist, ignore
          }
        }
      } catch (err: any) {
        if (!abortController.signal.aborted) {
          setError(err?.message || "Unknown error occurred");
          setLoading(false);
        }
      }
    })();

    return () => {
      abortController.abort();
    };
  }, [file]);

  if (!geometry) return null;

  return (
    <Center>
      <STEPMesh geometry={geometry} />
    </Center>
  );
}