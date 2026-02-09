/* eslint-disable no-undef */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-env browser */
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import * as BufferGeometryUtils from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { Line2 } from "three/examples/jsm/lines/Line2.js";
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial.js";
import { LineGeometry } from "three/examples/jsm/lines/LineGeometry.js";
// Line rendering helpers (thick, pixel-correct lines)
// We use simple THREE.LineSegments + THREE.EdgesGeometry for feature edges

export type Viewer = {
  loadMeshFromGeometry: (geom: THREE.BufferGeometry) => void;
  clear: () => void;
  setView: (
    preset: "top" | "front" | "right" | "iso" | "bottom" | "left" | "back",
  ) => void;
  setProjection: (mode: "perspective" | "orthographic") => void;
  setFeatureEdgesEnabled: (enabled: boolean) => void;
  resize: () => void;
  dispose: () => void;
  pickAtScreenPosition: (ndcX: number, ndcY: number) => THREE.Vector3 | null;
  pickEdgeAtScreenPosition: (
    ndcX: number,
    ndcY: number,
  ) => { point: THREE.Vector3; object: THREE.Object3D } | null;
  highlightEdgeAtScreenPosition: (ndcX: number, ndcY: number) => void;
  clearEdgeHighlight: () => void;
  measureEdgeAtScreenPosition: (ndcX: number, ndcY: number) => number | null;
  setControlsEnabled: (enabled: boolean) => void;
  setMeasurementSegment: (
    p1: THREE.Vector3 | null,
    p2: THREE.Vector3 | null,
    labelText?: string | null,
  ) => void;
  setMeasurementGraphicsScale: (scale: number) => void;
  getScreenshotDataURL: () => string;
  getOutlineSnapshotDataURL: () => string;
  setMaterialProperties: (
    colorHex: number,
    wireframe: boolean,
    xray: boolean,
  ) => void;
  setClipping: (value: number | null) => void;
  fitToScreen: (zoom?: number) => void;
  setHighlight: (
    triangles: number[] | null,
    location?: { x: number; y: number; z: number },
  ) => void;
  setBackgroundColor: (color: string | number) => void;
  setShowViewCube: (visible: boolean) => void;
};

export function createStainlessSteelMaterial(): THREE.MeshPhysicalMaterial {
  // Tuned for a realistic stainless-steel appearance with room-env reflections.
  return new THREE.MeshPhysicalMaterial({
    color: 0xbfc7cc, // slightly cool-gray stainless tint
    metalness: 1.0,
    roughness: 0.22,
    clearcoat: 0.5,
    clearcoatRoughness: 0.03,
    reflectivity: 0.5,
    envMapIntensity: 1.2,
    // preserve double-sided usage in viewer where needed via side override
    // Use physical material so environment lighting produces realistic reflections.
  });
}

export function createViewer(container: HTMLElement): Viewer {
  // Declare controls and requestUpdateSilhouette at the top to avoid TS errors
  // (used before assignment in view cube setup)
  let controls!: OrbitControls;
  let requestUpdateSilhouette: (() => void) | null = null;

  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: false,
    preserveDrawingBuffer: true,
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(container.clientWidth, container.clientHeight);
  (renderer as any).outputColorSpace =
    (THREE as any).SRGBColorSpace ?? undefined;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0; // realistic exposure for ACES filmic
  renderer.setClearColor(0xffffff);
  renderer.localClippingEnabled = true;
  container.appendChild(renderer.domElement);
  // Ensure container can host absolutely positioned overlays (view cube)
  try {
    const computed = window.getComputedStyle(container);
    if (!computed || computed.position === "static") {
      container.style.position = "relative";
    }
  } catch (_e) {
    // ignore (server-side or testing)
  }

  // silhouette listener will be attached after requestUpdateSilhouette is declared

  // --- View Cube Overlay ---
  const VIEW_CUBE_SIZE = 140; // CSS size for quick tweak
  const cubeSizePx = VIEW_CUBE_SIZE;
  // wrapper ensures we can control pointer events / z-order independently of container
  const cubeWrapper = document.createElement("div");
  cubeWrapper.style.position = "absolute";
  cubeWrapper.style.bottom = "12px";
  cubeWrapper.style.right = "12px";
  cubeWrapper.style.width = `${cubeSizePx}px`;
  cubeWrapper.style.height = `${cubeSizePx}px`;
  cubeWrapper.style.pointerEvents = "auto";
  cubeWrapper.style.zIndex = "50";

  const cubeCanvas = document.createElement("canvas");
  cubeCanvas.style.position = "absolute";
  cubeCanvas.style.left = "0";
  cubeCanvas.style.top = "0";
  cubeCanvas.style.width = "100%";
  cubeCanvas.style.height = "100%";
  cubeCanvas.style.pointerEvents = "auto";
  cubeCanvas.style.touchAction = "none";
  cubeCanvas.width = Math.floor(
    cubeSizePx * Math.min(window.devicePixelRatio, 2),
  );
  cubeCanvas.height = Math.floor(
    cubeSizePx * Math.min(window.devicePixelRatio, 2),
  );
  cubeWrapper.appendChild(cubeCanvas);
  container.appendChild(cubeWrapper);

  const cubeRenderer = new THREE.WebGLRenderer({
    canvas: cubeCanvas,
    antialias: true,
    alpha: true,
    preserveDrawingBuffer: false,
  });
  cubeRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  cubeRenderer.setSize(cubeCanvas.clientWidth, cubeCanvas.clientHeight, false);

  const cubeScene = new THREE.Scene();
  const cubeCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
  cubeCamera.position.set(0, 0, 2);

  const cubeRoot = new THREE.Group();
  cubeScene.add(cubeRoot);

  // Create labeled face materials (px, nx, py, ny, pz, nz)
  const faceLabels = ["Right", "Left", "Top", "Bottom", "Front", "Back"];
  function createLabelTexture(text: string) {
    const size = 256;
    const canvas2 = document.createElement("canvas");
    canvas2.width = size;
    canvas2.height = size;
    const ctx = canvas2.getContext("2d")!;
    // white background
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, size, size);
    // border
    ctx.strokeStyle = "#d1d5db"; // gray-300
    ctx.lineWidth = 4;
    ctx.strokeRect(2, 2, size - 4, size - 4);
    // label
    ctx.fillStyle = "#6b7280"; // slate-500
    ctx.font = "700 48px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text.toUpperCase(), size / 2, size / 2 + 6);
    const tex = new THREE.CanvasTexture(canvas2);
    try {
      const maxAniso = cubeRenderer.capabilities?.getMaxAnisotropy
        ? cubeRenderer.capabilities.getMaxAnisotropy()
        : 1;
      tex.anisotropy = maxAniso;
    } catch {
      /* ignore */
    }
    tex.needsUpdate = true;
    return tex;
  }

  const baseFaceColor = 0xf8fafc; // soft off-white
  const faceMaterials = faceLabels.map((lbl) => {
    const mat = new THREE.MeshBasicMaterial({
      color: baseFaceColor,
      map: createLabelTexture(lbl),
      side: THREE.FrontSide,
    });
    return mat;
  });

  const cubeGeom = new THREE.BoxGeometry(1, 1, 1);
  const cubeMesh = new THREE.Mesh(cubeGeom, faceMaterials as any);
  const cubeScale = 0.8;
  cubeMesh.scale.set(cubeScale, cubeScale, cubeScale);
  cubeRoot.add(cubeMesh);

  // Edges outline
  const edgesGeom = new THREE.EdgesGeometry(cubeGeom);
  const edgesMat = new THREE.LineBasicMaterial({
    color: 0x9ca3af, // gray-400
    transparent: true,
    opacity: 0.85,
  });
  const edges = new THREE.LineSegments(edgesGeom, edgesMat);
  // match the mesh scale so the outline sits exactly on the cube edges
  edges.scale.copy(cubeMesh.scale);
  edges.renderOrder = 1001;
  cubeRoot.add(edges);

  // Axis triad anchored at the back-left-bottom cube corner (-half, -half, -half)
  const triad = new THREE.Group();
  const triMaterialX = new THREE.LineBasicMaterial({ color: 0xff0000 });
  const triMaterialY = new THREE.LineBasicMaterial({ color: 0x00ff00 });
  const triMaterialZ = new THREE.LineBasicMaterial({ color: 0x0000ff });
  // half-size of the scaled cube (in cube local space)
  const half = 0.5 * cubeScale;
  // axis length proportional to cube scale
  const triLength = 0.6 * cubeScale;
  // corner at back-left-bottom of the cube
  const corner = new THREE.Vector3(-half, -half, -half);
  // tiny outward offset along the corner diagonal to avoid z-fighting (very small)
  const eps = 0.02 * cubeScale;
  const cornerOffset = corner
    .clone()
    .add(new THREE.Vector3(-1, -1, -1).normalize().multiplyScalar(eps));

  // Create axes relative to triad origin (0,0,0). Parent triad to cubeRoot and position it at the corner.
  const makeAxis = (dir: THREE.Vector3, mat: THREE.LineBasicMaterial) => {
    const start = new THREE.Vector3(0, 0, 0);
    const end = dir.clone().multiplyScalar(triLength);
    const g = new THREE.BufferGeometry().setFromPoints([start, end]);
    return new THREE.Line(g, mat);
  };

  // Note: orbit controls listener will be attached after requestUpdateSilhouette is declared

  triad.add(makeAxis(new THREE.Vector3(1, 0, 0), triMaterialX));
  triad.add(makeAxis(new THREE.Vector3(0, 1, 0), triMaterialY));
  triad.add(makeAxis(new THREE.Vector3(0, 0, 1), triMaterialZ));
  // position triad origin at the cube corner (parented to cubeRoot so it rotates with the cube)
  triad.position.copy(cornerOffset);
  cubeRoot.add(triad);

  // Edge and Corner patch meshes (single geometry each) parented to cubeMesh so they inherit scale
  const lastMeshLocal = new THREE.Vector3();

  const halfUnit = 0.5; // unit cube half
  const EDGE_PATCH_LEN = 0.9 * halfUnit; // length along edge
  const EDGE_PATCH_DEPTH = 0.45 * halfUnit; // depth into face
  const CORNER_PATCH_SIZE = 0.55 * halfUnit; // corner square size (larger)

  function clamp(v: number, a: number, b: number) {
    return Math.max(a, Math.min(b, v));
  }

  function addQuad(
    positions: number[],
    fixedAxis: "x" | "y" | "z",
    fixedVal: number,
    uAxis: "x" | "y" | "z",
    u0: number,
    u1: number,
    vAxis: "x" | "y" | "z",
    v0: number,
    v1: number,
  ) {
    // two triangles (v00, v10, v11) and (v11, v01, v00)
    const setVertex = (u: number, v: number) => {
      const p = { x: 0, y: 0, z: 0 } as any;
      p[fixedAxis] = fixedVal;
      p[uAxis] = u;
      p[vAxis] = v;
      positions.push(p.x, p.y, p.z);
    };

    // v00 (u0,v0), v10 (u1,v0), v11 (u1,v1), v01 (u0,v1)
    // tri1
    setVertex(u0, v0);
    setVertex(u1, v0);
    setVertex(u1, v1);
    // tri2
    setVertex(u1, v1);
    setVertex(u0, v1);
    setVertex(u0, v0);
  }

  // materials/geometries
  const edgeMat = new THREE.MeshBasicMaterial({
    color: 0xdbeafe,
    transparent: true,
    opacity: 0.6,
    side: THREE.DoubleSide,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: 1,
  });
  const cornerMat = new THREE.MeshBasicMaterial({
    color: 0xdbeafe,
    transparent: true,
    opacity: 0.6,
    side: THREE.DoubleSide,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: 1,
  });

  let edgeGeom: THREE.BufferGeometry = new THREE.BufferGeometry();
  let cornerGeom: THREE.BufferGeometry = new THREE.BufferGeometry();
  const edgePatchMesh = new THREE.Mesh(edgeGeom, edgeMat);
  const cornerPatchMesh = new THREE.Mesh(cornerGeom, cornerMat);
  edgePatchMesh.visible = false;
  cornerPatchMesh.visible = false;
  edgePatchMesh.renderOrder = 2000;
  cornerPatchMesh.renderOrder = 2000;
  // parent to cubeMesh so they inherit its scale
  cubeMesh.add(edgePatchMesh);
  cubeMesh.add(cornerPatchMesh);

  function hideHoverPatches() {
    edgePatchMesh.visible = false;
    cornerPatchMesh.visible = false;
  }

  function setEdgePatchFromHover(
    pLocal: THREE.Vector3,
    nearX: boolean,
    nearY: boolean,
    nearZ: boolean,
    nx: number,
    ny: number,
    nz: number,
  ) {
    // build two quads (one per face)
    const faces: { axis: "x" | "y" | "z"; sign: number }[] = [];
    if (nearX) faces.push({ axis: "x", sign: Math.sign(nx) || 1 });
    if (nearY) faces.push({ axis: "y", sign: Math.sign(ny) || 1 });
    if (nearZ) faces.push({ axis: "z", sign: Math.sign(nz) || 1 });

    const positions: number[] = [];

    // free axis is the axis not in faces
    const axes: ("x" | "y" | "z")[] = ["x", "y", "z"];
    const presentAxes = faces.map((f) => f.axis);
    const freeAxis = axes.find((a) => !presentAxes.includes(a))!;

    // center along free axis (clamped)
    const centerFree = clamp(
      (pLocal as any)[freeAxis],
      -0.5 + EDGE_PATCH_LEN / 2,
      0.5 - EDGE_PATCH_LEN / 2,
    );

    for (const f of faces) {
      if (f.axis === "x") {
        // quad on plane x = sign*0.5, u axis = freeAxis (length), v axis = the other in-plane axis
        const otherAxis = freeAxis === "y" ? "z" : "y";
        const otherSign =
          (otherAxis === "y"
            ? Math.sign((pLocal as any).y)
            : Math.sign((pLocal as any).z)) ||
          (otherAxis === "y" ? Math.sign(ny) || 1 : Math.sign(nz) || 1);
        const fixedVal = f.sign * 0.5;
        const u0 = centerFree - EDGE_PATCH_LEN / 2;
        const u1 = centerFree + EDGE_PATCH_LEN / 2;
        const v0 = otherSign * 0.5; // edge at face intersection
        const v1 = otherSign * 0.5 - otherSign * EDGE_PATCH_DEPTH; // inward
        addQuad(
          positions,
          "x",
          fixedVal,
          freeAxis,
          u0,
          u1,
          otherAxis as any,
          v0,
          v1,
        );
      } else if (f.axis === "y") {
        const otherAxis = freeAxis === "x" ? "z" : "x";
        const otherSign =
          (otherAxis === "x"
            ? Math.sign((pLocal as any).x)
            : Math.sign((pLocal as any).z)) ||
          (otherAxis === "x" ? Math.sign(nx) || 1 : Math.sign(nz) || 1);
        const fixedVal = f.sign * 0.5;
        const u0 = centerFree - EDGE_PATCH_LEN / 2;
        const u1 = centerFree + EDGE_PATCH_LEN / 2;
        const v0 = otherSign * 0.5;
        const v1 = otherSign * 0.5 - otherSign * EDGE_PATCH_DEPTH;
        addQuad(
          positions,
          "y",
          fixedVal,
          freeAxis,
          u0,
          u1,
          otherAxis as any,
          v0,
          v1,
        );
      } else {
        const otherAxis = freeAxis === "x" ? "y" : "x";
        const otherSign =
          (otherAxis === "x"
            ? Math.sign((pLocal as any).x)
            : Math.sign((pLocal as any).y)) ||
          (otherAxis === "x" ? Math.sign(nx) || 1 : Math.sign(ny) || 1);
        const fixedVal = f.sign * 0.5;
        const u0 = centerFree - EDGE_PATCH_LEN / 2;
        const u1 = centerFree + EDGE_PATCH_LEN / 2;
        const v0 = otherSign * 0.5;
        const v1 = otherSign * 0.5 - otherSign * EDGE_PATCH_DEPTH;
        addQuad(
          positions,
          "z",
          fixedVal,
          freeAxis,
          u0,
          u1,
          otherAxis as any,
          v0,
          v1,
        );
      }
    }

    // build geometry
    try {
      edgeGeom.dispose();
    } catch {
      /* ignore */
    }
    edgeGeom = new THREE.BufferGeometry();
    const posArr = new Float32Array(positions);
    edgeGeom.setAttribute("position", new THREE.BufferAttribute(posArr, 3));
    edgeGeom.computeBoundingSphere();
    edgePatchMesh.geometry = edgeGeom;
    edgePatchMesh.visible = true;
  }

  function setCornerPatchFromSigns(sx: number, sy: number, sz: number) {
    const positions: number[] = [];

    // x-face quad (u=y, v=z)
    const xFixed = sx * 0.5;
    const y0 = sy > 0 ? 0.5 - CORNER_PATCH_SIZE : -0.5;
    const y1 = sy > 0 ? 0.5 : -0.5 + CORNER_PATCH_SIZE;
    const z0 = sz > 0 ? 0.5 - CORNER_PATCH_SIZE : -0.5;
    const z1 = sz > 0 ? 0.5 : -0.5 + CORNER_PATCH_SIZE;
    addQuad(positions, "x", xFixed, "y", y0, y1, "z", z0, z1);

    // y-face quad (u=x, v=z)
    const yFixed = sy * 0.5;
    const x0 = sx > 0 ? 0.5 - CORNER_PATCH_SIZE : -0.5;
    const x1 = sx > 0 ? 0.5 : -0.5 + CORNER_PATCH_SIZE;
    addQuad(positions, "y", yFixed, "x", x0, x1, "z", z0, z1);

    // z-face quad (u=x, v=y)
    const zFixed = sz * 0.5;
    addQuad(positions, "z", zFixed, "x", x0, x1, "y", y0, y1);

    try {
      cornerGeom.dispose();
    } catch {
      /* ignore */
    }
    cornerGeom = new THREE.BufferGeometry();
    const posArr = new Float32Array(positions);
    cornerGeom.setAttribute("position", new THREE.BufferAttribute(posArr, 3));
    cornerGeom.computeBoundingSphere();
    cornerPatchMesh.geometry = cornerGeom;
    cornerPatchMesh.visible = true;
  }

  // Drag-to-rotate state for view cube
  let isDraggingCube = false;
  let dragStartX = 0;
  let dragStartY = 0;
  let dragStartTheta = 0;
  let dragStartPhi = 0;
  let dragDistance = 0;
  const DRAG_THRESHOLD = 4; // pixels
  const ROTATE_SPEED = Math.PI * 0.5; // radians per full canvas width/height
  const SPHERICAL_PHI_MIN = 0.05;
  const SPHERICAL_PHI_MAX = Math.PI - 0.05;

  function getSphericalFromCamera(): { theta: number; phi: number } {
    const target = controls.target;
    const offset = new THREE.Vector3().subVectors(
      activeCamera.position,
      target,
    );
    const spherical = new THREE.Spherical().setFromVector3(offset);
    return { theta: spherical.theta, phi: spherical.phi };
  }

  function setCameraFromSpherical(theta: number, phi: number, radius: number) {
    const target = controls.target;
    // Clamp phi to avoid singularities
    phi = Math.max(SPHERICAL_PHI_MIN, Math.min(SPHERICAL_PHI_MAX, phi));

    const spherical = new THREE.Spherical(radius, phi, theta);
    const offset = new THREE.Vector3().setFromSpherical(spherical);
    const newPos = target.clone().add(offset);

    persp.position.copy(newPos);
    ortho.position.copy(newPos);
    persp.up.set(0, 1, 0);
    ortho.up.set(0, 1, 0);
    persp.lookAt(target);
    ortho.lookAt(target);
    persp.updateProjectionMatrix();
    ortho.updateProjectionMatrix();
    controls.update();
    // Silhouette depends on view direction
    requestUpdateSilhouette?.();
  }

  function onCubePointerDown(e: PointerEvent) {
    try {
      (e.target as Element)?.setPointerCapture?.(e.pointerId);
    } catch (_err) {
      // ignore
    }
    isDraggingCube = true;
    dragStartX = e.clientX;
    dragStartY = e.clientY;
    dragDistance = 0;
    const spherical = getSphericalFromCamera();
    dragStartTheta = spherical.theta;
    dragStartPhi = spherical.phi;
    e.preventDefault();
    e.stopPropagation();
  }

  function onCubePointerMove(e: PointerEvent) {
    if (isDraggingCube) {
      // Dragging: rotate the camera
      const dx = e.clientX - dragStartX;
      const dy = e.clientY - dragStartY;
      dragDistance += Math.sqrt(dx * dx + dy * dy);

      const rect = cubeCanvas.getBoundingClientRect();
      const canvasWidth = rect.width || cubeSizePx;
      const canvasHeight = rect.height || cubeSizePx;

      const dTheta = -(dx / canvasWidth) * ROTATE_SPEED;
      const dPhi = -(dy / canvasHeight) * ROTATE_SPEED;

      const newTheta = dragStartTheta + dTheta;
      const newPhi = dragStartPhi + dPhi;

      const offset = new THREE.Vector3().subVectors(
        activeCamera.position,
        controls.target,
      );
      const radius = offset.length();

      setCameraFromSpherical(newTheta, newPhi, radius);

      cubeCanvas.style.cursor = "grabbing";
      hideHoverPatches();
      e.preventDefault();
      e.stopPropagation();
      return;
    }

    // Not dragging: normal hover highlighting with single reusable patch
    const rect = cubeCanvas.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    cubePointer.set(x, y);
    cubeRaycaster.setFromCamera(cubePointer, cubeCamera);
    const intersects = cubeRaycaster.intersectObject(cubeMesh, false);

    if (intersects.length === 0) {
      hideHoverPatches();
      highlightFaces(null);
      cubeCanvas.style.cursor = "default";
      e.stopPropagation();
      return;
    }

    const intr = intersects[0] as any;
    const faceIndex = intr.face?.materialIndex ?? 0;

    // classify hover region using cubeMesh-local (unit cube) coords
    const pMeshLocal = cubeMesh.worldToLocal(intr.point.clone());
    lastMeshLocal.copy(pMeshLocal);
    const halfUnit = 0.5;
    const nx = pMeshLocal.x / Math.max(1e-6, halfUnit);
    const ny = pMeshLocal.y / Math.max(1e-6, halfUnit);
    const nz = pMeshLocal.z / Math.max(1e-6, halfUnit);

    const EDGE_THRESH_HOVER = 0.7; // easier hover targeting
    const nearX = Math.abs(nx) > EDGE_THRESH_HOVER;
    const nearY = Math.abs(ny) > EDGE_THRESH_HOVER;
    const nearZ = Math.abs(nz) > EDGE_THRESH_HOVER;
    const nearCount = (nearX ? 1 : 0) + (nearY ? 1 : 0) + (nearZ ? 1 : 0);

    cubeCanvas.style.cursor = "pointer";

    if (nearCount >= 2) {
      // EDGE or CORNER: show joined patches on adjacent faces
      const sx = nearX ? Math.sign(nx) || 1 : 0;
      const sy = nearY ? Math.sign(ny) || 1 : 0;
      const sz = nearZ ? Math.sign(nz) || 1 : 0;

      // clear face-center tint
      highlightFaces(null);

      // collect face material indices for the active faces
      const faceIndices: number[] = [];
      if (nearX) faceIndices.push(sx > 0 ? X_POS : X_NEG);
      if (nearY) faceIndices.push(sy > 0 ? Y_POS : Y_NEG);
      if (nearZ) faceIndices.push(sz > 0 ? Z_POS : Z_NEG);

      if (nearCount === 2) {
        setEdgePatchFromHover(lastMeshLocal, nearX, nearY, nearZ, sx, sy, sz);
      } else {
        setCornerPatchFromSigns(sx, sy, sz);
      }
    } else {
      // FACE CENTER: hide patches and tint the face
      hideHoverPatches();
      highlightFaces([faceIndex]);
    }

    e.stopPropagation();
  }

  function onCubePointerUp(e: PointerEvent) {
    if (!isDraggingCube) return;
    isDraggingCube = false;
    cubeCanvas.style.cursor = "default";
    try {
      (e.target as Element)?.releasePointerCapture?.(e.pointerId);
    } catch (_err) {
      // ignore
    }
    e.preventDefault();
    e.stopPropagation();
  }

  function onCubePointerCancel(e: PointerEvent) {
    isDraggingCube = false;
    cubeCanvas.style.cursor = "default";
    hideHoverPatches();
    try {
      (e.target as Element)?.releasePointerCapture?.(e.pointerId);
    } catch (_err) {
      // ignore
    }
    e.preventDefault();
    e.stopPropagation();
  }

  const cubeRaycaster = new THREE.Raycaster();
  const cubePointer = new THREE.Vector2();

  function updateCubeSize() {
    const cssW = cubeCanvas.clientWidth || cubeSizePx;
    const cssH = cubeCanvas.clientHeight || cubeSizePx;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    cubeRenderer.setPixelRatio(dpr);
    cubeRenderer.setSize(cssW, cssH, false);
  }

  updateCubeSize();

  function highlightFaces(indices: number[] | null) {
    // reset all faces
    for (let i = 0; i < faceMaterials.length; i++) {
      (faceMaterials[i] as THREE.MeshBasicMaterial).color.setHex(baseFaceColor);
    }
    if (!indices || indices.length === 0) {
      return;
    }
    // Apply highlight color to requested indices (only for face centers)
    for (const idx of indices) {
      if (faceMaterials[idx]) {
        (faceMaterials[idx] as THREE.MeshBasicMaterial).color.setHex(0xdbeafe); // light blue
      }
    }
    // store first highlighted face (no external usage currently)
  }

  // Helper: map preset name back to face material index (robust, doesn't assume order)
  function faceIndexForPreset(
    preset: "top" | "front" | "right" | "iso" | "bottom" | "left" | "back",
  ) {
    for (let i = 0; i < 6; i++) {
      if (mapFaceToPreset(i) === preset) return i;
    }
    return 0;
  }
  const X_POS = faceIndexForPreset("right");
  const X_NEG = faceIndexForPreset("left");
  const Y_POS = faceIndexForPreset("top");
  const Y_NEG = faceIndexForPreset("bottom");
  const Z_POS = faceIndexForPreset("front");
  const Z_NEG = faceIndexForPreset("back");

  function mapFaceToPreset(idx: number) {
    // material indices: 0:+X Right, 1:-X Left, 2:+Y Top, 3:-Y Bottom, 4:+Z Front, 5:-Z Back
    switch (idx) {
      case 2:
        return "top";
      case 3:
        return "bottom";
      case 4:
        return "front";
      case 5:
        return "back";
      case 0:
        return "right";
      case 1:
        return "left";
      default:
        return "iso";
    }
  }

  function onCubeClick(e: MouseEvent) {
    // Ignore click if it was actually a drag
    if (dragDistance > DRAG_THRESHOLD) {
      dragDistance = 0;
      e.stopPropagation();
      e.preventDefault();
      return;
    }
    dragDistance = 0;

    // click handler
    const rect = cubeCanvas.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    cubePointer.set(x, y);
    cubeRaycaster.setFromCamera(cubePointer, cubeCamera);
    const intersects = cubeRaycaster.intersectObject(cubeMesh, false);
    if (intersects.length === 0) {
      e.stopPropagation();
      e.preventDefault();
      return;
    }

    // classify click as FACE / EDGE / CORNER using local cube coordinates
    const intr = intersects[0] as any;
    const faceIndex = intr.face?.materialIndex ?? 0;

    // convert hit point to cubeRoot local space
    const pLocal = cubeRoot.worldToLocal(intr.point.clone());
    const halfSize = half; // half defined earlier (0.5 * cubeScale)
    const nx = pLocal.x / Math.max(1e-6, halfSize);
    const ny = pLocal.y / Math.max(1e-6, halfSize);
    const nz = pLocal.z / Math.max(1e-6, halfSize);

    const EDGE_THRESH = 0.78; // near-edge/corner threshold
    const nearX = Math.abs(nx) > EDGE_THRESH;
    const nearY = Math.abs(ny) > EDGE_THRESH;
    const nearZ = Math.abs(nz) > EDGE_THRESH;
    const nearCount = (nearX ? 1 : 0) + (nearY ? 1 : 0) + (nearZ ? 1 : 0);

    // helper: smooth snap camera to direction (dir is world-space vector from target toward camera)
    const snapToDirection = (dirWorld: THREE.Vector3) => {
      const target = controls.target.clone();
      // compute suitable distance
      let distance = activeCamera.position.distanceTo(target);
      // if distance is tiny or NaN, compute a fallback
      if (!isFinite(distance) || distance < 1e-3) distance = 300;

      // try to get a reasonable distance based on model extents
      const box = new THREE.Box3().setFromObject(modelRoot);
      if (!box.isEmpty()) {
        const size = box.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z, 1);
        const fov = ((persp as THREE.PerspectiveCamera).fov * Math.PI) / 180;
        const suggested = (maxDim / 2 / Math.tan(fov / 2)) * 1.25;
        distance = Math.max(distance, suggested);
      }

      const dest = target
        .clone()
        .add(dirWorld.clone().multiplyScalar(distance));

      // animate camera position over short duration
      const duration = 300;
      const startTime = performance.now();
      const startPersp = persp.position.clone();
      const startOrtho = ortho.position.clone();

      const animate = () => {
        const t = Math.min(1, (performance.now() - startTime) / duration);
        const ease = 1 - Math.pow(1 - t, 3);
        // lerp both cameras to keep them in sync
        persp.position.lerpVectors(startPersp, dest, ease);
        ortho.position.lerpVectors(startOrtho, dest, ease);
        // ensure cameras look at target and have correct up
        persp.up.set(0, 1, 0);
        ortho.up.set(0, 1, 0);
        persp.lookAt(target);
        ortho.lookAt(target);
        persp.updateProjectionMatrix();
        ortho.updateProjectionMatrix();
        controls.update();
        if (t < 1) {
          requestAnimationFrame(animate);
        }
      };

      animate();
    };

    if (nearCount >= 2) {
      // EDGE or CORNER -> isometric snap
      const sx = nearX ? Math.sign(nx) || 1 : 0;
      const sy = nearY ? Math.sign(ny) || 1 : 0;
      const sz = nearZ ? Math.sign(nz) || 1 : 0;
      // keep axis-based direction (do NOT apply cubeRoot/camera quaternion)
      const dirWorld = new THREE.Vector3(sx, sy, sz).normalize();
      snapToDirection(dirWorld);
    } else {
      // FACE: preserve existing mapping for exact face snaps
      const preset = mapFaceToPreset(faceIndex) as any;
      setView(preset);
    }

    e.stopPropagation();
    e.preventDefault();
  }

  // attach pointer listeners directly to the canvas (non-passive pointermove)
  cubeCanvas.addEventListener("pointerdown", onCubePointerDown as any, {
    passive: false,
  });
  cubeCanvas.addEventListener("pointermove", onCubePointerMove as any, {
    passive: false,
  });
  cubeCanvas.addEventListener("pointerup", onCubePointerUp as any);
  cubeCanvas.addEventListener("pointercancel", onCubePointerCancel as any);
  cubeCanvas.addEventListener("click", onCubeClick as any);
  // ensure pads are hidden when the pointer leaves the cube canvas
  cubeCanvas.addEventListener("pointerleave", (e: PointerEvent) => {
    hideHoverPatches();
    highlightFaces(null);
    cubeCanvas.style.cursor = "default";
    try {
      e.stopPropagation();
    } catch {
      /* ignore */
    }
  });

  // --- end view cube overlay ---

  const scene = new THREE.Scene();

  // Create a small, neutral room environment (no external HDR required).
  const pmremGenerator = new THREE.PMREMGenerator(renderer);
  // optional compile helper (no-op on older three versions)
  pmremGenerator.compileEquirectangularShader?.();
  const roomEnv = new RoomEnvironment();
  const envRT = pmremGenerator.fromScene(roomEnv as any, 0.04).texture;
  scene.environment = envRT;

  const aspect = container.clientWidth / Math.max(1, container.clientHeight);
  const persp = new THREE.PerspectiveCamera(50, aspect, 0.1, 10000);
  persp.position.set(250, 180, 250);

  const orthoHeight = 200;
  const ortho = new THREE.OrthographicCamera(
    (-orthoHeight * aspect) / 2,
    (orthoHeight * aspect) / 2,
    orthoHeight / 2,
    -orthoHeight / 2,
    -10000,
    10000,
  );
  ortho.position.copy(persp.position);

  let activeCamera: THREE.Camera = persp;

  const lastCamQuat = new THREE.Quaternion();
  const lastCamPos = new THREE.Vector3();
  lastCamQuat.copy(activeCamera.quaternion);
  lastCamPos.copy(activeCamera.position);

  controls = new OrbitControls(persp, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.1;
  // Update silhouette edges when the camera moves (throttled to rAF)
  // listener added after requestUpdateSilhouette is declared below

  const hemi = new THREE.HemisphereLight(0xffffff, 0x222244, 0.9);
  scene.add(hemi);
  const dir = new THREE.DirectionalLight(0xffffff, 1.0);
  dir.position.set(300, 400, 300);
  scene.add(dir);

  let gridHelper: THREE.GridHelper | null = null;
  let axesHelper: THREE.AxesHelper | null = null;

  gridHelper = new THREE.GridHelper(1000, 50, 0xcccccc, 0xeeeeee);
  gridHelper.position.y = 0;
  scene.add(gridHelper);

  axesHelper = new THREE.AxesHelper(200);
  axesHelper.position.set(0, 0, 0);
  scene.add(axesHelper);

  const modelRoot = new THREE.Group();
  modelRoot.name = "modelRoot";
  scene.add(modelRoot);

  // Feature edges overlay root (kept as a child of modelRoot so it inherits scene placement)
  const featureEdgesGroup = new THREE.Group();
  featureEdgesGroup.name = "featureEdgesGroup";
  modelRoot.add(featureEdgesGroup);

  // Subgroup for world-space edge visuals (LineSegments2) that live under featureEdgesGroup
  const edgesGroup = new THREE.Group();
  edgesGroup.name = "edgesGroup";
  featureEdgesGroup.add(edgesGroup);

  // CAD adjacency/cache for tangent + silhouette overlays (per-mesh)
  const cadMeshData = new WeakMap<THREE.Mesh, any>();

  // Silhouette update scheduling (throttle with rAF)
  let silhouetteUpdateRequested = false;
  let silhouetteRAFId: number | null = null;
  let silhouetteDirty = false;
  const camEpsilon = 1e-4;
  requestUpdateSilhouette = () => {
    if (silhouetteUpdateRequested) return;
    silhouetteUpdateRequested = true;
    silhouetteRAFId = requestAnimationFrame(() => {
      silhouetteUpdateRequested = false;
      silhouetteRAFId = null;
      try {
        updateSilhouetteEdges();
      } catch (e) {
        /* ignore errors during silhouette update */
      }
    });
  };

  // Attach orbit controls listener now that requestUpdateSilhouette is assigned
  try {
    controls.addEventListener("change", requestUpdateSilhouette as any);
  } catch {}

  // Update silhouette overlays for all meshes that have precomputed edge data
  function updateSilhouetteEdges() {
    // Determine camera world info once
    const isPerspective = (activeCamera as any).isPerspectiveCamera;
    const camWorldPos = new THREE.Vector3();
    const camWorldDir = new THREE.Vector3();
    if (isPerspective) activeCamera.getWorldPosition(camWorldPos);
    else activeCamera.getWorldDirection(camWorldDir).negate();

    modelRoot.traverse((child: any) => {
      if (!child || !child.isMesh) return;
      const mesh: THREE.Mesh = child as THREE.Mesh;
      const data = cadMeshData.get(mesh);
      if (!data) return;

      const { faceNormals, faceCenters, edges, silhouetteObj } = data;
      if (!silhouetteObj) return;
      const faceCount = faceNormals.length;
      const bias = modelDiagonal * 1e-8;
      // prepare normal matrix
      const normalMat = new THREE.Matrix3().getNormalMatrix(mesh.matrixWorld);

      const frontFacing: boolean[] = new Array(faceCount);
      for (let fi = 0; fi < faceCount; fi++) {
        const n = faceNormals[fi].clone().applyMatrix3(normalMat).normalize();
        const centerWorld = faceCenters[fi]
          .clone()
          .applyMatrix4(mesh.matrixWorld);
        const view = isPerspective
          ? camWorldPos.clone().sub(centerWorld)
          : camWorldDir;
        frontFacing[fi] = n.dot(view) > bias;
      }

      // build silhouette positions in world-space
      const silPositions: number[] = [];
      for (const e of edges) {
        const f0 = e.f0;
        const f1 = e.f1;
        const boundary = f1 === undefined || f1 === null;
        const isSil = boundary || frontFacing[f0] !== frontFacing[f1];
        if (!isSil) continue;
        // transform endpoints to world
        const aWorld = e.aPos.clone().applyMatrix4(mesh.matrixWorld);
        const bWorld = e.bPos.clone().applyMatrix4(mesh.matrixWorld);
        silPositions.push(
          aWorld.x,
          aWorld.y,
          aWorld.z,
          bWorld.x,
          bWorld.y,
          bWorld.z,
        );
      }

      // update silhouette geometry
      try {
        const geom = silhouetteObj.geometry as THREE.BufferGeometry;
        if (silPositions.length === 0) {
          // empty geometry
          geom.setAttribute(
            "position",
            new THREE.Float32BufferAttribute(new Float32Array(0), 3),
          );
          geom.computeBoundingSphere();
          silhouetteObj.visible = featureEdgesEnabled;
        } else {
          const posArr = new Float32Array(silPositions);
          geom.setAttribute("position", new THREE.BufferAttribute(posArr, 3));
          geom.computeBoundingSphere();
          silhouetteObj.visible = featureEdgesEnabled;
        }
      } catch (e) {
        /* ignore */
      }
    });
  }

  // Tracks current edge LineSegments objects for toggling + picking
  let featureEdgesEnabled = true;
  const featureEdgeLines: any[] = [];

  // Array of edge overlay THREE.LineSegments for edge picking (feature/tangent/silhouette)
  const edgePickables: THREE.LineSegments[] = [];

  // Wireframe overlay state (single overlay when loading a single Mesh)
  let wireframeEnabled = false;
  let wireframeLines: THREE.LineSegments | null = null;

  function setFeatureEdgesEnabled(visible: boolean) {
    featureEdgesEnabled = !!visible;
    try {
      // Toggle all tracked edge overlays
      for (const ln of featureEdgeLines) {
        try {
          ln.visible = featureEdgesEnabled;
        } catch {}
      }
      // Keep the group visibility in sync as a convenience
      featureEdgesGroup.visible = featureEdgesEnabled;
    } catch {
      /* ignore */
    }
  }

  // Helper: dispose and remove any existing edge overlays
  function clearFeatureEdges() {
    try {
      // Remove and dispose lines we previously created
      for (const ln of featureEdgeLines) {
        try {
          if (ln.geometry) ln.geometry.dispose();
        } catch {}
        try {
          const mat = ln.material as any;
          if (Array.isArray(mat)) mat.forEach((m: any) => m?.dispose?.());
          else mat?.dispose?.();
        } catch {}
        try {
          if (ln.parent) ln.parent.remove(ln);
        } catch {}
      }
      featureEdgeLines.length = 0;
      edgePickables.length = 0;

      // (No separate LineMaterial tracking for simple LineSegments overlays)

      // Also clear the edgesGroup children if any exist
      try {
        edgesGroup.traverse((obj: any) => {
          if (obj.geometry) obj.geometry.dispose?.();
          if (obj.material) {
            const m = obj.material as any;
            if (Array.isArray(m)) m.forEach((mm: any) => mm?.dispose?.());
            else m?.dispose?.();
          }
        });
        edgesGroup.clear();
      } catch {}
    } catch {
      /* ignore */
    }
  }

  // Wireframe overlay helpers
  function disposeWireframeOverlay() {
    try {
      if (wireframeLines) {
        if (wireframeLines.geometry) wireframeLines.geometry.dispose();
        if (wireframeLines.material)
          (wireframeLines.material as any).dispose?.();
        if (wireframeLines.parent) wireframeLines.parent.remove(wireframeLines);
        wireframeLines = null;
      }
    } catch {
      /* ignore */
    }
  }

  function buildWireframeOverlay(mesh: THREE.Mesh) {
    try {
      disposeWireframeOverlay();
      if (!mesh || !mesh.geometry) return;
      const wfGeom = new THREE.WireframeGeometry(mesh.geometry);
      const wfMat = new THREE.LineBasicMaterial({
        color: 0x000000,
        transparent: true,
        opacity: 0.9,
        depthTest: false,
        depthWrite: false,
      });
      const lines = new THREE.LineSegments(wfGeom, wfMat);
      lines.renderOrder = 9999;
      lines.frustumCulled = false;
      lines.userData.__edgeOverlay = true;
      // add as a child of the mesh so it inherits transforms
      mesh.add(lines);
      wireframeLines = lines;
      wireframeLines.visible = !!wireframeEnabled;
    } catch {
      /* ignore */
    }
  }

  // Rebuild feature edges by traversing mesh objects and attaching a LineSegments
  // overlay using THREE.EdgesGeometry + THREE.LineSegments. Each overlay is added
  // as a child of its source mesh so transforms always match.
  function rebuildFeatureEdges(thresholdAngleDeg = 40) {
    clearFeatureEdges();

    modelRoot.traverse((child: any) => {
      if (!child.isMesh || !child.geometry) return;
      try {
        const edgesGeom = new THREE.EdgesGeometry(
          child.geometry,
          thresholdAngleDeg,
        );
        const edgesMat = new THREE.LineBasicMaterial({
          color: 0x111111,
          transparent: true,
          opacity: 0.9,
          depthWrite: false,
        });
        const edges = new THREE.LineSegments(edgesGeom, edgesMat);
        edges.userData.__isFeatureEdge = true;
        edges.userData.__edgeOverlay = true;
        edges.name = "featureEdges";
        edges.renderOrder = (child.renderOrder ?? 0) + 1;
        edges.frustumCulled = false;
        // parent to the mesh so it inherits position/rotation/scale
        child.add(edges);
        featureEdgeLines.push(edges);
        edgePickables.push(edges);
        edges.visible = featureEdgesEnabled;
      } catch {
        /* ignore per-mesh errors */
      }
    });
  }

  // Backwards-compatible wrapper used elsewhere in the file
  function createFeatureEdgesForModel() {
    rebuildFeatureEdges();
  }

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();

  const measureMaterial = new THREE.LineBasicMaterial({
    color: 0x000000,
    depthTest: false,
    depthWrite: false,
  });
  let measureLine: THREE.Line | null = null;
  let measureLineGeometry: THREE.BufferGeometry | null = null;
  let measureLabel: THREE.Sprite | null = null;
  let measureLabelText: string | null = null;
  let measureBaseP1: THREE.Vector3 | null = null;
  let measureBaseP2: THREE.Vector3 | null = null;
  let measureBaseLabel: string | null = null;

  const arrowMaterial = new THREE.MeshBasicMaterial({
    color: 0x000000,
    side: THREE.DoubleSide,
    depthTest: false,
    depthWrite: false,
  });
  let measureArrow1: THREE.Mesh | null = null;
  let measureArrow2: THREE.Mesh | null = null;
  let measureArrow1Geometry: THREE.BufferGeometry | null = null;
  let measureArrow2Geometry: THREE.BufferGeometry | null = null;
  let measureArrowBillboard: THREE.Group | null = null;
  const measureArrowXAxis = new THREE.Vector3(1, 0, 0);
  let measureGraphicsScale = 1;

  // Edge hover overlay (neon highlight for edge picking)
  let edgeHoverLine: Line2 | null = null;
  let edgeHoverLineGeometry: LineGeometry | null = null;
  let edgeHoverLineMaterial: LineMaterial | null = null;
  let edgeHoverSphere1: THREE.Mesh | null = null;
  let edgeHoverSphere2: THREE.Mesh | null = null;

  let modelBounds = { min: 0, max: 0 };
  let modelDiagonal = 0;
  let currentClippingValue: number | null = null;

  function setOverlayVisible(visible: boolean) {
    if (gridHelper) gridHelper.visible = visible;
    if (axesHelper) axesHelper.visible = visible;
  }

  function setMeasurementGraphicsScale(scale: number) {
    measureGraphicsScale = Math.max(0.1, Math.min(scale, 4));
    if (measureLabel) {
      const baseLabelScale = 0.32;
      measureLabel.scale.set(
        baseLabelScale * measureGraphicsScale,
        0.2 * measureGraphicsScale,
        1,
      );
    }
  }

  function fitCameraToBox(box: THREE.Box3, padding = 1.25) {
    if (box.isEmpty()) return;
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());

    const maxDim = Math.max(size.x, size.y, size.z);
    const fov = (persp.fov * Math.PI) / 180;
    const distance = (maxDim / 2 / Math.tan(fov / 2)) * padding;

    const dirVec = new THREE.Vector3(1, 0.8, 1).normalize();
    persp.position.copy(center.clone().add(dirVec.multiplyScalar(distance)));
    persp.near = Math.max(0.1, distance * 0.01);
    persp.far = distance * 100 + maxDim;
    persp.updateProjectionMatrix();

    const half = (maxDim * padding) / 2;
    const aspect = container.clientWidth / Math.max(1, container.clientHeight);
    ortho.left = -half * aspect;
    ortho.right = half * aspect;
    ortho.top = half;
    ortho.bottom = -half;
    ortho.near = -10000;
    ortho.far = 10000;
    ortho.position.copy(persp.position);
    ortho.lookAt(center);
    ortho.updateProjectionMatrix();

    controls.target.copy(center);
    controls.update();
    requestUpdateSilhouette?.();
  }

  // function computeBoxOf(object: THREE.Object3D) {
  //   const box = new THREE.Box3();
  //   box.setFromObject(object);
  //   return box;
  // }

  function pickAtScreenPosition(
    ndcX: number,
    ndcY: number,
  ): THREE.Vector3 | null {
    // Use a fresh NDC vector so we don't interfere with other raycasts
    const ndc = new THREE.Vector2(ndcX, ndcY);
    raycaster.setFromCamera(ndc, activeCamera);
    const intersects = raycaster.intersectObjects(modelRoot.children, true);
    if (intersects.length === 0) return null;
    // Prefer mesh hits (ignore edge overlays / lines). Find first intersect that's a Mesh.
    for (const intr of intersects) {
      const obj = intr.object as any;
      if (obj && obj.isMesh) {
        return intr.point.clone();
      }
    }
    return null;
  }

  /**
   * Raycast only against feature edge LineSegments and return a snapped point on
   * the closest segment. Returns { point, object } or null when nothing hit.
   */
  function pickEdgeAtScreenPosition(
    ndcX: number,
    ndcY: number,
  ): { point: THREE.Vector3; object: THREE.Object3D } | null {
    const ndc = new THREE.Vector2(ndcX, ndcY);
    raycaster.setFromCamera(ndc, activeCamera);

    // Raycast only against the tracked edge LineSegments for the model
    if (edgePickables.length === 0) return null;
    // Allow some leeway when picking lines so the user doesn't have to be pixel-perfect
    try {
      // Larger thresholds make it easier; tuned for models in mm units
      (raycaster.params as any).Line = (raycaster.params as any).Line || {};
      (raycaster.params as any).Line.threshold = Math.max(
        0.1,
        modelDiagonal * 0.005,
      );
    } catch {}

    const intersects = raycaster.intersectObjects(edgePickables, true);
    if (intersects.length === 0) return null;

    // Use the nearest intersection first
    const intr = intersects[0];
    const line = intr.object as THREE.Object3D;
    const geom: any = (line as any).geometry;
    if (!geom) return null;

    // Use the intersection point as a seed then find the closest segment in the line geometry.
    const P = intr.point.clone();

    // Fetch a flat positions array (vertex coords in the line's local space)
    let positions: ArrayLike<number> | null = null;
    if (geom.isBufferGeometry) {
      const attr = geom.getAttribute("position");
      positions = attr ? (attr.array as ArrayLike<number>) : null;
    } else if ((geom as any).attributes && (geom as any).attributes.position) {
      positions = (geom as any).attributes.position.array as ArrayLike<number>;
    }
    if (!positions || positions.length < 6) return null;

    const matWorld = line.matrixWorld;

    // If the raycast provided an index, use it to locate the segment endpoints directly.
    const idx = (intr as any).index;
    const v0 = new THREE.Vector3();
    const v1 = new THREE.Vector3();

    if (typeof idx === "number" && isFinite(idx)) {
      // vertex index into the position attribute
      const vertexIndex = idx as number;
      const startVertex = vertexIndex % 2 === 0 ? vertexIndex : vertexIndex - 1;
      const v0i = startVertex * 3;
      const v1i = v0i + 3;
      v0.set(
        positions[v0i],
        positions[v0i + 1],
        positions[v0i + 2],
      ).applyMatrix4(matWorld);
      v1.set(
        positions[v1i],
        positions[v1i + 1],
        positions[v1i + 2],
      ).applyMatrix4(matWorld);

      // Project P onto segment v0--v1
      const seg = new THREE.Vector3().subVectors(v1, v0);
      const segLen2 = seg.lengthSq();
      let t = 0;
      if (segLen2 > 0) {
        t = Math.max(
          0,
          Math.min(1, new THREE.Vector3().subVectors(P, v0).dot(seg) / segLen2),
        );
      }
      const snapped = v0.clone().add(seg.multiplyScalar(t));
      return { point: snapped, object: line };
    }

    // Fallback: brute-force search the closest segment
    let bestDist = Infinity;
    let bestPoint: THREE.Vector3 | null = null;
    for (let i = 0; i < positions.length; i += 6) {
      v0.set(positions[i], positions[i + 1], positions[i + 2]).applyMatrix4(
        matWorld,
      );
      v1.set(positions[i + 3], positions[i + 4], positions[i + 5]).applyMatrix4(
        matWorld,
      );
      const seg = new THREE.Vector3().subVectors(v1, v0);
      const segLen2 = seg.lengthSq();
      let t = 0;
      if (segLen2 > 0) {
        t = Math.max(
          0,
          Math.min(1, new THREE.Vector3().subVectors(P, v0).dot(seg) / segLen2),
        );
      }
      const candidate = v0.clone().add(seg.multiplyScalar(t));
      const d2 = candidate.distanceToSquared(P);
      if (d2 < bestDist) {
        bestDist = d2;
        bestPoint = candidate;
      }
    }

    if (!bestPoint) return null;
    return { point: bestPoint, object: line };
  }

  /**
   * Highlights an edge at the given screen position with a neon hover overlay.
   * Raycasts against edgePickables, extracts hit segment endpoints, and draws
   * a line + endpoint spheres with depthTest=false and high renderOrder.
   */
  function highlightEdgeAtScreenPosition(ndcX: number, ndcY: number): void {
    const ndc = new THREE.Vector2(ndcX, ndcY);
    raycaster.setFromCamera(ndc, activeCamera);

    if (edgePickables.length === 0) {
      clearEdgeHighlight();
      return;
    }

    // Scale threshold by model diagonal for better picking across different model sizes
    try {
      (raycaster.params as any).Line = (raycaster.params as any).Line || {};
      (raycaster.params as any).Line.threshold = Math.max(
        0.1,
        modelDiagonal * 0.005,
      );
    } catch {}

    const intersects = raycaster.intersectObjects(edgePickables, true);
    if (intersects.length === 0) {
      clearEdgeHighlight();
      return;
    }

    const intr = intersects[0];
    const line = intr.object as THREE.Object3D;
    const geom: any = (line as any).geometry;
    if (!geom) {
      clearEdgeHighlight();
      return;
    }

    const P = intr.point.clone();
    let positions: ArrayLike<number> | null = null;
    if (geom.isBufferGeometry) {
      const attr = geom.getAttribute("position");
      positions = attr ? (attr.array as ArrayLike<number>) : null;
    } else if ((geom as any).attributes && (geom as any).attributes.position) {
      positions = (geom as any).attributes.position.array as ArrayLike<number>;
    }
    if (!positions || positions.length < 6) {
      clearEdgeHighlight();
      return;
    }

    const matWorld = line.matrixWorld;
    const v0 = new THREE.Vector3();
    const v1 = new THREE.Vector3();

    // Find the closest segment
    let bestDist = Infinity;
    let bestV0: THREE.Vector3 | null = null;
    let bestV1: THREE.Vector3 | null = null;

    const idx = (intr as any).index;
    if (typeof idx === "number" && isFinite(idx)) {
      const vertexIndex = idx as number;
      const startVertex = vertexIndex % 2 === 0 ? vertexIndex : vertexIndex - 1;
      const v0i = startVertex * 3;
      const v1i = v0i + 3;
      v0.set(
        positions[v0i],
        positions[v0i + 1],
        positions[v0i + 2],
      ).applyMatrix4(matWorld);
      v1.set(
        positions[v1i],
        positions[v1i + 1],
        positions[v1i + 2],
      ).applyMatrix4(matWorld);
      bestV0 = v0.clone();
      bestV1 = v1.clone();
    } else {
      // Brute-force search
      for (let i = 0; i < positions.length; i += 6) {
        v0.set(positions[i], positions[i + 1], positions[i + 2]).applyMatrix4(
          matWorld,
        );
        v1.set(
          positions[i + 3],
          positions[i + 4],
          positions[i + 5],
        ).applyMatrix4(matWorld);
        const seg = new THREE.Vector3().subVectors(v1, v0);
        const segLen2 = seg.lengthSq();
        let t = 0;
        if (segLen2 > 0) {
          t = Math.max(
            0,
            Math.min(
              1,
              new THREE.Vector3().subVectors(P, v0).dot(seg) / segLen2,
            ),
          );
        }
        const candidate = v0.clone().add(seg.multiplyScalar(t));
        const d2 = candidate.distanceToSquared(P);
        if (d2 < bestDist) {
          bestDist = d2;
          bestV0 = v0.clone();
          bestV1 = v1.clone();
        }
      }
    }

    if (!bestV0 || !bestV1) {
      clearEdgeHighlight();
      return;
    }

    // Draw neon hover overlay (thick, screen-space line)
    if (!edgeHoverLineMaterial) {
      edgeHoverLineMaterial = new LineMaterial({
        color: 0x00ffff,
        linewidth: 4,
        depthTest: false,
        depthWrite: false,
      });
      edgeHoverLineMaterial.resolution.set(
        container.clientWidth,
        container.clientHeight,
      );
    }

    if (!edgeHoverLineGeometry) {
      edgeHoverLineGeometry = new LineGeometry();
    }
    edgeHoverLineGeometry.setPositions([
      bestV0.x,
      bestV0.y,
      bestV0.z,
      bestV1.x,
      bestV1.y,
      bestV1.z,
    ]);

    if (!edgeHoverLine) {
      edgeHoverLine = new Line2(edgeHoverLineGeometry, edgeHoverLineMaterial);
      edgeHoverLine.renderOrder = 10001;
      edgeHoverLine.frustumCulled = false;
      scene.add(edgeHoverLine);
    } else {
      edgeHoverLine.geometry = edgeHoverLineGeometry;
    }

    // Endpoint spheres
    const sphereRadius = Math.max(0.1, modelDiagonal * 0.003);
    const sphereGeom = new THREE.SphereGeometry(sphereRadius, 16, 16);
    const sphereMat = new THREE.MeshBasicMaterial({
      color: 0x00ffff,
      depthTest: false,
      depthWrite: false,
    });

    if (edgeHoverSphere1) {
      scene.remove(edgeHoverSphere1);
      edgeHoverSphere1.geometry.dispose();
      (edgeHoverSphere1.material as THREE.Material).dispose();
    }
    edgeHoverSphere1 = new THREE.Mesh(sphereGeom, sphereMat.clone());
    edgeHoverSphere1.position.copy(bestV0);
    edgeHoverSphere1.renderOrder = 10001;
    scene.add(edgeHoverSphere1);

    if (edgeHoverSphere2) {
      scene.remove(edgeHoverSphere2);
      edgeHoverSphere2.geometry.dispose();
      (edgeHoverSphere2.material as THREE.Material).dispose();
    }
    edgeHoverSphere2 = new THREE.Mesh(sphereGeom, sphereMat);
    edgeHoverSphere2.position.copy(bestV1);
    edgeHoverSphere2.renderOrder = 10001;
    scene.add(edgeHoverSphere2);
  }

  /**
   * Clears the edge hover overlay.
   */
  function clearEdgeHighlight(): void {
    if (edgeHoverLine) {
      scene.remove(edgeHoverLine);
      edgeHoverLine = null;
    }
    if (edgeHoverLineGeometry) {
      edgeHoverLineGeometry.dispose();
      edgeHoverLineGeometry = null;
    }
    if (edgeHoverLineMaterial) {
      edgeHoverLineMaterial.dispose();
      edgeHoverLineMaterial = null;
    }
    if (edgeHoverSphere1) {
      scene.remove(edgeHoverSphere1);
      edgeHoverSphere1.geometry.dispose();
      (edgeHoverSphere1.material as THREE.Material).dispose();
      edgeHoverSphere1 = null;
    }
    if (edgeHoverSphere2) {
      scene.remove(edgeHoverSphere2);
      edgeHoverSphere2.geometry.dispose();
      (edgeHoverSphere2.material as THREE.Material).dispose();
      edgeHoverSphere2 = null;
    }
  }

  /**
   * Measures an edge at the given screen position. Raycasts against edgePickables,
   * extracts hit segment endpoints, calls setMeasurementSegment with start, end, and label,
   * and returns the numeric length.
   */
  function measureEdgeAtScreenPosition(
    ndcX: number,
    ndcY: number,
  ): number | null {
    const ndc = new THREE.Vector2(ndcX, ndcY);
    raycaster.setFromCamera(ndc, activeCamera);

    if (edgePickables.length === 0) return null;

    try {
      (raycaster.params as any).Line = (raycaster.params as any).Line || {};
      (raycaster.params as any).Line.threshold = Math.max(
        0.1,
        modelDiagonal * 0.005,
      );
    } catch {}

    const intersects = raycaster.intersectObjects(edgePickables, true);
    if (intersects.length === 0) return null;

    const intr = intersects[0];
    const line = intr.object as THREE.Object3D;
    const geom: any = (line as any).geometry;
    if (!geom) return null;

    const P = intr.point.clone();
    let positions: ArrayLike<number> | null = null;
    if (geom.isBufferGeometry) {
      const attr = geom.getAttribute("position");
      positions = attr ? (attr.array as ArrayLike<number>) : null;
    } else if ((geom as any).attributes && (geom as any).attributes.position) {
      positions = (geom as any).attributes.position.array as ArrayLike<number>;
    }
    if (!positions || positions.length < 6) return null;

    const matWorld = line.matrixWorld;
    const v0 = new THREE.Vector3();
    const v1 = new THREE.Vector3();

    let bestDist = Infinity;
    let bestV0: THREE.Vector3 | null = null;
    let bestV1: THREE.Vector3 | null = null;

    const idx = (intr as any).index;
    if (typeof idx === "number" && isFinite(idx)) {
      const vertexIndex = idx as number;
      const startVertex = vertexIndex % 2 === 0 ? vertexIndex : vertexIndex - 1;
      const v0i = startVertex * 3;
      const v1i = v0i + 3;
      v0.set(
        positions[v0i],
        positions[v0i + 1],
        positions[v0i + 2],
      ).applyMatrix4(matWorld);
      v1.set(
        positions[v1i],
        positions[v1i + 1],
        positions[v1i + 2],
      ).applyMatrix4(matWorld);
      bestV0 = v0.clone();
      bestV1 = v1.clone();
    } else {
      for (let i = 0; i < positions.length; i += 6) {
        v0.set(positions[i], positions[i + 1], positions[i + 2]).applyMatrix4(
          matWorld,
        );
        v1.set(
          positions[i + 3],
          positions[i + 4],
          positions[i + 5],
        ).applyMatrix4(matWorld);
        const seg = new THREE.Vector3().subVectors(v1, v0);
        const segLen2 = seg.lengthSq();
        let t = 0;
        if (segLen2 > 0) {
          t = Math.max(
            0,
            Math.min(
              1,
              new THREE.Vector3().subVectors(P, v0).dot(seg) / segLen2,
            ),
          );
        }
        const candidate = v0.clone().add(seg.multiplyScalar(t));
        const d2 = candidate.distanceToSquared(P);
        if (d2 < bestDist) {
          bestDist = d2;
          bestV0 = v0.clone();
          bestV1 = v1.clone();
        }
      }
    }

    if (!bestV0 || !bestV1) return null;

    // Convert from modelRoot local space to world space for measurement overlay
    const v0Local = bestV0.clone();
    const v1Local = bestV1.clone();
    modelRoot.worldToLocal(v0Local);
    modelRoot.worldToLocal(v1Local);
    const v0World = v0Local.clone().applyMatrix4(modelRoot.matrixWorld);
    const v1World = v1Local.clone().applyMatrix4(modelRoot.matrixWorld);

    const length = v0World.distanceTo(v1World);
    const label = Number.isFinite(length) ? `${length.toFixed(2)} mm` : null;
    setMeasurementSegment(v0World, v1World, label);
    return length;
  }

  function updateMeasurementOverlay() {
    if (!measureBaseP1 || !measureBaseP2) {
      if (measureLine) measureLine.visible = false;
      if (measureArrow1) measureArrow1.visible = false;
      if (measureArrow2) measureArrow2.visible = false;
      if (measureLabel) measureLabel.visible = false;
      return;
    }

    const p1 = measureBaseP1.clone();
    const p2 = measureBaseP2.clone();
    const dir = new THREE.Vector3().subVectors(p2, p1);
    const len = dir.length();
    if (len === 0) {
      if (measureLine) measureLine.visible = false;
      if (measureArrow1) measureArrow1.visible = false;
      if (measureArrow2) measureArrow2.visible = false;
      if (measureLabel) measureLabel.visible = false;
      return;
    }
    dir.normalize();

    const mid = new THREE.Vector3().addVectors(p1, p2).multiplyScalar(0.5);
    const viewDir = new THREE.Vector3()
      .subVectors(activeCamera.position, mid)
      .normalize();
    const overlayOffsetAmount = modelDiagonal > 0 ? modelDiagonal * 1e-4 : 0;
    const overlayOffset = viewDir.clone().multiplyScalar(overlayOffsetAmount);
    const p1o = p1.clone().add(overlayOffset);
    const p2o = p2.clone().add(overlayOffset);

    if (!measureLineGeometry) {
      measureLineGeometry = new THREE.BufferGeometry();
      measureLineGeometry.setAttribute(
        "position",
        new THREE.BufferAttribute(new Float32Array(6), 3),
      );
    }
    const pos = measureLineGeometry.getAttribute(
      "position",
    ) as THREE.BufferAttribute;
    pos.setXYZ(0, p1o.x, p1o.y, p1o.z);
    pos.setXYZ(1, p2o.x, p2o.y, p2o.z);
    pos.needsUpdate = true;

    if (!measureLine) {
      measureLine = new THREE.Line(measureLineGeometry, measureMaterial);
      measureLine.renderOrder = 999;
      scene.add(measureLine);
    }
    measureLine.visible = true;

    const arrowLength = Math.max(len * 0.07, 5 * measureGraphicsScale);
    const baseHalfWidth = arrowLength * 0.4;

    if (!measureArrow1Geometry) {
      measureArrow1Geometry = new THREE.BufferGeometry();
      measureArrow1Geometry.setAttribute(
        "position",
        new THREE.BufferAttribute(new Float32Array(9), 3),
      );
      measureArrow1Geometry.setIndex([0, 1, 2]);
    }
    if (!measureArrow2Geometry) {
      measureArrow2Geometry = new THREE.BufferGeometry();
      measureArrow2Geometry.setAttribute(
        "position",
        new THREE.BufferAttribute(new Float32Array(9), 3),
      );
      measureArrow2Geometry.setIndex([0, 1, 2]);
    }

    if (!measureArrow1) {
      measureArrow1 = new THREE.Mesh(measureArrow1Geometry, arrowMaterial);
      measureArrow1.renderOrder = 999;
    }
    if (!measureArrow2) {
      measureArrow2 = new THREE.Mesh(measureArrow2Geometry, arrowMaterial);
      measureArrow2.renderOrder = 999;
    }

    const arrow1Pos = measureArrow1Geometry.getAttribute(
      "position",
    ) as THREE.BufferAttribute;
    const arrow2Pos = measureArrow2Geometry.getAttribute(
      "position",
    ) as THREE.BufferAttribute;

    // Arrow geometry is defined in local space with the tip at the origin
    // and the triangle extending only in -X from the tip.
    arrow1Pos.setXYZ(0, 0, 0, 0);
    arrow1Pos.setXYZ(1, -arrowLength, baseHalfWidth, 0);
    arrow1Pos.setXYZ(2, -arrowLength, -baseHalfWidth, 0);
    arrow1Pos.needsUpdate = true;

    arrow2Pos.setXYZ(0, 0, 0, 0);
    arrow2Pos.setXYZ(1, -arrowLength, baseHalfWidth, 0);
    arrow2Pos.setXYZ(2, -arrowLength, -baseHalfWidth, 0);
    arrow2Pos.needsUpdate = true;

    if (!measureArrowBillboard) {
      measureArrowBillboard = new THREE.Group();
      scene.add(measureArrowBillboard);
    }

    if (measureArrow1.parent !== measureArrowBillboard) {
      measureArrowBillboard.add(measureArrow1);
    }
    if (measureArrow2.parent !== measureArrowBillboard) {
      measureArrowBillboard.add(measureArrow2);
    }

    measureArrowBillboard.quaternion.copy(activeCamera.quaternion);
    const billboardInvQuat = measureArrowBillboard.quaternion.clone().invert();

    const p1Local = p1o.clone().applyQuaternion(billboardInvQuat);
    const p2Local = p2o.clone().applyQuaternion(billboardInvQuat);
    const dirLocal = new THREE.Vector3()
      .subVectors(p2Local, p1Local)
      .normalize();

    measureArrow1.visible = true;
    measureArrow2.visible = true;
    measureArrow1.position.copy(p1Local);
    measureArrow2.position.copy(p2Local);
    measureArrow1.quaternion.setFromUnitVectors(
      measureArrowXAxis,
      dirLocal.clone().negate(),
    );
    measureArrow2.quaternion.setFromUnitVectors(measureArrowXAxis, dirLocal);

    if (!measureBaseLabel) {
      if (measureLabel) measureLabel.visible = false;
      return;
    }

    if (!measureLabel || measureLabelText !== measureBaseLabel) {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      if (ctx) {
        const fontSize = 26;
        ctx.font = `${fontSize}px sans-serif`;
        const metrics = ctx.measureText(measureBaseLabel);
        const padding = 20;
        canvas.width = Math.ceil(metrics.width + padding * 2);
        canvas.height = Math.ceil(fontSize + padding * 2);
        ctx.font = `${fontSize}px sans-serif`;
        ctx.fillStyle = "black";
        ctx.strokeStyle = "white";
        ctx.lineWidth = 4;
        const x = padding;
        const y = padding + fontSize * 0.8;
        ctx.strokeText(measureBaseLabel, x, y);
        ctx.fillText(measureBaseLabel, x, y);
      }

      const texture = new THREE.CanvasTexture(canvas);
      const mat = new THREE.SpriteMaterial({
        map: texture,
        depthTest: false,
        depthWrite: false,
        sizeAttenuation: false,
      });

      if (measureLabel) {
        if (measureLabel.material.map) {
          measureLabel.material.map.dispose();
        }
        measureLabel.material.dispose();
        measureLabel.material = mat;
      } else {
        measureLabel = new THREE.Sprite(mat);
        measureLabel.renderOrder = 1000;
        scene.add(measureLabel);
      }
      measureLabelText = measureBaseLabel;
    }

    if (!measureLabel) return;

    const a = p1o.clone().project(activeCamera);
    const b = p2o.clone().project(activeCamera);
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const midNDC = new THREE.Vector2((a.x + b.x) * 0.5, (a.y + b.y) * 0.5);
    const perp = new THREE.Vector2(-dy, dx);
    if (perp.lengthSq() === 0) {
      perp.set(0, 1);
    } else {
      perp.normalize();
    }
    const pxOffset = 24 * measureGraphicsScale;
    const width = renderer.domElement.clientWidth || 1;
    const height = renderer.domElement.clientHeight || 1;
    const ndcOffsetX = (perp.x * pxOffset * 2) / width;
    const ndcOffsetY = (perp.y * pxOffset * 2) / height;
    const midZ = (a.z + b.z) * 0.5;
    const labelNDC = new THREE.Vector3(
      midNDC.x + ndcOffsetX,
      midNDC.y + ndcOffsetY,
      midZ,
    );
    labelNDC.unproject(activeCamera);

    measureLabel.visible = true;
    measureLabel.position.copy(labelNDC);
    const baseLabelScale = 0.28;
    measureLabel.scale.set(
      baseLabelScale * measureGraphicsScale,
      0.2 * measureGraphicsScale,
      1,
    );
  }

  function setMeasurementSegment(
    p1: THREE.Vector3 | null,
    p2: THREE.Vector3 | null,
    labelText?: string | null,
  ) {
    if (p1 === null || p2 === null) {
      measureBaseP1 = null;
      measureBaseP2 = null;
      measureBaseLabel = null;
      measureLabelText = null;
      updateMeasurementOverlay();
      return;
    }

    measureBaseP1 = p1.clone();
    measureBaseP2 = p2.clone();
    measureBaseLabel = labelText ?? null;
    updateMeasurementOverlay();
  }

  function getScreenshotDataURL(): string {
    const prevGridVisible = gridHelper ? gridHelper.visible : false;
    const prevAxesVisible = axesHelper ? axesHelper.visible : false;

    setOverlayVisible(false);

    renderer.render(scene, activeCamera);
    const dataURL = renderer.domElement.toDataURL("image/png");

    if (gridHelper) gridHelper.visible = prevGridVisible;
    if (axesHelper) axesHelper.visible = prevAxesVisible;

    return dataURL;
  }

  function getOutlineSnapshotDataURL(): string {
    const prevGridVisible = gridHelper ? gridHelper.visible : false;
    const prevAxesVisible = axesHelper ? axesHelper.visible : false;

    const prevLineColor = measureMaterial.color.clone();
    const prevArrowColor = arrowMaterial.color.clone();
    let prevLabelColor: THREE.Color | null = null;
    if (measureLabel && (measureLabel.material as any).color) {
      prevLabelColor = (measureLabel.material as any).color.clone();
    }

    setOverlayVisible(false);

    measureMaterial.color.set(0x000000);
    arrowMaterial.color.set(0x000000);
    if (measureLabel && (measureLabel.material as any).color) {
      (measureLabel.material as any).color.set(0x000000);
    }

    const prevClearColor = renderer.getClearColor(new THREE.Color()).clone();
    const prevClearAlpha = renderer.getClearAlpha();
    const prevBackground = scene.background;
    const prevModelVisible = modelRoot.visible;

    const edgesGroup = new THREE.Group();

    modelRoot.traverse((obj: any) => {
      if (!obj.isMesh || !obj.geometry) return;

      const geom = obj.geometry as THREE.BufferGeometry;
      const edgeThreshold = 40;
      const edgesGeom = new THREE.EdgesGeometry(geom, edgeThreshold);
      const edgesMat = new THREE.LineBasicMaterial({ color: 0x000000 });
      const edges = new THREE.LineSegments(edgesGeom, edgesMat);
      edges.userData.__edgeOverlay = true;
      edges.applyMatrix4(obj.matrixWorld);
      edgesGroup.add(edges);
    });

    scene.add(edgesGroup);

    const prevModelVisibleForCube = modelRoot.visible;
    modelRoot.visible = false;

    renderer.setClearColor(0xffffff, 1);
    scene.background = null;

    renderer.render(scene, activeCamera);

    const dataURL = renderer.domElement.toDataURL("image/png");

    scene.remove(edgesGroup);
    edgesGroup.traverse((obj: any) => {
      const asAny = obj as any;
      if (asAny.geometry) asAny.geometry.dispose();
      if (asAny.material) {
        if (Array.isArray(asAny.material)) {
          asAny.material.forEach((m: any) => m.dispose());
        } else {
          asAny.material.dispose();
        }
      }
    });

    modelRoot.visible = prevModelVisibleForCube;
    renderer.setClearColor(prevClearColor, prevClearAlpha);
    scene.background = prevBackground;

    measureMaterial.color.copy(prevLineColor);
    arrowMaterial.color.copy(prevArrowColor);
    if (
      measureLabel &&
      prevLabelColor &&
      (measureLabel.material as any).color
    ) {
      (measureLabel.material as any).color.copy(prevLabelColor);
    }
    if (gridHelper) gridHelper.visible = prevGridVisible;
    if (axesHelper) axesHelper.visible = prevAxesVisible;

    return dataURL;
  }

  function loadMeshFromGeometry(geom: THREE.BufferGeometry) {
    // 1) Ensure normals if it looks like a mesh
    // A simple heuristic: if it has enough vertices to form at least one triangle
    // and we expect it to be a mesh.
    // For DXF, we might have many vertices but they are for lines.
    // If computeVertexNormals was called in mesh-loader, it might have normals.

    // 2) Recenter geometry at origin
    geom.computeBoundingBox();
    const gbox = geom.boundingBox!.clone();
    const gcenter = gbox.getCenter(new THREE.Vector3());
    geom.translate(-gcenter.x, -gcenter.y, -gcenter.z);

    // 3) Create object and add to scene
    // Determine if we should use Mesh or LineSegments
    // If it has normals, it's likely a mesh.
    const hasNormals = !!geom.getAttribute("normal");

    let object: THREE.Object3D;
    if (hasNormals) {
      // Use realistic stainless steel material by default
      const material = createStainlessSteelMaterial().clone();
      material.side = THREE.DoubleSide;
      object = new THREE.Mesh(geom, material);
    } else {
      const material = new THREE.LineBasicMaterial({
        color: 0xb8c2ff,
      });
      object = new THREE.LineSegments(geom, material);
    }

    // Remove existing model children except the featureEdgesRoot, disposing resources
    // dispose wireframe overlay for old model before removing children
    disposeWireframeOverlay();

    for (const child of [...modelRoot.children]) {
      if (child === featureEdgesGroup) continue;
      try {
        child.traverse((obj: any) => {
          if (obj.geometry) obj.geometry.dispose();
          if (obj.material) {
            if (Array.isArray(obj.material)) {
              obj.material.forEach((m: any) => {
                if (m.map) m.map.dispose();
                m.dispose();
              });
            } else {
              if (obj.material.map) obj.material.map.dispose();
              obj.material.dispose();
            }
          }
        });
      } catch {
        /* ignore */
      }
      try {
        modelRoot.remove(child);
      } catch {
        /* ignore */
      }
    }
    modelRoot.add(object);

    // Precompute adjacency, face normals and create tangent + silhouette overlays
    if ((object as any).isMesh) {
      const mesh = object as THREE.Mesh;
      try {
        // Prepare a geometry suitable for indexing/analysis
        const analysisGeom = mesh.geometry as THREE.BufferGeometry;
        let indexedGeom: THREE.BufferGeometry;
        if (analysisGeom.index) {
          indexedGeom = analysisGeom.clone();
        } else {
          // mergeVertices produces an indexed geometry usable for adjacency
          indexedGeom = BufferGeometryUtils.mergeVertices(
            analysisGeom.clone(),
            1e-6,
          );
        }

        const posAttr = indexedGeom.getAttribute("position");
        const idx = indexedGeom.index ? indexedGeom.index.array : null;
        if (!posAttr || !idx) {
          // Can't build adjacency without indices
        } else {
          const positions = posAttr.array as ArrayLike<number>;
          const indexArr = idx as ArrayLike<number>;
          const faceCount = indexArr.length / 3;

          // face normals + centers (local space)
          const faceNormals: THREE.Vector3[] = new Array(faceCount);
          const faceCenters: THREE.Vector3[] = new Array(faceCount);
          for (let f = 0; f < faceCount; f++) {
            const i0 = indexArr[f * 3];
            const i1 = indexArr[f * 3 + 1];
            const i2 = indexArr[f * 3 + 2];
            const p0 = new THREE.Vector3(
              positions[i0 * 3],
              positions[i0 * 3 + 1],
              positions[i0 * 3 + 2],
            );
            const p1 = new THREE.Vector3(
              positions[i1 * 3],
              positions[i1 * 3 + 1],
              positions[i1 * 3 + 2],
            );
            const p2 = new THREE.Vector3(
              positions[i2 * 3],
              positions[i2 * 3 + 1],
              positions[i2 * 3 + 2],
            );
            const e1 = p1.clone().sub(p0);
            const e2 = p2.clone().sub(p0);
            const n = e1.clone().cross(e2).normalize();
            faceNormals[f] = n;
            faceCenters[f] = p0
              .clone()
              .add(p1)
              .add(p2)
              .multiplyScalar(1 / 3);
          }

          // Build undirected edge map -> adjacent faces
          const edgeMap = new Map<
            string,
            { a: number; b: number; faces: number[] }
          >();
          for (let f = 0; f < faceCount; f++) {
            const ia = indexArr[f * 3];
            const ib = indexArr[f * 3 + 1];
            const ic = indexArr[f * 3 + 2];
            const edges = [
              [ia, ib],
              [ib, ic],
              [ic, ia],
            ];
            for (const [v0, v1] of edges) {
              const a = Math.min(v0, v1);
              const b = Math.max(v0, v1);
              const key = `${a}_${b}`;
              const cur = edgeMap.get(key);
              if (!cur) edgeMap.set(key, { a, b, faces: [f] });
              else cur.faces.push(f);
            }
          }

          // Convert edgeMap to edge list with local endpoint positions and adjacent faces
          const edges: any[] = [];
          edgeMap.forEach((val) => {
            const aIdx = val.a;
            const bIdx = val.b;
            const aPos = new THREE.Vector3(
              positions[aIdx * 3],
              positions[aIdx * 3 + 1],
              positions[aIdx * 3 + 2],
            );
            const bPos = new THREE.Vector3(
              positions[bIdx * 3],
              positions[bIdx * 3 + 1],
              positions[bIdx * 3 + 2],
            );
            const f0 = val.faces[0];
            const f1 = val.faces.length > 1 ? val.faces[1] : undefined;
            edges.push({ aIdx, bIdx, aPos, bPos, f0, f1 });
          });

          // Determine planar-ish classification per face based on average neighbor normal deviation
          const planarEpsRad = THREE.MathUtils.degToRad(1.0); // ~1 degree threshold
          const neighborAngleSum: number[] = new Array(faceCount).fill(0);
          const neighborCount: number[] = new Array(faceCount).fill(0);
          // For each edge with two faces, accumulate neighbor angles
          edgeMap.forEach((val) => {
            if (val.faces.length < 2) return;
            const f0 = val.faces[0];
            const f1 = val.faces[1];
            const ang = faceNormals[f0].angleTo(faceNormals[f1]);
            neighborAngleSum[f0] += ang;
            neighborAngleSum[f1] += ang;
            neighborCount[f0] += 1;
            neighborCount[f1] += 1;
          });
          const planar: boolean[] = new Array(faceCount);
          for (let fi = 0; fi < faceCount; fi++) {
            const avg =
              neighborCount[fi] > 0
                ? neighborAngleSum[fi] / neighborCount[fi]
                : 0;
            planar[fi] = avg < planarEpsRad;
          }

          // Build tangent edges: emit edges where planar-ness differs across the edge
          // and the dihedral is small (< ~5 degrees)
          const tangentMin = 1e-6; // ignore exact-zero degenerate
          const tangentMax = THREE.MathUtils.degToRad(5.0);
          const tangentPositions: number[] = [];
          for (const e of edges) {
            if (e.f1 === undefined) continue; // ignore boundary for tangent overlay
            const f0 = e.f0;
            const f1 = e.f1;
            const dihedral = faceNormals[f0].angleTo(faceNormals[f1]);
            if (
              !!planar[f0] !== !!planar[f1] &&
              dihedral > tangentMin &&
              dihedral < tangentMax
            ) {
              tangentPositions.push(
                e.aPos.x,
                e.aPos.y,
                e.aPos.z,
                e.bPos.x,
                e.bPos.y,
                e.bPos.z,
              );
            }
          }

          // Create tangent LineSegments (static)
          let tangentObj: THREE.LineSegments | null = null;
          try {
            const tg = new THREE.BufferGeometry();
            if (tangentPositions.length > 0) {
              tg.setAttribute(
                "position",
                new THREE.Float32BufferAttribute(
                  new Float32Array(tangentPositions),
                  3,
                ),
              );
              tg.computeBoundingSphere();
            } else {
              tg.setAttribute(
                "position",
                new THREE.Float32BufferAttribute(new Float32Array(0), 3),
              );
            }
            const tmat = new THREE.LineBasicMaterial({
              color: 0x111111,
              transparent: true,
              opacity: 0.85,
              depthTest: true,
              depthWrite: false,
              polygonOffset: true,
              polygonOffsetFactor: -1,
              polygonOffsetUnits: 1,
            });
            tangentObj = new THREE.LineSegments(tg, tmat);
            tangentObj.frustumCulled = false;
            tangentObj.renderOrder = (mesh.renderOrder ?? 0) + 1;
            tangentObj.userData.__edgeOverlay = true;
            edgesGroup.add(tangentObj);
            edgePickables.push(tangentObj);
          } catch (e) {
            /* ignore tangent build errors */
          }

          // Create silhouette LineSegments (dynamic) with empty geom initially
          let silhouetteObj: THREE.LineSegments | null = null;
          try {
            const sg = new THREE.BufferGeometry();
            sg.setAttribute(
              "position",
              new THREE.Float32BufferAttribute(new Float32Array(0), 3),
            );
            const smat = new THREE.LineBasicMaterial({
              color: 0x000000,
              linewidth: 3.0,
              transparent: true,
              opacity: 1.0,
              depthTest: false,
              depthWrite: false,
              polygonOffset: true,
              polygonOffsetFactor: -1,
              polygonOffsetUnits: 1,
            });
            silhouetteObj = new THREE.LineSegments(sg, smat);
            silhouetteObj.frustumCulled = false;
            silhouetteObj.renderOrder = 10000;
            silhouetteObj.userData.__edgeOverlay = true;
            edgesGroup.add(silhouetteObj);
            edgePickables.push(silhouetteObj);
          } catch (e) {
            /* ignore silhouette build errors */
          }

          // Cache data for silhouette updates
          cadMeshData.set(mesh, {
            faceNormals,
            faceCenters,
            edges,
            silhouetteObj,
            tangentObj,
          });

          // Request an initial silhouette update
          requestUpdateSilhouette?.();
        }
      } catch (e) {
        /* ignore per-mesh analysis errors */
      }
    }

    // Place model so its bounding-box minimum corner sits at world origin (0,0,0)
    // Reset any translation on modelRoot, compute bounds, then shift by -box.min
    modelRoot.position.set(0, 0, 0);

    const box = new THREE.Box3().setFromObject(modelRoot);
    if (!box.isEmpty()) {
      // Translate so min corner moves to origin
      modelRoot.position.sub(box.min.clone());

      // Ensure matrices are up to date
      modelRoot.updateWorldMatrix(true, true);

      // Recompute bounds after translation
      const centeredBox = new THREE.Box3().setFromObject(modelRoot);
      modelBounds = { min: centeredBox.min.y, max: centeredBox.max.y };
      const centeredSize = centeredBox.getSize(new THREE.Vector3());
      modelDiagonal = centeredSize.length();
      setClipping(currentClippingValue); // Re-apply clipping to new material

      // Ensure controls target is at the center of the translated model
      const newCenter = centeredBox.getCenter(new THREE.Vector3());
      controls.target.copy(newCenter);
      controls.update();

      // Keep grid at y=0 (do not move it)
      if (gridHelper) gridHelper.position.y = 0;

      // Default fit with zoom=1 (internally uses padding 1.5)
      const padding = 1.5;
      fitCameraToBox(centeredBox, padding);
      // Create feature edges after the model has been positioned and matrices are up-to-date.
      modelRoot.updateWorldMatrix(true, true);
      // Build wireframe overlay for the primary mesh (separate overlay object)
      if ((object as any).isMesh) {
        try {
          buildWireframeOverlay(object as THREE.Mesh);
        } catch {
          /* ignore */
        }
      }
      rebuildFeatureEdges();
    } else {
      // No geometry: reset bounds
      modelBounds = { min: 0, max: 0 };
      modelDiagonal = 0;
      clearFeatureEdges();
      disposeWireframeOverlay();
    }
  }

  function clear() {
    clearFeatureEdges();
    disposeWireframeOverlay();
    modelRoot.clear();
    modelRoot.position.set(0, 0, 0);
  }

  function setView(
    preset: "top" | "front" | "right" | "iso" | "bottom" | "left" | "back",
  ) {
    const target = controls.target.clone();
    const dist = (activeCamera as any).position?.distanceTo?.(target) ?? 300;
    const up = new THREE.Vector3(0, 1, 0);
    switch (preset) {
      case "top":
        (activeCamera as THREE.PerspectiveCamera).position.copy(
          target.clone().add(new THREE.Vector3(0, dist, 0)),
        );
        break;
      case "bottom":
        (activeCamera as THREE.PerspectiveCamera).position.copy(
          target.clone().add(new THREE.Vector3(0, -dist, 0)),
        );
        break;
      case "front":
        (activeCamera as THREE.PerspectiveCamera).position.copy(
          target.clone().add(new THREE.Vector3(0, 0, dist)),
        );
        break;
      case "back":
        (activeCamera as THREE.PerspectiveCamera).position.copy(
          target.clone().add(new THREE.Vector3(0, 0, -dist)),
        );
        break;
      case "right":
        (activeCamera as THREE.PerspectiveCamera).position.copy(
          target.clone().add(new THREE.Vector3(dist, 0, 0)),
        );
        break;
      case "left":
        (activeCamera as THREE.PerspectiveCamera).position.copy(
          target.clone().add(new THREE.Vector3(-dist, 0, 0)),
        );
        break;
      case "iso":
      default:
        (activeCamera as THREE.PerspectiveCamera).position.copy(
          target.clone().add(new THREE.Vector3(dist, dist * 0.6, dist)),
        );
        break;
    }
    activeCamera.up.copy(up);
    (activeCamera as THREE.PerspectiveCamera).updateProjectionMatrix?.();
    // Do not call fitToScreen here — keep the exact direction set by the preset.
    // The user may call fitToScreen separately; controls should reflect new position.
    controls.update();
    requestUpdateSilhouette?.();
  }

  function setProjection(mode: "perspective" | "orthographic") {
    activeCamera = mode === "perspective" ? persp : ortho;
    requestUpdateSilhouette?.();
  }

  function resize() {
    const w = container.clientWidth;
    const h = container.clientHeight;
    renderer.setSize(w, h);
    const aspect = w / Math.max(1, h);
    persp.aspect = aspect;
    persp.updateProjectionMatrix();

    if (edgeHoverLineMaterial) {
      edgeHoverLineMaterial.resolution.set(w, h);
    }
    updateCubeSize();
  }

  function setControlsEnabled(enabled: boolean) {
    controls.enabled = !!enabled;
  }

  const render = () => {
    controls.update();
    const camAngle = lastCamQuat.angleTo(activeCamera.quaternion);
    const camPosDelta = lastCamPos.distanceTo(activeCamera.position);
    if (camAngle > camEpsilon || camPosDelta > camEpsilon) {
      lastCamQuat.copy(activeCamera.quaternion);
      lastCamPos.copy(activeCamera.position);
      silhouetteDirty = true;
    }
    if (silhouetteDirty) {
      requestUpdateSilhouette?.();
      silhouetteDirty = false;
    }
    updateMeasurementOverlay();
    renderer.render(scene, activeCamera);
    // Sync cube rotation to inverse of active camera
    try {
      const inv = activeCamera.quaternion.clone().invert();
      cubeRoot.quaternion.copy(inv);
    } catch (_e) {
      // ignore
    }
    cubeRenderer.render(cubeScene, cubeCamera);
  };
  renderer.setAnimationLoop(render);

  const onResize = () => resize();
  window.addEventListener("resize", onResize);
  render();

  function setMaterialProperties(
    colorHex: number,
    wireframe: boolean,
    xray: boolean,
  ) {
    modelRoot.traverse((child: any) => {
      if (!child || !child.material) return;
      // Skip feature-edge overlays explicitly
      if (child.userData && child.userData.__isFeatureEdge) return;
      if (child.userData && child.userData.__edgeOverlay) return;
      if (child.name === "featureEdges") return;

      // Only update mesh materials (do not touch line overlays)
      if (!child.isMesh) return;

      const apply = (mat: any) => {
        // 1) Only set color when supported
        if (mat && mat.color && typeof mat.color.setHex === "function") {
          mat.color.setHex(colorHex);
        }

        // 2) We do NOT enable triangle mesh wireframes here. A separate wireframe overlay
        // is used and toggled via the wireframeEnabled state.

        // 3) X-ray
        if (xray) {
          mat.transparent = true;
          mat.opacity = 0.3;
          mat.depthWrite = false;
          if (child.isMesh) mat.side = THREE.DoubleSide;
        } else {
          mat.transparent = false;
          mat.opacity = 1.0;
          mat.depthWrite = true;
          if (child.isMesh) mat.side = THREE.DoubleSide;
        }

        // 4) Ensure renderer notices updates (important for some materials)
        mat.needsUpdate = true;
      };

      if (Array.isArray(child.material)) {
        child.material.forEach(apply);
      } else {
        apply(child.material);
      }
    });

    // Toggle the wireframe overlay visibility according to flag
    try {
      wireframeEnabled = !!wireframe;
      if (wireframeLines) wireframeLines.visible = wireframeEnabled;
    } catch {}
  }

  function setClipping(value: number | null) {
    currentClippingValue = value;
    const planes =
      value !== null
        ? [
            new THREE.Plane(
              new THREE.Vector3(0, -1, 0),
              modelBounds.min + value * (modelBounds.max - modelBounds.min),
            ),
          ]
        : [];

    modelRoot.traverse((child: any) => {
      if (child.isMesh && child.material) {
        if (Array.isArray(child.material)) {
          child.material.forEach((m: any) => (m.clippingPlanes = planes));
        } else {
          child.material.clippingPlanes = planes;
        }
      }
    });

    if (value !== null && renderer.localClippingEnabled === false) {
      renderer.localClippingEnabled = true;
    }
  }

  function fitToScreen(zoom: number = 1) {
    if (modelRoot.children.length === 0) return;
    const box = new THREE.Box3().setFromObject(modelRoot);
    // Base padding 1.5 (generous).
    // userZoom > 1 means closer (smaller padding)
    // userZoom < 1 means further (larger padding)
    const padding = 1.5 / Math.max(0.1, zoom);
    fitCameraToBox(box, padding);
  }

  function setBackgroundColor(color: string | number) {
    renderer.setClearColor(color);
  }

  // Highlighting for DFM features
  let highlightMesh: THREE.Mesh | null = null;

  function setHighlight(
    triangles: number[] | null,
    location?: { x: number; y: number; z: number },
  ) {
    // Remove existing highlight
    if (highlightMesh) {
      if (highlightMesh.parent) {
        highlightMesh.parent.remove(highlightMesh);
      } else {
        scene.remove(highlightMesh);
      }
      highlightMesh.geometry.dispose();
      (highlightMesh.material as THREE.Material).dispose();
      highlightMesh = null;
    }

    if (!triangles || triangles.length === 0) return;

    // Find the main mesh in the model
    const mainMesh = modelRoot.children.find(
      (child): child is THREE.Mesh => (child as THREE.Mesh).isMesh,
    );

    if (!mainMesh || !mainMesh.geometry) return;

    const srcGeom = mainMesh.geometry;
    const posAttr = srcGeom.getAttribute("position");
    if (!posAttr) return;

    // Build highlight geometry from triangle indices
    const positions: number[] = [];
    for (const triIdx of triangles) {
      const i0 = triIdx * 3;
      const i1 = triIdx * 3 + 1;
      const i2 = triIdx * 3 + 2;

      // Get positions for the triangle vertices
      for (const idx of [i0, i1, i2]) {
        if (idx < posAttr.count) {
          positions.push(
            posAttr.getX(idx),
            posAttr.getY(idx),
            posAttr.getZ(idx),
          );
        }
      }
    }

    if (positions.length === 0) return;

    // Create highlight geometry
    const highlightGeom = new THREE.BufferGeometry();
    highlightGeom.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(positions, 3),
    );
    highlightGeom.computeVertexNormals();

    // Create highlight material (semi-transparent blue)
    const highlightMat = new THREE.MeshBasicMaterial({
      color: 0x3b82f6,
      transparent: true,
      opacity: 0.5,
      side: THREE.DoubleSide,
      depthTest: true,
      depthWrite: false,
    });

    highlightMesh = new THREE.Mesh(highlightGeom, highlightMat);

    // Add highlight as a child of the main mesh so it inherits transforms exactly
    highlightMesh.position.set(0, 0, 0);
    highlightMesh.rotation.set(0, 0, 0);
    highlightMesh.scale.set(1, 1, 1);
    mainMesh.add(highlightMesh);

    // If location is provided, animate camera to focus on it
    if (location) {
      const targetPos = new THREE.Vector3(location.x, location.y, location.z);
      const currentTarget = controls.target.clone();

      // Smooth transition to the feature
      const duration = 1000; // ms
      const startTime = Date.now();

      const animateCamera = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic

        controls.target.lerpVectors(currentTarget, targetPos, eased);
        controls.update();

        if (progress < 1) {
          requestAnimationFrame(animateCamera);
        }
      };

      animateCamera();
    }
  }

  function dispose() {
    window.removeEventListener("resize", onResize);
    try {
      clearEdgeHighlight();
    } catch {}
    try {
      setMeasurementSegment(null, null, null);
    } catch {}
    try {
      if (measureLine) {
        scene.remove(measureLine);
        measureLine = null;
      }
      if (measureLineGeometry) {
        measureLineGeometry.dispose();
        measureLineGeometry = null;
      }
      if (measureLabel) {
        scene.remove(measureLabel);
        if (measureLabel.material.map) {
          measureLabel.material.map.dispose();
        }
        measureLabel.material.dispose();
        measureLabel = null;
      }
      if (measureArrow1) {
        measureArrow1.parent?.remove(measureArrow1);
        measureArrow1 = null;
      }
      if (measureArrow2) {
        measureArrow2.parent?.remove(measureArrow2);
        measureArrow2 = null;
      }
      if (measureArrowBillboard) {
        scene.remove(measureArrowBillboard);
        measureArrowBillboard = null;
      }
      if (measureArrow1Geometry) {
        measureArrow1Geometry.dispose();
        measureArrow1Geometry = null;
      }
      if (measureArrow2Geometry) {
        measureArrow2Geometry.dispose();
        measureArrow2Geometry = null;
      }
      arrowMaterial.dispose();
      measureMaterial.dispose();
    } catch {}
    try {
      controls.removeEventListener("change", requestUpdateSilhouette as any);
    } catch {}
    if (silhouetteRAFId) {
      try {
        cancelAnimationFrame(silhouetteRAFId);
      } catch {}
      silhouetteRAFId = null;
    }
    // dispose feature edge overlays first
    try {
      clearFeatureEdges();
    } catch {
      /* ignore */
    }
    // dispose wireframe overlay if present
    try {
      disposeWireframeOverlay();
    } catch {
      /* ignore */
    }
    renderer.setAnimationLoop(null);
    renderer.dispose();
    try {
      container.removeChild(renderer.domElement);
    } catch {
      /* ignore */
    }
    try {
      cubeCanvas.removeEventListener("pointerdown", onCubePointerDown as any);
      cubeCanvas.removeEventListener("pointermove", onCubePointerMove as any);
      cubeCanvas.removeEventListener("pointerup", onCubePointerUp as any);
      cubeCanvas.removeEventListener(
        "pointercancel",
        onCubePointerCancel as any,
      );
      cubeCanvas.removeEventListener("click", onCubeClick as any);
    } catch {
      /* ignore */
    }
    cubeRenderer.dispose();
    // remove the whole wrapper (which contains the canvas)
    try {
      cubeWrapper.remove();
    } catch {
      /* ignore */
    }

    // dispose cube materials/geometry
    cubeRoot.traverse((obj: any) => {
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) {
        if (Array.isArray(obj.material)) {
          obj.material.forEach((mm: any) => {
            if (mm.map) mm.map.dispose();
            mm.dispose();
          });
        } else {
          if (obj.material.map) obj.material.map.dispose();
          obj.material.dispose();
        }
      }
    });

    // dispose modelRoot children (meshes, measurement graphics, highlights, etc.)
    try {
      modelRoot.traverse((obj: any) => {
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) {
          if (Array.isArray(obj.material)) {
            obj.material.forEach((m: any) => {
              if (m.map) m.map.dispose();
              m.dispose();
            });
          } else {
            if (obj.material.map) obj.material.map.dispose();
            obj.material.dispose();
          }
        }
      });
    } catch {
      /* ignore */
    }

    // dispose the environment resources we created
    try {
      pmremGenerator.dispose();
    } catch {
      /* ignore */
    }
    try {
      roomEnv.traverse((o: any) => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) {
          if (Array.isArray(o.material)) {
            o.material.forEach((m: any) => m.dispose());
          } else {
            if (o.material.map) o.material.map.dispose?.();
            o.material.dispose();
          }
        }
      });
    } catch {
      /* ignore */
    }
  }

  return {
    loadMeshFromGeometry,
    clear,
    setView,
    setProjection,
    setFeatureEdgesEnabled,
    resize,
    dispose,
    pickAtScreenPosition,
    pickEdgeAtScreenPosition,
    highlightEdgeAtScreenPosition,
    clearEdgeHighlight,
    measureEdgeAtScreenPosition,
    setMeasurementSegment,
    setMeasurementGraphicsScale,
    getScreenshotDataURL,
    getOutlineSnapshotDataURL,
    setMaterialProperties,
    setClipping,
    fitToScreen,
    setHighlight,
    setBackgroundColor,
    setControlsEnabled,
    setShowViewCube: (visible: boolean) => {
      cubeWrapper.style.display = visible ? "block" : "none";
    },
  };
}
