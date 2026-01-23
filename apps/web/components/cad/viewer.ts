import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

export type Viewer = {
  loadMeshFromGeometry: (geom: THREE.BufferGeometry) => void;
  clear: () => void;
  setView: (
    preset: "top" | "front" | "right" | "iso" | "bottom" | "left" | "back",
  ) => void;
  setProjection: (mode: "perspective" | "orthographic") => void;
  resize: () => void;
  dispose: () => void;
  pickAtScreenPosition: (ndcX: number, ndcY: number) => THREE.Vector3 | null;
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

export function createViewer(container: HTMLElement): Viewer {
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
  renderer.setClearColor(0xffffff);
  renderer.localClippingEnabled = true;
  container.appendChild(renderer.domElement);
  // Ensure container can host absolutely positioned overlays (view cube)
  try {
    const computed = window.getComputedStyle(container);
    if (!computed || computed.position === "static") {
      container.style.position = "relative";
    }
  } catch (e) {
    // ignore (server-side or testing)
  }

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

  // pointerdown handler (was missing) — prevent events from falling through to main canvas
  function onCubePointerDown(e: PointerEvent) {
    try {
      // capture pointer if available
      (e.target as Element)?.setPointerCapture?.(e.pointerId);
    } catch (err) {
      // ignore
    }
    e.preventDefault();
    e.stopPropagation();
  }

  // attach pointer listeners directly to the canvas (non-passive pointermove)
  cubeCanvas.addEventListener("pointermove", onCubePointerMove as any);
  cubeCanvas.addEventListener("pointerdown", onCubePointerDown as any, {
    passive: false,
  });
  cubeCanvas.addEventListener("click", onCubeClick as any);

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
    } catch (e) {}
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

  triad.add(makeAxis(new THREE.Vector3(1, 0, 0), triMaterialX));
  triad.add(makeAxis(new THREE.Vector3(0, 1, 0), triMaterialY));
  triad.add(makeAxis(new THREE.Vector3(0, 0, 1), triMaterialZ));
  // position triad origin at the cube corner (parented to cubeRoot so it rotates with the cube)
  triad.position.copy(cornerOffset);
  cubeRoot.add(triad);

  const cubeRaycaster = new THREE.Raycaster();
  const cubePointer = new THREE.Vector2();
  let hoveredFaceIndex: number | null = null;

  function updateCubeSize() {
    const cssW = cubeCanvas.clientWidth || cubeSizePx;
    const cssH = cubeCanvas.clientHeight || cubeSizePx;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    cubeRenderer.setPixelRatio(dpr);
    cubeRenderer.setSize(cssW, cssH, false);
  }

  updateCubeSize();

  // Highlight multiple faces at once (supports edges/corners)
  function highlightFaces(indices: number[] | null) {
    // reset all faces
    for (let i = 0; i < faceMaterials.length; i++) {
      (faceMaterials[i] as THREE.MeshBasicMaterial).color.setHex(baseFaceColor);
    }
    if (!indices || indices.length === 0) {
      hoveredFaceIndex = null;
      return;
    }
    // Apply highlight color to requested indices
    for (const idx of indices) {
      if (faceMaterials[idx]) {
        (faceMaterials[idx] as THREE.MeshBasicMaterial).color.setHex(0xdbeafe); // light blue
      }
    }
    hoveredFaceIndex = indices[0] ?? null;
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

  function onCubePointerMove(e: PointerEvent) {
    const rect = cubeCanvas.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    cubePointer.set(x, y);
    cubeRaycaster.setFromCamera(cubePointer, cubeCamera);
    const intersects = cubeRaycaster.intersectObject(cubeMesh, false);

    if (intersects.length === 0) {
      highlightFaces(null);
      cubeCanvas.style.cursor = "default";
      e.stopPropagation();
      return;
    }

    const intr = intersects[0] as any;
    const faceIndex = intr.face?.materialIndex ?? 0;

    // classify hover region using local cube coords
    const pLocal = cubeRoot.worldToLocal(intr.point.clone());
    const halfSize = half; // half defined earlier
    const nx = pLocal.x / Math.max(1e-6, halfSize);
    const ny = pLocal.y / Math.max(1e-6, halfSize);
    const nz = pLocal.z / Math.max(1e-6, halfSize);

    const EDGE_THRESH_HOVER = 0.7; // easier hover targeting
    const nearX = Math.abs(nx) > EDGE_THRESH_HOVER;
    const nearY = Math.abs(ny) > EDGE_THRESH_HOVER;
    const nearZ = Math.abs(nz) > EDGE_THRESH_HOVER;
    const nearCount = (nearX ? 1 : 0) + (nearY ? 1 : 0) + (nearZ ? 1 : 0);

    cubeCanvas.style.cursor = "pointer";

    if (nearCount === 3) {
      // corner: highlight three faces based on sign
      const ix = nx >= 0 ? X_POS : X_NEG;
      const iy = ny >= 0 ? Y_POS : Y_NEG;
      const iz = nz >= 0 ? Z_POS : Z_NEG;
      highlightFaces([ix, iy, iz]);
    } else if (nearCount === 2) {
      // edge: highlight the two near faces
      const faces: number[] = [];
      if (nearX) faces.push(nx >= 0 ? X_POS : X_NEG);
      if (nearY) faces.push(ny >= 0 ? Y_POS : Y_NEG);
      if (nearZ) faces.push(nz >= 0 ? Z_POS : Z_NEG);
      highlightFaces(faces);
    } else {
      // face center
      highlightFaces([faceIndex]);
    }

    e.stopPropagation();
  }

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
    // click handler (no debug logging)
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

  // --- end view cube overlay ---

  const scene = new THREE.Scene();

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

  const controls = new OrbitControls(persp, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.1;

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
  scene.add(modelRoot);

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();

  const measureMaterial = new THREE.LineBasicMaterial({
    color: 0x000000,
    depthTest: false,
    depthWrite: false,
  });
  let measureLine: THREE.Line | null = null;
  let measureLabel: THREE.Sprite | null = null;

  const arrowMaterial = new THREE.MeshBasicMaterial({
    color: 0x000000,
    side: THREE.DoubleSide,
    depthTest: false,
    depthWrite: false,
  });
  let measureArrow1: THREE.Mesh | null = null;
  let measureArrow2: THREE.Mesh | null = null;
  let measureGraphicsScale = 1;

  let modelBounds = { min: 0, max: 0 };
  let currentClippingValue: number | null = null;

  function setOverlayVisible(visible: boolean) {
    if (gridHelper) gridHelper.visible = visible;
    if (axesHelper) axesHelper.visible = visible;
  }

  function setMeasurementGraphicsScale(scale: number) {
    measureGraphicsScale = Math.max(0.1, Math.min(scale, 4));
    if (measureLabel) {
      const baseLabelScale = 0.4;
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
    if (modelRoot.children.length === 0) return null;

    pointer.set(ndcX, ndcY);
    raycaster.setFromCamera(pointer, activeCamera);
    const intersects = raycaster.intersectObjects(modelRoot.children, true);

    if (intersects.length === 0) return null;
    return intersects[0].point.clone();
  }

  function setMeasurementSegment(
    p1: THREE.Vector3 | null,
    p2: THREE.Vector3 | null,
    labelText?: string | null,
  ) {
    if (p1 === null || p2 === null) {
      if (measureLine) {
        scene.remove(measureLine);
        measureLine.geometry.dispose();
        measureLine = null;
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
        scene.remove(measureArrow1);
        measureArrow1.geometry.dispose();
        if (Array.isArray(measureArrow1.material)) {
          measureArrow1.material.forEach((m) => m.dispose());
        } else {
          measureArrow1.material.dispose();
        }
        measureArrow1 = null;
      }
      if (measureArrow2) {
        scene.remove(measureArrow2);
        measureArrow2.geometry.dispose();
        if (Array.isArray(measureArrow2.material)) {
          measureArrow2.material.forEach((m) => m.dispose());
        } else {
          measureArrow2.material.dispose();
        }
        measureArrow2 = null;
      }
      return;
    }

    const dir = new THREE.Vector3().subVectors(p2, p1);
    const len = dir.length();
    if (len === 0) {
      if (measureLine) {
        scene.remove(measureLine);
        measureLine.geometry.dispose();
        measureLine = null;
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
        scene.remove(measureArrow1);
        measureArrow1.geometry.dispose();
        if (Array.isArray(measureArrow1.material)) {
          measureArrow1.material.forEach((m) => m.dispose());
        } else {
          measureArrow1.material.dispose();
        }
        measureArrow1 = null;
      }
      if (measureArrow2) {
        scene.remove(measureArrow2);
        measureArrow2.geometry.dispose();
        if (Array.isArray(measureArrow2.material)) {
          measureArrow2.material.forEach((m) => m.dispose());
        } else {
          measureArrow2.material.dispose();
        }
        measureArrow2 = null;
      }
      return;
    }
    dir.normalize();

    // Offset dimension graphics slightly toward the camera to act as an overlay
    const mid = new THREE.Vector3().addVectors(p1, p2).multiplyScalar(0.5);
    const viewDir = new THREE.Vector3()
      .subVectors(activeCamera.position, mid)
      .normalize();
    const overlayOffset = viewDir
      .clone()
      .multiplyScalar(len * 0.02 + 2 * measureGraphicsScale);
    const p1o = p1.clone().add(overlayOffset);
    const p2o = p2.clone().add(overlayOffset);

    const linePoints = [p1o.clone(), p2o.clone()];
    const lineGeom = new THREE.BufferGeometry().setFromPoints(linePoints);
    if (measureLine) {
      measureLine.geometry.dispose();
      measureLine.geometry = lineGeom;
    } else {
      measureLine = new THREE.Line(lineGeom, measureMaterial);
      measureLine.renderOrder = 999;
      scene.add(measureLine);
    }
    if (measureLine) measureLine.renderOrder = 999;

    const up = new THREE.Vector3(0, 1, 0);
    if (Math.abs(dir.dot(up)) > 0.9) {
      up.set(1, 0, 0);
    }
    const side = new THREE.Vector3().crossVectors(dir, up).normalize();

    // Arrow dimensions
    const arrowLength = Math.max(len * 0.07, 5 * measureGraphicsScale);
    const arrowHalfWidth = arrowLength * 0.4;

    // Arrow at p1 (filled triangle)
    const tip1 = p1o.clone();
    const base1 = p1o.clone().add(dir.clone().multiplyScalar(arrowLength));
    const wing1a = base1
      .clone()
      .add(side.clone().multiplyScalar(arrowHalfWidth));
    const wing1b = base1
      .clone()
      .sub(side.clone().multiplyScalar(arrowHalfWidth));

    const positions1 = new Float32Array([
      tip1.x,
      tip1.y,
      tip1.z,
      wing1a.x,
      wing1a.y,
      wing1a.z,
      wing1b.x,
      wing1b.y,
      wing1b.z,
    ]);
    const arrowGeom1 = new THREE.BufferGeometry();
    arrowGeom1.setAttribute(
      "position",
      new THREE.BufferAttribute(positions1, 3),
    );
    arrowGeom1.setIndex([0, 1, 2]);

    // Arrow at p2 (filled triangle)
    const tip2 = p2o.clone();
    const base2 = p2o.clone().add(dir.clone().multiplyScalar(-arrowLength));
    const wing2a = base2
      .clone()
      .add(side.clone().multiplyScalar(arrowHalfWidth));
    const wing2b = base2
      .clone()
      .sub(side.clone().multiplyScalar(arrowHalfWidth));

    const positions2 = new Float32Array([
      tip2.x,
      tip2.y,
      tip2.z,
      wing2a.x,
      wing2a.y,
      wing2a.z,
      wing2b.x,
      wing2b.y,
      wing2b.z,
    ]);
    const arrowGeom2 = new THREE.BufferGeometry();
    arrowGeom2.setAttribute(
      "position",
      new THREE.BufferAttribute(positions2, 3),
    );
    arrowGeom2.setIndex([0, 1, 2]);

    if (measureArrow1) {
      measureArrow1.geometry.dispose();
      measureArrow1.geometry = arrowGeom1;
    } else {
      measureArrow1 = new THREE.Mesh(arrowGeom1, arrowMaterial);
      measureArrow1.renderOrder = 999;
      scene.add(measureArrow1);
    }
    if (measureArrow1) measureArrow1.renderOrder = 999;

    if (measureArrow2) {
      measureArrow2.geometry.dispose();
      measureArrow2.geometry = arrowGeom2;
    } else {
      measureArrow2 = new THREE.Mesh(arrowGeom2, arrowMaterial);
      measureArrow2.renderOrder = 999;
      scene.add(measureArrow2);
    }
    if (measureArrow2) measureArrow2.renderOrder = 999;

    const midOffset = new THREE.Vector3()
      .addVectors(p1o, p2o)
      .multiplyScalar(0.5);
    const offsetDir = new THREE.Vector3(0, 1, 0);
    if (Math.abs(dir.dot(offsetDir)) > 0.9) {
      offsetDir.set(1, 0, 0);
    }
    offsetDir.normalize();
    const offsetAmount = Math.max(len * 0.03, 5 * measureGraphicsScale);
    const labelPos = midOffset.add(offsetDir.multiplyScalar(offsetAmount));

    if (labelText == null) {
      if (measureLabel) {
        scene.remove(measureLabel);
        if (measureLabel.material.map) {
          measureLabel.material.map.dispose();
        }
        measureLabel.material.dispose();
        measureLabel = null;
      }
      return;
    }

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (ctx) {
      const fontSize = 32;
      ctx.font = `${fontSize}px sans-serif`;
      const text = labelText;
      const textWidth = ctx.measureText(text).width;
      canvas.width = textWidth + 20;
      canvas.height = fontSize + 20;
      ctx.font = `${fontSize}px sans-serif`;
      ctx.fillStyle = "black";
      ctx.strokeStyle = "white";
      ctx.lineWidth = 4;
      ctx.strokeText(text, 10, fontSize);
      ctx.fillText(text, 10, fontSize);
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

    if (measureLabel) measureLabel.renderOrder = 1000;

    measureLabel.position.copy(labelPos);
    const baseLabelScale = 0.4; // was 0.8; smaller by default
    measureLabel.scale.set(
      baseLabelScale * measureGraphicsScale,
      0.2 * measureGraphicsScale,
      1,
    );
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
      edges.applyMatrix4(obj.matrixWorld);
      edgesGroup.add(edges);
    });

    scene.add(edgesGroup);

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

    modelRoot.visible = prevModelVisible;
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
    // 1) Ensure normals
    if (!geom.getAttribute("normal")) geom.computeVertexNormals();
    // 2) Recenter geometry at origin
    geom.computeBoundingBox();
    const gbox = geom.boundingBox!.clone();
    const gcenter = gbox.getCenter(new THREE.Vector3());
    geom.translate(-gcenter.x, -gcenter.y, -gcenter.z);

    // 3) Create mesh and add to scene
    const material = new THREE.MeshStandardMaterial({
      color: 0xb8c2ff,
      metalness: 0.1,
      roughness: 0.8,
    });
    const mesh = new THREE.Mesh(geom, material);
    modelRoot.clear();
    modelRoot.add(mesh);

    // 4) Ground the model: lift so bottom sits on y = 0
    mesh.updateWorldMatrix(true, true);
    const box1 = new THREE.Box3().setFromObject(modelRoot);
    const lift = -box1.min.y;
    if (Math.abs(lift) > 1e-6) {
      modelRoot.position.y += lift;
      modelRoot.updateWorldMatrix(true, true);
    }

    // Update Bounds for clipping
    const finalBox = new THREE.Box3().setFromObject(modelRoot);
    modelBounds = { min: finalBox.min.y, max: finalBox.max.y };
    setClipping(currentClippingValue); // Re-apply clipping to new material

    // 5) Fit camera to final bounds
    // We defer the precise camera fit to the consumer or do a default one here.
    // But since the consumer might want to apply custom zoom immediately,
    // we can do a default fit here (zoom=1) to ensure something is visible.
    if (gridHelper) gridHelper.position.y = 0;

    // Default fit with zoom=1 (internally uses padding 1.5)
    const padding = 1.5;
    fitCameraToBox(finalBox, padding);
  }

  function clear() {
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
  }

  function setProjection(mode: "perspective" | "orthographic") {
    activeCamera = mode === "perspective" ? persp : ortho;
  }

  function resize() {
    const w = container.clientWidth;
    const h = container.clientHeight;
    renderer.setSize(w, h);
    const aspect = w / Math.max(1, h);
    persp.aspect = aspect;
    persp.updateProjectionMatrix();
    updateCubeSize();
  }

  const render = () => {
    controls.update();
    renderer.render(scene, activeCamera);
    // Sync cube rotation to inverse of active camera
    try {
      const inv = activeCamera.quaternion.clone().invert();
      cubeRoot.quaternion.copy(inv);
    } catch (e) {
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
      if (child.isMesh && child.material) {
        const updateMaterial = (m: any) => {
          m.color.setHex(colorHex);
          m.wireframe = wireframe;
          if (xray) {
            m.transparent = true;
            m.opacity = 0.3;
            m.depthWrite = false;
            m.side = THREE.DoubleSide;
          } else {
            m.transparent = false;
            m.opacity = 1.0;
            m.depthWrite = true;
            m.side = THREE.DoubleSide; // Keep DoubleSide or revert to FrontSide? Usually DoubleSide is safer for open meshes. StandardMaterial default is FrontSide.
          }
        };

        if (Array.isArray(child.material)) {
          child.material.forEach(updateMaterial);
        } else {
          updateMaterial(child.material);
        }
      }
    });
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
      scene.remove(highlightMesh);
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
    highlightMesh.position.copy(mainMesh.position);
    highlightMesh.rotation.copy(mainMesh.rotation);
    highlightMesh.scale.copy(mainMesh.scale);
    scene.add(highlightMesh);

    // If location is provided, animate camera to focus on it
    if (location) {
      const targetPos = new THREE.Vector3(location.x, location.y, location.z);
      const currentTarget = controls.target.clone();
      const targetDistance = activeCamera.position.distanceTo(targetPos);

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
    renderer.setAnimationLoop(null);
    renderer.dispose();
    container.removeChild(renderer.domElement);
    try {
      cubeCanvas.removeEventListener("pointermove", onCubePointerMove as any);
      cubeCanvas.removeEventListener("click", onCubeClick as any);
      cubeCanvas.removeEventListener("pointerdown", onCubePointerDown as any);
    } catch (e) {}
    cubeRenderer.dispose();
    // remove the whole wrapper (which contains the canvas)
    try {
      cubeWrapper.remove();
    } catch (e) {}
    // dispose cube materials/geometry by traversing cubeRoot
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
  }

  return {
    loadMeshFromGeometry,
    clear,
    setView,
    setProjection,
    resize,
    dispose,
    pickAtScreenPosition,
    setMeasurementSegment,
    setMeasurementGraphicsScale,
    getScreenshotDataURL,
    getOutlineSnapshotDataURL,
    setMaterialProperties,
    setClipping,
    fitToScreen,
    setHighlight,
    setBackgroundColor,
    setShowViewCube: (visible: boolean) => {
      cubeWrapper.style.display = visible ? "block" : "none";
    },
  };
}
