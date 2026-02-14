// src/loaders/meshLoader.ts
import * as THREE from "three";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader.js";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js";
import { ThreeMFLoader } from "three/examples/jsm/loaders/3MFLoader.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import * as BufferGeometryUtils from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { DXFLoader } from "three-dxf-loader";
import { DxfParser } from "dxf-parser";
import { createStainlessSteelMaterial } from "./viewer";

type TessReq = {
  id: string;
  type: "tessellate";
  payload: {
    buffer: ArrayBuffer;
    ext: "step" | "stp" | "iges" | "igs" | "brep";
    linearDeflection?: number;
    angularDeflection?: number;
  };
};

type TessOk = {
  id: string;
  ok: true;
  positions: Float32Array;
  indices: Uint32Array;
};
type TessErr = { id: string; ok: false; error: string };

type CADExt = "step" | "stp" | "iges" | "igs" | "brep";

function mergeFromObject(root: any) {
  const geos: THREE.BufferGeometry[] = [];

  // Apply stainless-steel material to any meshes in the loaded root object
  // (only affects meshes belonging to the loaded model; helpers created elsewhere are untouched)
  if (root && root.traverse) {
    root.traverse((child: any) => {
      if (child.isMesh && child.material) {
        try {
          if (Array.isArray(child.material)) {
            const count = child.material.length;
            child.material.forEach((m: any) => {
              try {
                if (m) m.dispose();
              } catch {
                /* ignore */
              }
            });
            child.material = new Array(count)
              .fill(0)
              .map(() => createStainlessSteelMaterial().clone());
          } else {
            try {
              child.material.dispose();
            } catch {
              /* ignore */
            }
            child.material = createStainlessSteelMaterial().clone();
          }
        } catch {
          /* ignore any weird loader material shapes */
        }
      }
    });
  }

  // Handle common loader return patterns (e.g. { scene: ... }) or arrays
  const input = root.scene || root;
  const roots = Array.isArray(input) ? input : [input];

  for (const r of roots) {
    if (!r) continue;

    if (r.updateWorldMatrix) {
      r.updateWorldMatrix(true, true);
    }

    if (r.traverse) {
      r.traverse((child: any) => {
        if (
          (child.isMesh || child.isLine || child.isLineSegments) &&
          child.geometry
        ) {
          const g = child.geometry.clone();
          if (child.updateWorldMatrix) child.updateWorldMatrix(true, true);
          g.applyMatrix4(child.matrixWorld);
          geos.push(g);
        }
      });
    } else if ((r.isMesh || r.isLine || r.isLineSegments) && r.geometry) {
      const g = r.geometry.clone();
      if (r.updateWorldMatrix) r.updateWorldMatrix(true, true);
      g.applyMatrix4(r.matrixWorld);
      geos.push(g);
    }
  }

  if (geos.length === 0) throw new Error("No geometry found in file");
  const merged = BufferGeometryUtils.mergeGeometries(geos, true);
  if (!merged) throw new Error("No geometry found in file");
  // Don't compute normals for lines, only for meshes
  const hasFaces =
    merged.getAttribute("index") || merged.getAttribute("position").count > 0;
  if (
    hasFaces &&
    geos.some((g: any) => g.index || g.attributes.position.count % 3 === 0)
  ) {
    try {
      merged.computeVertexNormals();
    } catch (_e) {
      // ignore for non-manifold or line-based geometry
    }
  }
  return merged;
}

async function loadMeshOnMainThread(file: File, ext: string) {
  if (ext === "stl") {
    const buf = await file.arrayBuffer();
    const loader = new STLLoader();
    return loader.parse(buf as ArrayBuffer);
  }

  if (ext === "obj") {
    const text = await file.text();
    const loader = new OBJLoader();
    const root = loader.parse(text);
    return mergeFromObject(root);
  }

  if (ext === "3mf") {
    const buf = await file.arrayBuffer();
    const loader = new ThreeMFLoader();
    const root = loader.parse(buf as ArrayBuffer);
    return mergeFromObject(root);
  }

  if (ext === "gltf" || ext === "glb") {
    const url = URL.createObjectURL(file);
    try {
      const loader = new GLTFLoader();
      const { scene } = await loader.loadAsync(url);
      const geom = mergeFromObject(scene);
      if (!geom) throw new Error("No mesh data found in glTF scene");
      return geom;
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  if (ext === "dxf") {
    const text = await file.text();
    const loader = new DXFLoader();
    // DXFLoader needs the parser
    const dxf = loader.parse(text, new DxfParser());
    return mergeFromObject(dxf);
  }

  throw new Error("Unsupported mesh format");
}

function isCADExt(ext: string): ext is CADExt {
  return (
    ext === "step" ||
    ext === "stp" ||
    ext === "iges" ||
    ext === "igs" ||
    ext === "brep"
  );
}

export async function loadMeshFile(
  file: File | string,
  worker?: Worker,
): Promise<THREE.BufferGeometry> {
  let fileObj: File;
  let ext = "";

  if (typeof file === "string") {
    // It's a URL
    try {
      const resp = await fetch(file);
      if (!resp.ok) throw new Error(`Failed to fetch file: ${resp.statusText}`);
      const blob = await resp.blob();

      // Try to get filename from URL or headers, fallback to "unknown.stp" if indeterminate but defaulting to something
      // Actually, identifying extension is crucial.
      // Let's assume URL contains extension or we use a fallback.
      // If the URL is signed or clean, it usually has the name.
      const urlPart = file.split("?")[0];
      const filename = urlPart.split("/").pop() || "model.step";

      fileObj = new File([blob], filename, { type: blob.type });
      ext = (filename.split(".").pop() || "").toLowerCase();
    } catch (err: any) {
      throw new Error("Failed to download file from URL: " + err.message);
    }
  } else {
    fileObj = file;
    ext = (file.name.split(".").pop() || "").toLowerCase();
  }

  if (
    ext === "stl" ||
    ext === "obj" ||
    ext === "3mf" ||
    ext === "gltf" ||
    ext === "glb" ||
    ext === "dxf"
  ) {
    return loadMeshOnMainThread(fileObj, ext);
  }

  if (isCADExt(ext)) {
    if (!worker) throw new Error("CAD worker not provided");

    const id = Math.random().toString(36).slice(2);
    const buf = await fileObj.arrayBuffer();

    return new Promise<THREE.BufferGeometry>((resolve, reject) => {
      const handle = (e: MessageEvent<TessOk | TessErr>) => {
        const data = e.data;
        if (!data || data.id !== id) return;
        worker.removeEventListener("message", handle as any);

        if (!data.ok) {
          reject(new Error(data.error ?? "OpenCascade error"));
          return;
        }

        const geom = new THREE.BufferGeometry();
        geom.setAttribute(
          "position",
          new THREE.BufferAttribute(data.positions, 3),
        );
        geom.setIndex(new THREE.BufferAttribute(data.indices, 1));
        geom.computeVertexNormals();
        resolve(geom);
      };

      worker.addEventListener("message", handle as any);
      worker.postMessage(
        { id, type: "tessellate", payload: { buffer: buf, ext } } as TessReq,
        [buf],
      );
    });
  }

  throw new Error(
    "Unsupported file. Try STL, OBJ, 3MF, glTF, GLB, STEP, IGES, BREP or DXF.",
  );
}