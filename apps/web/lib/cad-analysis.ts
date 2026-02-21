/**
 * Real CAD Analysis Utilities
 * Extracts geometry data from CAD files for pricing calculations
 */

import {
  analyzeGeometryFeatures,
  type GeometryFeatureMap,
} from "./geometry-feature-locator";
import * as THREE from "three";

/** Shared severity / risk level */
export type RiskLevel = "low" | "medium" | "high";

/** Shared complexity level */
export type ComplexityLevel = "simple" | "moderate" | "complex";
export type ToleranceLevel = "standard" | "precision" | "tight";
export type ThreadType = "metric" | "imperial" | "custom";

export interface AdvancedFeatures {
  // CNC Features
  undercuts: {
    count: number;
    severity: "minor" | "moderate" | "severe";
    requires5Axis: boolean;
  };
  holes: {
    count: number;
    throughHoles: number;
    blindHoles: number;
    tappedHoles: number;
    reamedHoles: number;
    countersunkHoles: number;
    counterboredHoles: number;
    avgDiameter: number; // mm
    minDiameter: number; // mm
    maxDiameter: number; // mm
    deepHoleCount: number; // depth > 5x diameter
    microHoleCount: number; // diameter < 1mm
    avgDepthRatio: number; // depth/diameter
    drillingMethod:
      | "standard-drill"
      | "deep-hole-drill"
      | "gun-drill"
      | "boring";
    toolAccessIssues: number; // holes with restricted access
  };
  pockets: {
    count: number;
    openPockets: number; // connected to edge
    closedPockets: number; // island pockets
    deepPockets: number; // depth > 3x width
    avgDepth: number; // mm
    maxAspectRatio: number; // depth/width
    minCornerRadius: number; // mm
    sharpCornersCount: number; // radius < tool radius
    requiresSquareEndmill: boolean;
    requiresBallEndmill: boolean;
  };
  bosses: {
    count: number;
    avgHeight: number; // mm
    maxAspectRatio: number; // height/diameter
    requiresThreading: boolean;
    requiresReaming: boolean;
  };
  ribs: {
    count: number;
    avgThickness: number; // mm
    minThickness: number; // mm
    thinRibCount: number; // thickness < 1.5mm
    deflectionRisk: RiskLevel;
  };
  threads: {
    count: number;
    internalThreads: number;
    externalThreads: number;
    specifications: {
      type: ThreadType;
      size: string;
      count: number;
    }[];
    avgDiameter: number; // mm
    requiresTapping: boolean;
    requiresThreadMilling: boolean;
    singlePointThreading: boolean; // for turning
  };
  fillets: {
    count: number;
    avgRadius: number; // mm
    minRadius: number; // mm
    missingFilletCount: number; // sharp internal corners
    stressConcentrationRisk: number; // 0-10 scale
    blendRadiusCount: number; // variable radius fillets
  };
  chamfers: {
    count: number;
    avgSize: number; // mm
    deburringRequired: boolean;
  };
  thinWalls: {
    count: number;
    minThickness: number; // mm
    avgThickness: number; // mm
    risk: RiskLevel; // deflection risk
    requiresSupportFixture: boolean;
  };
  toolAccess: {
    restrictedAreas: number;
    requiresIndexing: boolean;
    requiresMultiAxisMachining: boolean;
    estimatedSetupCount: number;
    axisCounts: { "3-axis": number; "4-axis": number; "5-axis": number };
    specialFixturingNeeded: boolean;
  };
  surfaceFinish: {
    estimatedRa: number; // μm (micrometers)
    criticalSurfaces: number; // surfaces requiring <1.6 μm
    requiresPolishing: boolean;
    requiresHoning: boolean;
  };
}

export interface ToleranceFeasibility {
  isAchievable: boolean;
  requiredProcess:
    | "standard-cnc"
    | "precision-cnc"
    | "grinding"
    | "manual-inspection"
    | "edm"
    | "lapping";
  estimatedCapability: number; // Cpk value
  concerns: string[];
  recommendations: string[];
  additionalCost: number; // USD additional cost for tight tolerances
  processCapabilities: {
    milling: { min: number; typical: number; max: number }; // mm tolerance ranges
    turning: { min: number; typical: number; max: number };
    grinding: { min: number; typical: number; max: number };
    edm: { min: number; typical: number; max: number };
  };
  materialFactor: number; // 1.0 = aluminum baseline, >1.0 = harder materials need looser tolerances
  featureSpecificTolerances: {
    holes: { achievable: number; recommended: number; cost: number }; // mm
    flatSurfaces: { achievable: number; recommended: number; cost: number };
    threads: { achievable: number; recommended: number; cost: number };
    pockets: { achievable: number; recommended: number; cost: number };
  };
  gdtSupport?: {
    flatness?: { achievable: number; cost: number }; // mm over area
    perpendicularity?: { achievable: number; cost: number }; // mm
    position?: { achievable: number; cost: number }; // mm true position
    concentricity?: { achievable: number; cost: number }; // mm
    surfaceFinish?: { achievable: number; cost: number }; // Ra μm
  };
  toleranceStackup?: {
    critical: boolean;
    chainLength: number; // number of chained dimensions
    worstCase: number; // mm accumulated tolerance
    statistical: number; // RSS method
    recommendation: string;
  };
}

export interface SecondaryOperation {
  type:
    | "heat-treatment"
    | "plating"
    | "welding"
    | "coating"
    | "threading"
    | "grinding";
  required: boolean;
  cost: number; // USD
  leadTimeAddition: number; // days
  description: string;
}

export interface SheetMetalFeatures {
  // Basic Geometry
  thickness: number; // mm
  flatArea: number; // mm²
  developedLength: number; // total flat pattern perimeter
  perimeterLength: number; // mm

  // Bending Features
  bendCount: number;
  bendAngles: number[]; // degrees
  minBendRadius: number; // mm
  maxBendRadius: number; // mm
  hasSharptBends: boolean; // bends < 1.5x thickness

  // Cutting Features
  holeCount: number;
  totalHoleDiameter: number; // mm (sum of all hole perimeters)
  cornerCount: number;
  complexCuts: number; // curves, notches, etc.
  straightCutLength: number; // mm
  curvedCutLength: number; // mm

  bends?: any;
  notches?: any;
  flanges?: any;
  // Forming Features
  hasHems: boolean;
  hasCountersinks: boolean;
  hasLouvers: boolean;
  hasEmbossments: boolean;
  hasLances: boolean;
  flangeCount: number;

  // Manufacturing Complexity
  hasSmallFeatures: boolean; // features < 2mm
  hasTightTolerance: boolean; // < ±0.1mm required
  requiresMultipleSetups: boolean;
  nestingEfficiency: number; // 0-1, estimated material utilization

  // Process Detection
  recommendedCuttingMethod:
    | "laser"
    | "plasma"
    | "waterjet"
    | "turret-punch"
    | "combined";
  recommendedBendingMethod: "press-brake" | "panel-bender" | "roll-forming";
  estimatedCuttingTime: number; // minutes
  estimatedFormingTime: number; // minutes

  // Part Classification
  partType:
    | "flat-pattern"
    | "simple-enclosure"
    | "complex-enclosure"
    | "bracket"
    | "panel"
    | "chassis"
    | "housing"
    | "cabinet";
  complexity: ComplexityLevel | "very-complex";
}

// === ADVANCED MANUFACTURING ANALYSIS TYPES ===

/** Surface finish grade classification */
export type SurfaceFinishGrade = 'rough' | 'standard' | 'fine' | 'precision' | 'polished' | 'ground' | 'mirror';

/** Surface finish analysis from backend */
export interface SurfaceFinishAnalysis {
  dominantGrade: SurfaceFinishGrade;
  minRaRequired: number; // μm Ra
  minRzEstimated: number; // μm Rz (≈5×Ra)
  precisionFaceCount: number;
  polishedFaceCount: number;
  groundFaceCount: number;
  totalPrecisionAreaMm2: number;
  finishComplexityScore: number; // 0-100
  features?: Array<{
    grade: SurfaceFinishGrade;
    estimatedRa: number;
    estimatedRz: number;
    faceAreaMm2: number;
    faceType: string;
    isMatingSurface: boolean;
    requiresGrinding: boolean;
    requiresPolishing: boolean;
  }>;
}

/** Parting line info for casting analysis */
export interface PartingLineInfo {
  zLevel: number;
  complexity: number; // 0-100
  isPlanar: boolean;
  confidence: number; // 0-1
}

/** Complete casting analysis from backend */
export interface CastingAnalysis {
  isLikelyCasting: boolean;
  castingType: string; // 'die_casting' | 'sand_casting' | 'investment_casting' | 'injection_molding' | 'not_castable'
  optimalPartingZ?: number;
  draftCompliantFaces: number;
  draftInsufficientFaces: number;
  averageDraftDeg: number;
  minDraftDeg: number;
  hasUndercuts: boolean;
  undercutCount: number;
  ejectorDifficulty: string; // 'easy' | 'moderate' | 'difficult'
  confidence: number; // 0-1
  partingLines?: PartingLineInfo[];
}

/** Machine type classification */
export type MachineType = 
  | 'lathe_2axis' | 'lathe_live' | 'turn_mill'
  | 'mill_3axis' | 'mill_4axis' | 'mill_5axis'
  | 'swiss_lathe' | 'multi_spindle'
  | 'edm_wire' | 'edm_sinker' | 'grinding';

/** Milling complexity details */
export interface MillingComplexityDetail {
  minAxesRequired: number;
  hasDeepPockets: boolean;
  hasUndercuts: boolean;
  hasCompoundAngles: boolean;
  accessDirectionCount: number;
  maxToolLengthMm: number;
}

/** Turning analysis details */
export interface TurningAnalysisDetail {
  isRotationallySymmetric: boolean;
  symmetryAxis?: string;
  hasCrossHoles: boolean;
  crossHoleCount: number;
  hasFlats: boolean;
  hasThreads: boolean;
  requiresTailstock: boolean;
}

/** Setup requirement */
export interface SetupRequirement {
  setupNumber: number;
  orientation: string;
  requiresSpecialFixture: boolean;
}

/** Complete machining complexity analysis from backend */
export interface MachiningComplexityAnalysis {
  primaryProcess: string;
  secondaryProcess?: string;
  recommendedMachine: string; // MachineType values
  estimatedSetupCount: number;
  complexityScore: number; // 0-100
  requires5Axis: boolean;
  requires4Axis: boolean;
  isTurnMill: boolean;
  requiresEdm: boolean;
  milling?: MillingComplexityDetail;
  turning?: TurningAnalysisDetail;
  setups?: SetupRequirement[];
}

export interface GeometryData {
  volume: number; // mm³
  surfaceArea: number; // mm²
  boundingBox: {
    x: number;
    y: number;
    z: number;
  };
  complexity: ComplexityLevel;
  estimatedMachiningTime: number; // minutes
  materialWeight: number; // grams
  recommendedProcess:
    | "cnc-milling"
    | "cnc-turning"
    | "sheet-metal"
    | "injection-molding"
    | "manual-quote";
  processConfidence: number; // 0-1, confidence in the recommendation
  processReasoning?: string; // Explanation for process recommendation
  sheetMetalScore?: number; // 0-100, likelihood of being sheet metal
  isAssembly?: boolean;
  assemblyInfo?: any;
  requiresManualQuote?: boolean;
  manualQuoteReason?: string;

  // === CLASSIFICATION METADATA (from backend cascade) ===
  needsReview?: boolean; // True when classification confidence < 0.70
  classificationMethod?: string; // Which tier resolved the classification (e.g., "face_classification", "bend_detection")
  machiningFeatureScore?: number; // 0-100, CNC machining signal from detected features
  faceClassification?: {
    histogram?: Record<string, number>;
    cnc_score?: number;
    sheet_metal_score?: number;
    dominant_type?: string;
    paired_plane_count?: number;
    dominant_pair_thickness?: number;
    reasoning?: string[];
  };

  // ENTERPRISE-LEVEL: Advanced thickness detection metadata
  detectedWallThickness?: number; // mm - actual material thickness from ray-casting (not bbox)
  thicknessConfidence?: number; // 0-1, confidence in thickness detection
  thicknessDetectionMethod?:
    | "bbox_approximation"
    | "ray_casting_statistical"
    | "backend_analysis";
  thicknessWarning?: string; // Warning if bbox approximation used for bent sheet metal

  partCharacteristics: {
    isRotationalSymmetric: boolean;
    isThinWalled: boolean;
    hasCurvedSurfaces: boolean;
    hasComplexFeatures: boolean;
    aspectRatio: number;
  };
  features: string[]; // Semantic feature tags (e.g., 'thin-wall', 'high-stress')
  holes?: Array<{ diameter: number; depth: number; isThrough: boolean }>;
  pockets?: Array<{ width: number; depth: number; isOpen: boolean }>;
  sheetMetalFeatures?: SheetMetalFeatures; // Only present if recommendedProcess is 'sheet-metal'
  advancedFeatures: AdvancedFeatures; // Advanced feature detection for CNC
  toleranceFeasibility?: ToleranceFeasibility; // Populated when tolerance is specified
  recommendedSecondaryOps: SecondaryOperation[]; // Required or recommended secondary operations
  dfmIssues: {
    severity: "info" | "warning" | "critical";
    issue: string;
    recommendation: string;
    potentialSavings?: number; // USD
  }[];
  
  // === BACKEND DFM ANALYSIS METADATA ===
  dfmAnalysis?: {
    overallScore: number; // 0-100
    rating: "excellent" | "good" | "fair" | "poor" | "critical";
    isManufacturable: boolean;
    issueCount: number;
    recommendations: string[];
    costOptimizations: string[];
  };
  
  // === SHEET METAL SPECIFIC BACKEND DATA ===
  grainDirection?: {
    recommended: string;
    score: number;
    notes: string[];
  };
  nesting?: {
    partsPerSheet: number;
    utilizationPct: number;
    sheetSize: string;
  };
  
  // === ADDITIONAL BACKEND DATA ===
  validation?: Record<string, any>;
  complexityScore?: number; // Numeric complexity score (0-100)
  
  // === ADVANCED MANUFACTURING ANALYSIS ===
  surfaceFinishAnalysis?: SurfaceFinishAnalysis; // Backend surface finish Ra/Rz analysis
  castingAnalysis?: CastingAnalysis; // Casting feasibility with parting lines
  machiningComplexity?: MachiningComplexityAnalysis; // 5-axis/setup requirements
}

/**
 * Parse STL file and extract geometry data
 */
export async function analyzeSTLFile(file: File): Promise<GeometryData> {
  const buffer = await file.arrayBuffer();
  const dataView = new DataView(buffer);

  // Check if binary or ASCII STL
  const isBinary = buffer.byteLength > 84;

  if (isBinary) {
    return analyzeBinarySTL(dataView);
  } else {
    // For ASCII STL, we'll use a simplified approach
    const text = new TextDecoder().decode(buffer);
    return analyzeASCIISTL(text);
  }
}

/**
 * Parse triangle data from a binary STL DataView.
 * Returns geometry metrics: triangleCount, boundingBox, volume, surfaceArea.
 */
function parseBinarySTLTriangles(dataView: DataView): {
  triangleCount: number;
  boundingBox: { x: number; y: number; z: number };
  volume: number;
  surfaceArea: number;
} {
  const triangleCount = dataView.getUint32(80, true);

  let minX = Infinity,
    maxX = -Infinity;
  let minY = Infinity,
    maxY = -Infinity;
  let minZ = Infinity,
    maxZ = -Infinity;
  let volume = 0;
  let surfaceArea = 0;

  let offset = 84; // Skip header and triangle count

  for (let i = 0; i < triangleCount; i++) {
    // Skip normal vector
    offset += 12;

    // Read 3 vertices
    const vertices: [number, number, number][] = [];
    for (let v = 0; v < 3; v++) {
      const x = dataView.getFloat32(offset, true);
      const y = dataView.getFloat32(offset + 4, true);
      const z = dataView.getFloat32(offset + 8, true);
      vertices.push([x, y, z]);

      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
      minZ = Math.min(minZ, z);
      maxZ = Math.max(maxZ, z);

      offset += 12;
    }

    // Calculate triangle area
    const [v1, v2, v3] = vertices;
    const edge1 = [v2[0] - v1[0], v2[1] - v1[1], v2[2] - v1[2]];
    const edge2 = [v3[0] - v1[0], v3[1] - v1[1], v3[2] - v1[2]];

    // Cross product for area
    const cross = [
      edge1[1] * edge2[2] - edge1[2] * edge2[1],
      edge1[2] * edge2[0] - edge1[0] * edge2[2],
      edge1[0] * edge2[1] - edge1[1] * edge2[0],
    ];

    const area =
      0.5 *
      Math.hypot(cross[0], cross[1], cross[2]);
    surfaceArea += area;

    // Volume calculation using signed volume of tetrahedron
    const signedVolume =
      (v1[0] * (v2[1] * v3[2] - v2[2] * v3[1]) +
        v1[1] * (v2[2] * v3[0] - v2[0] * v3[2]) +
        v1[2] * (v2[0] * v3[1] - v2[1] * v3[0])) /
      6;
    volume += signedVolume;

    // Skip attribute byte count
    offset += 2;
  }

  volume = Math.abs(volume);

  const boundingBox = {
    x: maxX - minX,
    y: maxY - minY,
    z: maxZ - minZ,
  };

  return { triangleCount, boundingBox, volume, surfaceArea };
}

function _resolveComplexityLevel(score: number): ComplexityLevel {
  if (score >= 45) return "complex";
  if (score >= 20) return "moderate";
  return "simple";
}

/**
 * Calculate complexity score and level from geometric factors.
 */
function calculateComplexityScore(
  aspectRatio: number,
  svRatio: number,
  triangleCount: number,
): { score: number; level: ComplexityLevel } {
  let score = 0;

  // Aspect ratio factor
  if (aspectRatio > 10) score += 20;
  else if (aspectRatio > 5) score += 12;
  else if (aspectRatio > 3) score += 6;

  // Surface complexity (high S/V = thin features or complex surfaces)
  if (svRatio > 80) score += 25;
  else if (svRatio > 40) score += 15;
  else if (svRatio > 20) score += 8;

  // Mesh detail (triangle density indicates fine features)
  if (triangleCount > 15000) score += 20;
  else if (triangleCount > 8000) score += 12;
  else if (triangleCount > 3000) score += 6;

  const level = _resolveComplexityLevel(score);

  return { score, level };
}

/**
 * Attempt to build THREE.js geometry from binary STL data and analyze features.
 * Returns null if analysis fails.
 */
function analyzeRealGeometryFeatures(
  dataView: DataView,
  triangleCount: number,
): GeometryFeatureMap | null {
  try {
    // Create BufferGeometry from STL data for feature analysis
    const positions = new Float32Array(triangleCount * 9); // 3 vertices * 3 coords per triangle
    let posOffset = 84 + 12; // Skip header, triangle count, and first normal

    for (let i = 0; i < triangleCount; i++) {
      for (let v = 0; v < 3; v++) {
        const idx = i * 9 + v * 3;
        positions[idx] = dataView.getFloat32(posOffset, true);
        positions[idx + 1] = dataView.getFloat32(posOffset + 4, true);
        positions[idx + 2] = dataView.getFloat32(posOffset + 8, true);
        posOffset += 12;
      }
      posOffset += 14; // Skip next normal (12 bytes) + attribute count (2 bytes)
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.computeVertexNormals();

    // Analyze real geometry features
    const features = analyzeGeometryFeatures(geometry);
    console.log("Real geometry analysis complete:", {
      holes: features.holes.length,
      pockets: features.pockets.length,
      thinWalls: features.thinWalls.length,
      threads: features.threads.length,
      fillets: features.fillets.length,
      chamfers: features.chamfers.length,
    });
    return features;
  } catch (error) {
    console.warn("Real geometry analysis failed, using heuristics:", error);
    return null;
  }
}

/**
 * Build semantic feature tags from part characteristics.
 */
function buildFeatureTags(
  partCharacteristics: GeometryData["partCharacteristics"],
): string[] {
  return [
    ...(partCharacteristics.isThinWalled ? ["thin-wall"] : []),
    ...(partCharacteristics.hasComplexFeatures ? ["complex-feature"] : []),
    ...(partCharacteristics.hasCurvedSurfaces ? ["curved-surface"] : []),
  ];
}

/**
 * Parse vertex data from ASCII STL text.
 * Returns geometry metrics: triangleCount, boundingBox, volume, surfaceArea.
 */
function parseASCIISTLVertices(text: string): {
  triangleCount: number;
  boundingBox: { x: number; y: number; z: number };
  volume: number;
  surfaceArea: number;
} {
  const lines = text.split("\n");
  let minX = Infinity,
    maxX = -Infinity;
  let minY = Infinity,
    maxY = -Infinity;
  let minZ = Infinity,
    maxZ = -Infinity;
  let triangleCount = 0;

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("vertex")) {
      const parts = trimmed.split(/\s+/);
      const x = Number.parseFloat(parts[1]);
      const y = Number.parseFloat(parts[2]);
      const z = Number.parseFloat(parts[3]);

      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
      minZ = Math.min(minZ, z);
      maxZ = Math.max(maxZ, z);
    } else if (trimmed.startsWith("endfacet")) {
      triangleCount++;
    }
  }

  // Simplified calculations for ASCII
  const boundingBox = {
    x: maxX - minX,
    y: maxY - minY,
    z: maxZ - minZ,
  };

  const volume = boundingBox.x * boundingBox.y * boundingBox.z * 0.4; // Rough estimate
  const surfaceArea =
    2 *
    (boundingBox.x * boundingBox.y +
      boundingBox.y * boundingBox.z +
      boundingBox.z * boundingBox.x);

  return { triangleCount, boundingBox, volume, surfaceArea };
}

/**
 * Analyze Binary STL format
 */
function analyzeBinarySTL(dataView: DataView): GeometryData {
  // Binary STL format:
  // 80 bytes header
  // 4 bytes number of triangles
  // For each triangle:
  //   12 bytes normal vector (3 floats)
  //   12 bytes vertex 1 (3 floats)
  //   12 bytes vertex 2 (3 floats)
  //   12 bytes vertex 3 (3 floats)
  //   2 bytes attribute byte count

  const { triangleCount, boundingBox, volume, surfaceArea } =
    parseBinarySTLTriangles(dataView);

  // ENTERPRISE COMPLEXITY CALCULATION - based on multiple geometric factors
  // Not just file size or triangle count - use actual geometry metrics
  const dims = [boundingBox.x, boundingBox.y, boundingBox.z].sort(
    (a, b) => a - b,
  );
  const aspectRatio = dims[2] / Math.max(dims[0], 0.1);
  const svRatio = surfaceArea / Math.max(volume / 1000, 0.001);

  const { level: complexity } = calculateComplexityScore(
    aspectRatio,
    svRatio,
    triangleCount,
  );

  // REAL GEOMETRY ANALYSIS: Use THREE.js BufferGeometry for accurate feature detection
  const geometryFeatures = analyzeRealGeometryFeatures(dataView, triangleCount);

  // Analyze part characteristics for process identification
  const partCharacteristics = analyzePartCharacteristics(
    boundingBox,
    volume,
    surfaceArea,
    triangleCount,
  );

  // Determine recommended process
  const processRecommendation = recommendManufacturingProcess(
    boundingBox,
    volume,
    surfaceArea,
    // complexity,
    // partCharacteristics,
    // triangleCount,
  );

  // Estimate machining time (simplified)
  const estimatedMachiningTime = calculateMachiningTime(
    volume,
    surfaceArea,
    complexity,
  );

  // Calculate material weight (using default aluminum density: 2.7 g/cm³)
  const materialWeight = (volume / 1000) * 2.7; // Convert mm³ to cm³, then to grams

  // Detect advanced features (enhanced with real geometry if available)
  const advancedFeatures = detectAdvancedFeatures(
    boundingBox,
    volume,
    surfaceArea,
    triangleCount,
    complexity,
    geometryFeatures,
  );

  // Generate DFM issues (using default 'standard' tolerance for initial analysis)
  const dfmIssues = generateDFMIssues(
    {
      boundingBox,
      complexity,
      advancedFeatures,
      partCharacteristics,
      volume,
      surfaceArea,
      estimatedMachiningTime,
      materialWeight,
      recommendedProcess: processRecommendation.process,
      processConfidence: processRecommendation.confidence,
      features: buildFeatureTags(partCharacteristics),
      holes: [],
      pockets: [],
      recommendedSecondaryOps: [],
      dfmIssues: [],
    } as GeometryData,
    "standard",
  );

  // Recommend secondary operations (using default aluminum material)
  const recommendedSecondaryOps = recommendSecondaryOperations(
    {
      boundingBox,
      complexity,
      advancedFeatures,
      partCharacteristics,
      volume,
      surfaceArea,
      estimatedMachiningTime,
      materialWeight,
      recommendedProcess: processRecommendation.process,
      processConfidence: processRecommendation.confidence,
      processReasoning: processRecommendation.reasoning,
      sheetMetalScore: calculateSheetMetalScore(
        boundingBox,
        volume,
        surfaceArea,
        // partCharacteristics,
      ),
      features: buildFeatureTags(partCharacteristics),
      holes: [],
      pockets: [],
      recommendedSecondaryOps: [],
      dfmIssues: [],
    } as GeometryData,
    "Aluminum 6061",
    "standard",
  );

  // ENTERPRISE-LEVEL: Add thickness detection metadata for transparency
  const bboxMinDim = dims[0];

  // Warn if using bbox approximation on potentially bent sheet metal
  let thicknessWarning: string | undefined;
  if (aspectRatio > 5 && bboxMinDim < 25) {
    thicknessWarning =
      "Using bounding box approximation for thickness. For accurate bent sheet metal detection, backend analysis with ray-casting is recommended.";
  }

  return {
    volume,
    surfaceArea,
    boundingBox,
    complexity,
    estimatedMachiningTime,
    materialWeight,
    recommendedProcess: processRecommendation.process,
    processConfidence: processRecommendation.confidence,
    processReasoning: processRecommendation.reasoning,
    sheetMetalScore: calculateSheetMetalScore(
      boundingBox,
      volume,
      surfaceArea,
      // partCharacteristics,
    ),

    // Thickness detection metadata
    detectedWallThickness: bboxMinDim,
    thicknessConfidence: 0.5, // Low confidence - bbox approximation
    thicknessDetectionMethod: "bbox_approximation",
    thicknessWarning,

    partCharacteristics,
    features: buildFeatureTags(partCharacteristics),
    holes:
      geometryFeatures?.holes.map((h) => ({
        diameter: Math.max(
          h.boundingBox.max.x - h.boundingBox.min.x,
          h.boundingBox.max.y - h.boundingBox.min.y,
        ),
        depth: h.boundingBox.max.z - h.boundingBox.min.z,
        isThrough: true, // Default to true for now
      })) || [],
    pockets:
      geometryFeatures?.pockets.map((p) => ({
        width: Math.min(
          p.boundingBox.max.x - p.boundingBox.min.x,
          p.boundingBox.max.y - p.boundingBox.min.y,
        ),
        depth: p.boundingBox.max.z - p.boundingBox.min.z,
        isOpen: true, // Default to true for now
      })) || [],
    advancedFeatures,
    recommendedSecondaryOps,
    dfmIssues,
  };
}

/**
 * Analyze ASCII STL format
 */
function analyzeASCIISTL(text: string): GeometryData {
  const { triangleCount, boundingBox, volume, surfaceArea } =
    parseASCIISTLVertices(text);

  let complexity: GeometryData["complexity"];
  if (triangleCount < 1000) complexity = "simple";
  else if (triangleCount < 5000) complexity = "moderate";
  else complexity = "complex";

  // Analyze part characteristics for process identification
  const partCharacteristics = analyzePartCharacteristics(
    boundingBox,
    volume,
    surfaceArea,
    triangleCount,
  );

  // Determine recommended process
  const processRecommendation = recommendManufacturingProcess(
    boundingBox,
    volume,
    surfaceArea,
    // complexity,
    // partCharacteristics,
    // triangleCount,
  );

  const estimatedMachiningTime = calculateMachiningTime(
    volume,
    surfaceArea,
    complexity,
  );
  const materialWeight = (volume / 1000) * 2.7;

  // Detect advanced features
  const advancedFeatures = detectAdvancedFeatures(
    boundingBox,
    volume,
    surfaceArea,
    triangleCount,
    complexity,
  );

  // If sheet metal is recommended, extract sheet metal features
  let sheetMetalFeatures: SheetMetalFeatures | undefined;
  if (processRecommendation.process === "sheet-metal") {
    sheetMetalFeatures = detectSheetMetalFeatures(
      boundingBox,
      volume,
      surfaceArea,
      triangleCount,
    );
  }

  // Generate DFM issues and secondary ops
  const dfmIssues = generateDFMIssues(
    {
      boundingBox,
      complexity,
      advancedFeatures,
      partCharacteristics,
      volume,
      surfaceArea,
      estimatedMachiningTime,
      materialWeight,
      recommendedProcess: processRecommendation.process,
      processConfidence: processRecommendation.confidence,
      sheetMetalFeatures,
      features: [
        ...(partCharacteristics.isThinWalled ? ["thin-wall"] : []),
        ...(partCharacteristics.hasComplexFeatures ? ["complex-feature"] : []),
        ...(partCharacteristics.hasCurvedSurfaces ? ["curved-surface"] : []),
      ],
      holes: [],
      pockets: [],
      recommendedSecondaryOps: [],
      dfmIssues: [],
    } as GeometryData,
    "standard",
  );

  const recommendedSecondaryOps = recommendSecondaryOperations(
    {
      boundingBox,
      complexity,
      advancedFeatures,
      partCharacteristics,
      volume,
      surfaceArea,
      estimatedMachiningTime,
      materialWeight,
      recommendedProcess: processRecommendation.process,
      processConfidence: processRecommendation.confidence,
      sheetMetalFeatures,
      features: buildFeatureTags(partCharacteristics),
      holes: [],
      pockets: [],
      recommendedSecondaryOps: [],
      dfmIssues: [],
    } as GeometryData,
    "Aluminum 6061",
    "standard",
  );

  return {
    volume,
    surfaceArea,
    boundingBox,
    complexity,
    estimatedMachiningTime,
    materialWeight,
    recommendedProcess: processRecommendation.process,
    processConfidence: processRecommendation.confidence,
    processReasoning: processRecommendation.reasoning,
    sheetMetalScore: calculateSheetMetalScore(
      boundingBox,
      volume,
      surfaceArea,
      // partCharacteristics,
    ),
    partCharacteristics,
    features: buildFeatureTags(partCharacteristics),
    holes: [],
    pockets: [],
    sheetMetalFeatures,
    advancedFeatures,
    recommendedSecondaryOps,
    dfmIssues,
  };
}

// --- Sheet metal helper functions ---

function _estimateBendData(
  triangleCount: number,
  surfaceToVolumeRatio: number,
): { bendCount: number; bendAngles: number[] } {
  let bendCount = 0;
  let bendAngles: number[] = [];

  if (triangleCount > 10000) {
    bendCount =
      Math.floor(triangleCount / 1200) + Math.floor(surfaceToVolumeRatio / 50);
    bendAngles = new Array(Math.min(bendCount, 10))
      .fill(0)
      .map((_, i) => {
        if (i < bendCount * 0.7) return 90;
        return Math.random() > 0.5 ? 45 : 135;
      });
  } else if (triangleCount > 5000) {
    bendCount = Math.floor(triangleCount / 800);
    bendAngles = new Array(Math.min(bendCount, 5)).fill(90);
  } else if (triangleCount > 2000) {
    bendCount = Math.floor(triangleCount / 400);
    bendAngles = new Array(Math.min(bendCount, 3)).fill(90);
  } else if (triangleCount > 500) {
    bendCount = Math.floor(triangleCount / 250);
    bendAngles = [90];
  }

  bendCount = Math.min(bendCount, 50);
  return { bendCount, bendAngles };
}

function _determineCuttingMethod(
  thickness: number,
  complexCuts: number,
  holeCount: number,
  curvedCutLength: number,
): "laser" | "plasma" | "waterjet" | "turret-punch" | "combined" {
  if (thickness <= 3 && complexCuts < 5 && holeCount < 30) return "turret-punch";
  if (thickness <= 20 && curvedCutLength < 500) return "laser";
  if (thickness > 20 || (thickness > 10 && curvedCutLength > 0)) return "plasma";
  if (complexCuts > 10) return "waterjet";
  return "combined";
}

function _determineBendingMethod(
  bendCount: number,
  bendAngles: number[],
): "press-brake" | "panel-bender" | "roll-forming" {
  if (bendCount > 20) return "panel-bender";
  if (bendCount > 0 && bendAngles.some((a) => a > 90 && a < 180))
    return "roll-forming";
  return "press-brake";
}

function _estimateBendTime(bendCount: number, thickness: number): number {
  if (thickness <= 3) return bendCount * 0.5;
  if (thickness <= 6) return bendCount * 1;
  return bendCount * 2;
}

interface ClassifySheetMetalInput {
  bendCount: number;
  holeCount: number;
  surfaceArea: number;
  volume: number;
  width: number;
  length: number;
  thickness: number;
  hasSmallFeatures: boolean;
  hasTightTolerance: boolean;
  requiresMultipleSetups: boolean;
}

type SheetMetalClassification = {
  partType: SheetMetalFeatures["partType"];
  complexity: SheetMetalFeatures["complexity"];
};

function _classifyFlatOrBracket(
  input: ClassifySheetMetalInput,
): SheetMetalClassification | null {
  if (input.bendCount === 0) {
    return {
      partType: "flat-pattern",
      complexity: input.holeCount > 20 ? "moderate" : "simple",
    };
  }
  if (input.bendCount <= 2 && input.holeCount <= 10) {
    return { partType: "bracket", complexity: "simple" };
  }
  if (input.bendCount <= 4 && input.surfaceArea < 50000) {
    return { partType: "panel", complexity: "moderate" };
  }
  return null;
}

function _classifyByEnclosureType(
  input: ClassifySheetMetalInput,
): SheetMetalClassification {
  const { bendCount, volume, width, length, thickness } = input;

  if (bendCount >= 4 && bendCount <= 10) {
    const volumeEfficiency = volume / (width * length * thickness);
    if (volumeEfficiency > 0.3 && volumeEfficiency < 0.7) {
      return _classifyByDimensions(width, length, bendCount);
    }
    return { partType: "chassis", complexity: "moderate" };
  }
  if (length > 400 && width > 400) {
    return { partType: "cabinet", complexity: "very-complex" };
  }
  if (length > 300 || width > 300) {
    return { partType: "complex-enclosure", complexity: "complex" };
  }
  return { partType: "housing", complexity: "complex" };
}

function _classifyByDimensions(
  width: number,
  length: number,
  bendCount: number,
): SheetMetalClassification {
  if (length > 400 && width > 400) {
    return {
      partType: "cabinet",
      complexity: bendCount > 6 ? "complex" : "moderate",
    };
  }
  if (length > 200 || width > 200) {
    return { partType: "housing", complexity: "moderate" };
  }
  return { partType: "simple-enclosure", complexity: "moderate" };
}

function _upgradeComplexity(
  complexity: SheetMetalFeatures["complexity"],
): SheetMetalFeatures["complexity"] {
  if (complexity === "simple") return "moderate";
  if (complexity === "moderate") return "complex";
  return complexity;
}

function _classifySheetMetalPart(
  input: ClassifySheetMetalInput,
): SheetMetalClassification {
  const simple = _classifyFlatOrBracket(input);
  if (simple) {
    let { complexity } = simple;
    if (input.hasSmallFeatures || input.hasTightTolerance || input.requiresMultipleSetups) {
      complexity = _upgradeComplexity(complexity);
    }
    return { partType: simple.partType, complexity };
  }

  const result = _classifyByEnclosureType(input);
  let { complexity } = result;
  if (input.hasSmallFeatures || input.hasTightTolerance || input.requiresMultipleSetups) {
    complexity = _upgradeComplexity(complexity);
  }
  return { partType: result.partType, complexity };
}

/**
 * Detect sheet metal specific features with enterprise-level analysis
 * Identifies enclosures, cabinets, housings, brackets, panels, etc.
 */
function detectSheetMetalFeatures(
  boundingBox: { x: number; y: number; z: number },
  volume: number,
  surfaceArea: number,
  triangleCount: number,
): SheetMetalFeatures {
  const dims = [boundingBox.x, boundingBox.y, boundingBox.z].sort(
    (a, b) => a - b,
  );
  const thickness = dims[0];
  const width = dims[1];
  const length = dims[2];

  // === GEOMETRIC ANALYSIS ===

  // Calculate surface-to-volume ratio (high ratio indicates sheet metal)
  const surfaceToVolumeRatio = surfaceArea / Math.max(volume / 1000, 0.1);

  // === BEND ANALYSIS ===

  const { bendCount, bendAngles } = _estimateBendData(
    triangleCount,
    surfaceToVolumeRatio,
  );

  // Estimate developed (flat pattern) area
  const estimatedFlatArea = surfaceArea * 0.5; // Approximate for bent parts
  const developedLength = 2 * (width + length) * (1 + bendCount * 0.05); // Add for bends

  // Bend radius analysis
  const minBendRadius = thickness * 1; // Minimum: 1x thickness
  const maxBendRadius = thickness * 3; // Typical max: 3x thickness
  const hasSharptBends = thickness > 2; // Thick material = more likely sharp bends

  // === HOLE & CUTTING ANALYSIS ===

  // Sophisticated hole detection
  const holeCount = Math.min(
    Math.floor(surfaceToVolumeRatio / 15) + Math.floor(triangleCount / 1000),
    150, // Cap at 150 holes
  );

  // Estimate hole sizes (assume variety of sizes)
  const avgHoleDiameter = thickness > 3 ? 8 : 6; // Larger holes for thicker material
  const totalHoleDiameter = holeCount * Math.PI * avgHoleDiameter;

  // Corner analysis
  const cornerCount = Math.max(4, Math.floor(triangleCount / 800));

  // Cutting complexity
  const straightCutLength = 2 * (width + length);
  const curvedCutLength =
    triangleCount > 3000 ? Math.floor((triangleCount - 3000) / 300) * 50 : 0; // 50mm per complex curve
  const complexCuts = Math.floor(curvedCutLength / 50);

  // === FORMING FEATURES ===

  const hasHems = bendCount > 4 || length > 300;
  const hasCountersinks = holeCount > 8;
  const hasLouvers = triangleCount > 8000 && bendCount > 6;
  const hasEmbossments = triangleCount > 12000;
  const hasLances = triangleCount > 10000 && bendCount > 8;
  const flangeCount = Math.min(Math.floor(bendCount / 2), 12);

  // === MANUFACTURING COMPLEXITY ===

  const hasSmallFeatures = thickness < 1.5 || holeCount > 30;
  const hasTightTolerance = thickness < 2 && bendCount > 5;
  const requiresMultipleSetups =
    bendCount > 10 || (bendCount > 5 && holeCount > 20);

  // Nesting efficiency (simpler parts nest better)
  const nestingEfficiency = Math.max(
    0.6,
    Math.min(0.95, 0.85 - complexCuts * 0.03 - bendCount * 0.01),
  );

  // === PROCESS RECOMMENDATION ===

  const recommendedCuttingMethod = _determineCuttingMethod(
    thickness,
    complexCuts,
    holeCount,
    curvedCutLength,
  );
  const recommendedBendingMethod = _determineBendingMethod(
    bendCount,
    bendAngles,
  );

  // === TIME ESTIMATION ===

  // Cutting time (minutes)
  let cuttingSpeed: number;
  if (thickness <= 3) cuttingSpeed = 200;
  else if (thickness <= 6) cuttingSpeed = 150;
  else cuttingSpeed = 100;
  const pierceTime = holeCount * (thickness <= 3 ? 0.5 : 1); // seconds per hole
  const estimatedCuttingTime =
    (straightCutLength + curvedCutLength * 1.5) / cuttingSpeed +
    pierceTime / 60;

  // Forming time (minutes)
  const bendTime = _estimateBendTime(bendCount, thickness);
  const formingTime =
    (hasHems ? 2 : 0) + (hasLouvers ? 5 : 0) + (hasEmbossments ? 3 : 0);
  const estimatedFormingTime = bendTime + formingTime;

  // === PART CLASSIFICATION ===

  const { partType, complexity } = _classifySheetMetalPart({
    bendCount,
    holeCount,
    surfaceArea,
    volume,
    width,
    length,
    thickness,
    hasSmallFeatures,
    hasTightTolerance,
    requiresMultipleSetups,
  });

  return {
    // Basic Geometry
    thickness: Math.max(0.5, Math.min(thickness, 25)),
    flatArea: estimatedFlatArea,
    developedLength,
    perimeterLength: 2 * (width + length),

    // Bending Features
    bendCount,
    bendAngles,
    minBendRadius,
    maxBendRadius,
    hasSharptBends,

    // Cutting Features
    holeCount,
    totalHoleDiameter,
    cornerCount,
    complexCuts,
    straightCutLength,
    curvedCutLength,

    // Forming Features
    hasHems,
    hasCountersinks,
    hasLouvers,
    hasEmbossments,
    hasLances,
    flangeCount,

    // Manufacturing Complexity
    hasSmallFeatures,
    hasTightTolerance,
    requiresMultipleSetups,
    nestingEfficiency,

    // Process Detection
    recommendedCuttingMethod,
    recommendedBendingMethod,
    estimatedCuttingTime,
    estimatedFormingTime,

    // Part Classification
    partType,
    complexity,
  };
}

/**
 * Calculate estimated machining time based on geometry
 */
function calculateMachiningTime(
  volume: number,
  surfaceArea: number,
  complexity: "simple" | "moderate" | "complex",
): number {
  // Base time: 0.5 minutes per cm³ of material removal
  const volumeTime = (volume / 1000) * 0.5;

  // Surface finish time: 0.1 minutes per cm² of surface
  const surfaceTime = (surfaceArea / 100) * 0.1;

  // Complexity multiplier
  const complexityMultiplier = {
    simple: 1,
    moderate: 1.5,
    complex: 2.5,
  }[complexity];

  // Setup time
  const setupTime = 15; // 15 minutes base setup

  return Math.round(
    (volumeTime + surfaceTime) * complexityMultiplier + setupTime,
  );
}

// --- Advanced feature detection helpers ---

function _resolveUndercutSeverity(
  undercutCount: number,
): "minor" | "moderate" | "severe" {
  if (undercutCount > 4) return "severe";
  if (undercutCount > 2) return "moderate";
  return "minor";
}

function _resolveDrillingMethod(
  deepHoleCount: number,
  microHoleCount: number,
  avgHoleDiameter: number,
): AdvancedFeatures["holes"]["drillingMethod"] {
  if (deepHoleCount > 2) return "deep-hole-drill";
  if (microHoleCount > 0) return "gun-drill";
  if (avgHoleDiameter > 20) return "boring";
  return "standard-drill";
}

function _resolveRibDeflectionRisk(
  ribCount: number,
  minRibThickness: number,
): RiskLevel {
  if (ribCount === 0) return "low";
  if (minRibThickness < 1) return "high";
  if (minRibThickness < 1.5) return "medium";
  return "low";
}

function _resolveThinWallRisk(
  thinWallCount: number,
  minThickness: number,
): RiskLevel {
  if (thinWallCount === 0) return "low";
  if (minThickness < 1) return "high";
  if (minThickness < 2) return "medium";
  return "low";
}

function _resolveEstimatedSetupCount(
  requiresMultiAxisMachining: boolean,
  requiresIndexing: boolean,
  complexity: ComplexityLevel,
): number {
  if (requiresMultiAxisMachining) return 2;
  if (requiresIndexing) return 3;
  if (complexity === "complex") return 2;
  return 1;
}

function _detectHoleFeatures(
  geometryFeatures: GeometryFeatureMap | null | undefined,
  dims: number[],
  totalHoles: number,
): AdvancedFeatures["holes"] {
  const [minDim, midDim] = dims;
  const throughHoles = geometryFeatures ? Math.floor(totalHoles * 0.5) : 0;
  const blindHoles = totalHoles - throughHoles;
  const tappedHoles =
    geometryFeatures?.threads.filter((t) =>
      geometryFeatures.holes.some(
        (h) =>
          Math.abs(h.centroid.x - t.centroid.x) < 5 &&
          Math.abs(h.centroid.y - t.centroid.y) < 5,
      ),
    ).length ?? 0;
  const reamedHoles = totalHoles > 0 ? Math.floor(totalHoles * 0.1) : 0;
  const countersunkHoles = geometryFeatures?.countersinks.length ?? 0;
  const counterboredHoles = geometryFeatures?.counterbores.length ?? 0;
  const avgDiameter = totalHoles > 0 ? (minDim + midDim) / 15 : 0;
  const minDiameter = totalHoles > 0 ? Math.max(0.5, avgDiameter * 0.3) : 0;
  const maxDiameter = totalHoles > 0 ? avgDiameter * 2.5 : 0;
  const deepHoleCount = totalHoles > 0 ? Math.floor(totalHoles * 0.2) : 0;
  const microHoleCount =
    minDiameter < 1 && totalHoles > 0 ? Math.floor(totalHoles * 0.15) : 0;
  const avgDepthRatio = deepHoleCount > 0 ? 6.5 : 3;

  return {
    count: totalHoles,
    throughHoles,
    blindHoles,
    tappedHoles,
    reamedHoles,
    countersunkHoles,
    counterboredHoles,
    avgDiameter,
    minDiameter,
    maxDiameter,
    deepHoleCount,
    microHoleCount,
    avgDepthRatio,
    drillingMethod: _resolveDrillingMethod(deepHoleCount, microHoleCount, avgDiameter),
    toolAccessIssues: geometryFeatures?.toolAccessRestricted.length ?? 0,
  };
}

function _detectPocketFeatures(
  geometryFeatures: GeometryFeatureMap | null | undefined,
  dims: number[],
  complexity: ComplexityLevel,
  sharpCornersCount: number,
): AdvancedFeatures["pockets"] {
  const [minDim, midDim] = dims;
  const pocketCount = geometryFeatures?.pockets.length ?? 0;
  const openPockets = pocketCount > 0 ? Math.floor(pocketCount * 0.6) : 0;
  const closedPockets = pocketCount - openPockets;
  const deepPockets = pocketCount > 0 ? Math.floor(pocketCount * 0.3) : 0;
  const avgDepth = pocketCount > 0 ? minDim * 0.4 : 0;
  const maxAspectRatio = avgDepth > 0 ? avgDepth / (midDim * 0.1) : 0;
  const minCornerRadius = pocketCount > 0 ? Math.max(0.5, avgDepth * 0.05) : 0;

  return {
    count: pocketCount,
    openPockets,
    closedPockets,
    deepPockets,
    avgDepth,
    maxAspectRatio,
    minCornerRadius,
    sharpCornersCount,
    requiresSquareEndmill: sharpCornersCount > 0,
    requiresBallEndmill: complexity === "complex" && pocketCount > 3,
  };
}

function _detectBossFeatures(
  geometryFeatures: GeometryFeatureMap | null | undefined,
  dims: number[],
  tappedHoles: number,
): AdvancedFeatures["bosses"] {
  const [minDim, , maxDim] = dims;
  const bossCount = geometryFeatures?.bosses.length ?? 0;
  const avgHeight = bossCount > 0 ? maxDim * 0.15 : 0;
  const maxAspectRatio = bossCount > 0 ? avgHeight / (minDim * 0.2) : 0;

  return {
    count: bossCount,
    avgHeight,
    maxAspectRatio,
    requiresThreading: bossCount > 0 && tappedHoles > 0,
    requiresReaming: bossCount > 1,
  };
}

function _detectRibFeatures(
  geometryFeatures: GeometryFeatureMap | null | undefined,
  dims: number[],
): AdvancedFeatures["ribs"] {
  const [minDim] = dims;
  const ribCount = geometryFeatures?.ribs.length ?? 0;
  let avgThickness = 0;
  if (ribCount > 0) {
    avgThickness = minDim < 5 ? minDim * 0.8 : 2.5;
  }
  const minThickness = ribCount > 0 ? avgThickness * 0.6 : 0;
  const thinRibCount =
    ribCount > 0 && avgThickness < 1.5 ? Math.floor(ribCount * 0.7) : 0;

  return {
    count: ribCount,
    avgThickness,
    minThickness,
    thinRibCount,
    deflectionRisk: _resolveRibDeflectionRisk(ribCount, minThickness),
  };
}

function _buildThreadSpecifications(
  totalThreads: number,
  avgDiameter: number,
): { type: ThreadType; size: string; count: number }[] {
  if (totalThreads === 0) return [];

  const specs: {
    type: ThreadType;
    size: string;
    count: number;
  }[] = [];

  if (avgDiameter >= 3 && avgDiameter < 10) {
    specs.push(
      { type: "metric", size: "M6x1.0", count: Math.floor(totalThreads * 0.4) },
      { type: "imperial", size: "1/4-20", count: Math.floor(totalThreads * 0.3) },
    );
  } else if (avgDiameter >= 10) {
    specs.push({
      type: "metric",
      size: "M12x1.75",
      count: Math.floor(totalThreads * 0.5),
    });
  } else {
    specs.push({ type: "metric", size: "M3x0.5", count: totalThreads });
  }

  const remaining = totalThreads - specs.reduce((sum, s) => sum + s.count, 0);
  if (remaining > 0) {
    specs.push({ type: "custom", size: "Various", count: remaining });
  }

  return specs;
}

function _detectThreadFeatures(
  geometryFeatures: GeometryFeatureMap | null | undefined,
  dims: number[],
): AdvancedFeatures["threads"] {
  const [minDim, midDim, maxDim] = dims;
  const totalThreads = geometryFeatures?.threads.length ?? 0;
  const internalThreads =
    totalThreads > 0 ? Math.floor(totalThreads * 0.7) : 0;
  const externalThreads = totalThreads - internalThreads;
  const avgDiameter = totalThreads > 0 ? (minDim + midDim) / 10 : 0;

  return {
    count: totalThreads,
    internalThreads,
    externalThreads,
    specifications: _buildThreadSpecifications(totalThreads, avgDiameter),
    avgDiameter,
    requiresTapping: internalThreads > 0 && avgDiameter < 12,
    requiresThreadMilling: internalThreads > 0 && avgDiameter >= 12,
    singlePointThreading: externalThreads > 0 && maxDim / minDim > 3,
  };
}

function _detectFilletFeatures(
  geometryFeatures: GeometryFeatureMap | null | undefined,
  dims: number[],
  complexity: ComplexityLevel,
  sharpCornersCount: number,
): AdvancedFeatures["fillets"] {
  const [minDim] = dims;
  const filletCount = geometryFeatures?.fillets.length ?? 0;
  const avgRadius = filletCount > 0 ? minDim * 0.05 : 0;
  const minRadius = filletCount > 0 ? Math.max(0.5, avgRadius * 0.4) : 0;
  const missingFilletCount =
    sharpCornersCount > 0 ? Math.max(0, sharpCornersCount - filletCount) : 0;
  let stressConcentrationRisk = 2;
  if (missingFilletCount > 3) {
    stressConcentrationRisk = 8;
  } else if (missingFilletCount > 1) {
    stressConcentrationRisk = 5;
  }

  return {
    count: filletCount,
    avgRadius,
    minRadius,
    missingFilletCount,
    stressConcentrationRisk,
    blendRadiusCount:
      complexity === "complex" && filletCount > 0
        ? Math.floor(filletCount * 0.2)
        : 0,
  };
}

function _detectThinWallFeatures(
  geometryFeatures: GeometryFeatureMap | null | undefined,
  dims: number[],
): AdvancedFeatures["thinWalls"] {
  const [minDim] = dims;
  const thinWallCount = geometryFeatures?.thinWalls.length ?? 0;
  let minThickness = minDim;
  let avgThickness = minDim;
  if (thinWallCount > 0) {
    minThickness = minDim < 10 ? minDim : minDim * 0.1;
    avgThickness = minDim < 10 ? minDim * 1.5 : minDim * 0.15;
  }
  const risk = _resolveThinWallRisk(thinWallCount, minThickness);

  return {
    count: thinWallCount,
    minThickness,
    avgThickness,
    risk,
    requiresSupportFixture:
      thinWallCount > 0 && (risk === "high" || minThickness < 1.5),
  };
}

function _detectToolAccessFeatures(
  toolAccessIssues: number,
  requires5Axis: boolean,
  complexity: ComplexityLevel,
  thinWallRisk: RiskLevel,
): AdvancedFeatures["toolAccess"] {
  const restrictedAreas = toolAccessIssues;
  const requiresIndexing = restrictedAreas > 2;
  const requiresMultiAxisMachining =
    requires5Axis || (restrictedAreas > 4 && complexity === "complex");

  return {
    restrictedAreas,
    requiresIndexing,
    requiresMultiAxisMachining,
    estimatedSetupCount: _resolveEstimatedSetupCount(
      requiresMultiAxisMachining,
      requiresIndexing,
      complexity,
    ),
    axisCounts: {
      "3-axis": complexity === "simple" ? 90 : 50,
      "4-axis": requiresIndexing ? 30 : 0,
      "5-axis": requires5Axis ? 20 : 0,
    },
    specialFixturingNeeded: thinWallRisk === "high" || restrictedAreas > 5,
  };
}

function _detectSurfaceFinish(
  geometryFeatures: GeometryFeatureMap | null | undefined,
  complexity: ComplexityLevel,
  totalHoles: number,
  pocketCount: number,
  avgHoleDiameter: number,
): AdvancedFeatures["surfaceFinish"] {
  const hasComplexSurfaces = geometryFeatures?.complexSurfaces.length ?? 0;
  let estimatedRa = 1.6;
  if (hasComplexSurfaces > 3 || complexity === "complex") {
    estimatedRa = 3.2;
  }
  const criticalSurfaces = Math.floor((totalHoles + pocketCount) * 0.3);

  return {
    estimatedRa,
    criticalSurfaces,
    requiresPolishing: criticalSurfaces > 3,
    requiresHoning: totalHoles > 5 && avgHoleDiameter > 10,
  };
}

/**
 * Detect advanced CNC features (undercuts, pockets, threads, etc.)
 */
function detectAdvancedFeatures(
  boundingBox: { x: number; y: number; z: number },
  volume: number,
  surfaceArea: number,
  triangleCount: number,
  complexity: "simple" | "moderate" | "complex",
  geometryFeatures?: GeometryFeatureMap | null,
): AdvancedFeatures {
  const dims = [boundingBox.x, boundingBox.y, boundingBox.z].sort(
    (a, b) => a - b,
  );

  // Undercut detection - ONLY use real geometry data, no heuristics
  const undercutCount = geometryFeatures?.undercuts.length ?? 0;
  const undercutSeverity = _resolveUndercutSeverity(undercutCount);
  const requires5Axis = undercutCount > 2;

  // Feature detection using extracted helpers
  const totalHoles = geometryFeatures?.holes.length ?? 0;
  const sharpCornersCount = geometryFeatures?.sharpCorners.length ?? 0;

  const holes = _detectHoleFeatures(geometryFeatures, dims, totalHoles);
  const pockets = _detectPocketFeatures(
    geometryFeatures,
    dims,
    complexity,
    sharpCornersCount,
  );
  const bosses = _detectBossFeatures(geometryFeatures, dims, holes.tappedHoles);
  const ribs = _detectRibFeatures(geometryFeatures, dims);
  const threads = _detectThreadFeatures(geometryFeatures, dims);
  const fillets = _detectFilletFeatures(
    geometryFeatures,
    dims,
    complexity,
    sharpCornersCount,
  );

  const chamferCount = geometryFeatures?.chamfers.length ?? 0;
  const chamfers: AdvancedFeatures["chamfers"] = {
    count: chamferCount,
    avgSize: chamferCount > 0 ? fillets.avgRadius * 0.8 : 0,
    deburringRequired:
      totalHoles + pockets.count > 0 &&
      chamferCount < (totalHoles + pockets.count) * 0.5,
  };

  const thinWalls = _detectThinWallFeatures(geometryFeatures, dims);
  const toolAccess = _detectToolAccessFeatures(
    holes.toolAccessIssues,
    requires5Axis,
    complexity,
    thinWalls.risk,
  );
  const surfaceFinish = _detectSurfaceFinish(
    geometryFeatures,
    complexity,
    totalHoles,
    pockets.count,
    holes.avgDiameter,
  );

  return {
    undercuts: {
      count: undercutCount,
      severity: undercutSeverity,
      requires5Axis,
    },
    holes,
    pockets,
    bosses,
    ribs,
    threads,
    fillets,
    chamfers,
    thinWalls,
    toolAccess,
    surfaceFinish,
  };
}

function _perimeter(a: number, b: number): number {
  return 2 * (a + b);
}

interface ToleranceAnalysisContext {
  complexity: ComplexityLevel;
  advancedFeatures: AdvancedFeatures;
  maxDim: number;
  minDim: number;
  material: string | undefined;
  materialFactor: number;
  toleranceStackup?: {
    critical: boolean;
    chainLength: number;
    worstCase: number;
    statistical: number;
    recommendation: string;
  };
  featureSpecificTolerances: {
    holes: { achievable: number; recommended: number; cost: number };
    flatSurfaces: { achievable: number; recommended: number; cost: number };
    threads: { achievable: number; recommended: number; cost: number };
    pockets: { achievable: number; recommended: number; cost: number };
  };
  chainLength: number;
  worstCase: number;
}

interface ToleranceResult {
  additionalCost: number;
  estimatedCapability: number;
  requiredProcess: ToleranceFeasibility["requiredProcess"];
  isAchievable: boolean;
}

function _analyzeStandardTolerance(
  concerns: string[],
  recommendations: string[],
  ctx: ToleranceAnalysisContext,
): ToleranceResult {
  let additionalCost = 0;
  recommendations.push(
    "Standard tolerance is achievable with conventional CNC machining",
  );
  if (ctx.materialFactor > 1.3) {
    recommendations.push(
      `${ctx.material} may require additional machining time for dimensional accuracy`,
    );
    additionalCost += 15;
  }
  return { additionalCost, estimatedCapability: 1.67, requiredProcess: "standard-cnc", isAchievable: true };
}

function _analyzePrecisionTolerance(
  concerns: string[],
  recommendations: string[],
  ctx: ToleranceAnalysisContext,
): ToleranceResult {
  let additionalCost = 50 * ctx.materialFactor;
  const { complexity, advancedFeatures, maxDim, materialFactor, material, toleranceStackup, featureSpecificTolerances } = ctx;

  if (complexity === "complex") {
    concerns.push("Complex geometry may require multiple setups, affecting tolerance stack-up");
    additionalCost += 30;
  }
  if (advancedFeatures.thinWalls.risk === "high") {
    concerns.push("Thin walls may deflect during machining, making precision tolerances difficult");
    recommendations.push("Consider adding temporary supports or using climb milling");
    additionalCost += 25;
  }
  if (advancedFeatures.pockets.deepPockets > 0) {
    concerns.push("Deep pockets may experience tool deflection");
    recommendations.push("Use shorter, more rigid tooling where possible");
    additionalCost += featureSpecificTolerances.pockets.cost;
  }
  if (advancedFeatures.holes.deepHoleCount > 0) {
    concerns.push(`${advancedFeatures.holes.deepHoleCount} deep holes (depth > 5x diameter) may require gun drilling`);
    recommendations.push("Deep holes should be drilled with peck cycle and proper coolant");
    additionalCost += 20 * advancedFeatures.holes.deepHoleCount;
  }
  if (maxDim > 300) {
    concerns.push("Large parts may experience thermal expansion during machining");
    recommendations.push("Allow parts to temperature stabilize before final measurements");
    additionalCost += 20;
  }
  if (materialFactor > 1.3) {
    concerns.push(`${material} is difficult to machine with precision tolerances`);
    additionalCost += 40;
  }
  if (toleranceStackup?.critical) {
    recommendations.push(toleranceStackup.recommendation);
  }
  return { additionalCost, estimatedCapability: 1.33, requiredProcess: "precision-cnc", isAchievable: true };
}

function _analyzeTightTolerance(
  concerns: string[],
  recommendations: string[],
  ctx: ToleranceAnalysisContext,
): ToleranceResult {
  let additionalCost = 150 * ctx.materialFactor;
  let requiredProcess: ToleranceFeasibility["requiredProcess"] = "grinding";
  let isAchievable = true;
  const { complexity, advancedFeatures, minDim, maxDim, material, materialFactor, toleranceStackup, chainLength, worstCase } = ctx;

  if (minDim < 1) {
    concerns.push("Features smaller than 1mm are difficult to measure accurately");
    isAchievable = false;
    recommendations.push("Consider relaxing tolerance for micro-features or use CMM inspection");
  }
  if (complexity === "complex") {
    concerns.push("Complex parts require multiple operations; tolerance stack-up may exceed ±0.025mm");
    additionalCost += 100;
    recommendations.push("Secondary grinding operations required for critical dimensions");
  }
  if (advancedFeatures.undercuts.requires5Axis) {
    concerns.push("5-axis machining makes tight tolerances challenging");
    additionalCost += 80;
    recommendations.push("Consider redesigning to eliminate undercuts if possible");
  }
  if (advancedFeatures.thinWalls.count > 0) {
    concerns.push("Thin-walled parts will deflect under cutting forces");
    isAchievable = advancedFeatures.thinWalls.risk !== "high";
    recommendations.push("Redesign with thicker walls or accept precision tolerance instead");
  }
  if (advancedFeatures.holes.microHoleCount > 0) {
    concerns.push(`${advancedFeatures.holes.microHoleCount} micro holes (<1mm diameter) require specialized tooling`);
    requiredProcess = "edm";
    additionalCost += 50 * advancedFeatures.holes.microHoleCount;
    recommendations.push("Consider EDM drilling for micro holes with tight tolerances");
  }
  if (maxDim > 200) {
    concerns.push("Large parts require temperature-controlled environment");
    requiredProcess = "manual-inspection";
    additionalCost += 120;
    recommendations.push("Parts must be measured in climate-controlled CMM room");
  }
  if (materialFactor > 1.2) {
    concerns.push(`${material} requires specialized grinding or EDM for tight tolerances`);
    requiredProcess = "edm";
    additionalCost += 100;
  }
  recommendations.push(
    "CMM inspection report included for all critical dimensions",
    "First article inspection (FAI) strongly recommended",
  );
  if (toleranceStackup) {
    concerns.push(`Tolerance chain of ${chainLength} dimensions: worst-case accumulation = ${worstCase.toFixed(3)}mm`);
    recommendations.push(toleranceStackup.recommendation);
  }
  return { additionalCost, estimatedCapability: 1, requiredProcess, isAchievable };
}

function _computeMaterialFactor(material: string | undefined): number {
  if (!material) return 1;
  const matLower = material.toLowerCase();
  if (matLower.includes("titanium") || matLower.includes("inconel") || matLower.includes("hardened")) {
    return 1.5;
  }
  if (matLower.includes("stainless") || matLower.includes("steel")) {
    return 1.2;
  }
  if (matLower.includes("brass") || matLower.includes("copper")) {
    return 0.9;
  }
  if (matLower.includes("plastic") || matLower.includes("nylon")) {
    return 1.3;
  }
  return 1;
}

/**
 * Analyze tolerance feasibility based on geometry and requested tolerance
 */
export function analyzeToleranceFeasibility(
  geometry: GeometryData,
  requestedTolerance: ToleranceLevel,
  material?: string,
): ToleranceFeasibility {
  const concerns: string[] = [];
  const recommendations: string[] = [];

  const { complexity, advancedFeatures, boundingBox } = geometry;
  const dims = [boundingBox.x, boundingBox.y, boundingBox.z];
  const maxDim = Math.max(...dims);
  const minDim = Math.min(...dims);

  // Process capabilities (typical tolerance ranges in mm)
  const processCapabilities = {
    milling: { min: 0.013, typical: 0.025, max: 0.13 },
    turning: { min: 0.01, typical: 0.025, max: 0.1 },
    grinding: { min: 0.003, typical: 0.01, max: 0.025 },
    edm: { min: 0.005, typical: 0.013, max: 0.05 },
  };

  const materialFactor = _computeMaterialFactor(material);

  // Feature-specific tolerances
  const holeTolerance = Math.max(0.013, processCapabilities.milling.typical * materialFactor);
  const flatSurfaceTolerance = Math.max(0.01, processCapabilities.milling.typical * materialFactor * 0.8);
  const threadTolerance = Math.max(0.025, processCapabilities.milling.typical * materialFactor * 1.2);
  const pocketTolerance = Math.max(0.025, processCapabilities.milling.typical * materialFactor * 1.1);

  const featureSpecificTolerances = {
    holes: { achievable: holeTolerance, recommended: holeTolerance * 1.5, cost: holeTolerance < 0.02 ? 15 * advancedFeatures.holes.count : 0 },
    flatSurfaces: { achievable: flatSurfaceTolerance, recommended: flatSurfaceTolerance * 1.3, cost: flatSurfaceTolerance < 0.015 ? 25 : 0 },
    threads: { achievable: threadTolerance, recommended: threadTolerance * 1.2, cost: threadTolerance < 0.03 ? 8 * advancedFeatures.threads.count : 0 },
    pockets: { achievable: pocketTolerance, recommended: pocketTolerance * 1.4, cost: advancedFeatures.pockets.deepPockets > 0 ? 35 : 0 },
  };

  // GD&T support analysis
  const gdtSupport = {
    flatness: { achievable: processCapabilities.milling.typical * 2, cost: complexity === "complex" ? 40 : 20 },
    perpendicularity: { achievable: processCapabilities.milling.typical * 1.5, cost: 30 },
    position: { achievable: processCapabilities.milling.typical * 1.2, cost: advancedFeatures.holes.count > 5 ? 50 : 25 },
    concentricity: { achievable: processCapabilities.turning.typical, cost: 45 },
    surfaceFinish: { achievable: advancedFeatures.surfaceFinish.estimatedRa, cost: advancedFeatures.surfaceFinish.criticalSurfaces > 0 ? 60 : 0 },
  };

  // Tolerance stack-up analysis
  const hasComplexChain = complexity === "complex" || advancedFeatures.holes.count > 8;
  const chainLength = hasComplexChain ? Math.min(advancedFeatures.holes.count, 6) : 2;
  const worstCase = processCapabilities.milling.typical * chainLength;
  const statistical = processCapabilities.milling.typical * Math.sqrt(chainLength);

  const toleranceStackup = hasComplexChain
    ? {
        critical: worstCase > 0.15,
        chainLength,
        worstCase,
        statistical,
        recommendation:
          worstCase > 0.15
            ? "Critical tolerance chain detected. Use statistical tolerance stack-up (RSS) instead of worst-case."
            : "Tolerance accumulation is within acceptable limits.",
      }
    : undefined;

  const ctx: ToleranceAnalysisContext = {
    complexity, advancedFeatures, maxDim, minDim, material, materialFactor,
    toleranceStackup, featureSpecificTolerances, chainLength, worstCase,
  };

  let result: ToleranceResult;
  if (requestedTolerance === "standard") {
    result = _analyzeStandardTolerance(concerns, recommendations, ctx);
  } else if (requestedTolerance === "precision") {
    result = _analyzePrecisionTolerance(concerns, recommendations, ctx);
  } else {
    result = _analyzeTightTolerance(concerns, recommendations, ctx);
  }

  return {
    isAchievable: result.isAchievable,
    requiredProcess: result.requiredProcess,
    estimatedCapability: result.estimatedCapability,
    concerns,
    recommendations,
    additionalCost: result.additionalCost,
    processCapabilities,
    materialFactor,
    featureSpecificTolerances,
    gdtSupport,
    toleranceStackup,
  };
}

/**
 * Recommend secondary operations based on geometry and material
 */
function recommendSecondaryOperations(
  geometry: GeometryData,
  material: string,
  tolerance: ToleranceLevel,
): SecondaryOperation[] {
  const operations: SecondaryOperation[] = [];
  const { advancedFeatures, complexity } = geometry;

  // Heat treatment for steel and high-stress parts
  if (
    material.toLowerCase().includes("steel") ||
    material.toLowerCase().includes("titanium")
  ) {
    if (complexity === "complex" || tolerance === "tight") {
      operations.push({
        type: "heat-treatment",
        required: false,
        cost: 80,
        leadTimeAddition: 3,
        description:
          "Stress relief heat treatment recommended to prevent warping and improve dimensional stability",
      });
    }
  }

  // Threading for parts with thread features
  if (advancedFeatures.threads.count > 0) {
    const threadCost =
      advancedFeatures.threads.internalThreads * 3 +
      advancedFeatures.threads.externalThreads * 2;
    operations.push({
      type: "threading",
      required: true,
      cost: threadCost,
      leadTimeAddition: 0.5,
      description: `Threading operations: ${advancedFeatures.threads.internalThreads} internal, ${advancedFeatures.threads.externalThreads} external threads`,
    });
  }

  // Grinding for tight tolerance
  if (tolerance === "tight" && complexity === "complex") {
    operations.push({
      type: "grinding",
      required: true,
      cost: 120,
      leadTimeAddition: 2,
      description:
        "Precision grinding required for critical dimensions to achieve ±0.025mm tolerance",
    });
  }

  // Plating for corrosion resistance
  if (
    material.toLowerCase().includes("steel") &&
    !material.toLowerCase().includes("stainless")
  ) {
    operations.push({
      type: "plating",
      required: false,
      cost: 65,
      leadTimeAddition: 5,
      description:
        "Zinc or nickel plating recommended for corrosion protection",
    });
  }

  // Welding for assemblies (detected by multiple bodies - approximated here)
  if (
    geometry.partCharacteristics.hasComplexFeatures &&
    complexity === "complex"
  ) {
    operations.push({
      type: "welding",
      required: false,
      cost: 45,
      leadTimeAddition: 1,
      description:
        "Welding services available if this is a multi-part assembly",
    });
  }

  return operations;
}

function _checkUndercutIssues(
  issues: GeometryData["dfmIssues"],
  advancedFeatures: AdvancedFeatures,
): void {
  if (advancedFeatures.undercuts.count === 0) return;
  if (advancedFeatures.undercuts.requires5Axis) {
    issues.push({
      severity: "warning",
      issue: `Part contains ${advancedFeatures.undercuts.count} undercuts requiring 5-axis machining`,
      recommendation:
        "Redesign to eliminate undercuts by splitting into multiple parts or adjusting geometry",
      potentialSavings: 180,
    });
  } else {
    issues.push({
      severity: "info",
      issue: `${advancedFeatures.undercuts.count} minor undercuts detected`,
      recommendation:
        "Can be machined with special tooling but adds complexity",
    });
  }
}

function _checkSheetMetalIssues(
  issues: GeometryData["dfmIssues"],
  geometry: GeometryData,
): void {
  if (!geometry.sheetMetalFeatures) return;
  const sm = geometry.sheetMetalFeatures;

  if (sm.bendCount > 15) {
    issues.push({
      severity: "warning",
      issue: `High bend count (${sm.bendCount} bends)`,
      recommendation: "Simplify design to reduce bends and fabrication time",
      potentialSavings: 60,
    });
  }
  if (sm.minBendRadius < sm.thickness) {
    issues.push({
      severity: "critical",
      issue: "Bend radius too small for material thickness",
      recommendation: `Increase bend radius to at least ${sm.thickness}x material thickness (${(sm.thickness * 1.5).toFixed(1)}mm)`,
      potentialSavings: 0,
    });
  }
  if (sm.hasSmallFeatures) {
    issues.push({
      severity: "warning",
      issue: "Small features detected in sheet metal design",
      recommendation:
        "Features smaller than 2x material thickness may be difficult to form",
      potentialSavings: 35,
    });
  }
}

/**
 * Generate DFM (Design for Manufacturing) issues and recommendations
 */
function generateDFMIssues(
  geometry: GeometryData,
  tolerance: ToleranceLevel,
): GeometryData["dfmIssues"] {
  const issues: GeometryData["dfmIssues"] = [];
  const { advancedFeatures, complexity, boundingBox } = geometry;

  _checkUndercutIssues(issues, advancedFeatures);

  // Deep pocket warnings
  if (advancedFeatures.pockets.deepPockets > 0) {
    issues.push({
      severity: "warning",
      issue: `${advancedFeatures.pockets.deepPockets} deep pockets detected (aspect ratio > 3:1)`,
      recommendation:
        "Consider making pockets shallower or wider to improve tool rigidity and reduce machining time",
      potentialSavings: 75,
    });
  }

  // Thin wall warnings
  if (advancedFeatures.thinWalls.risk === "high") {
    issues.push({
      severity: "critical",
      issue: `Thin walls detected (${advancedFeatures.thinWalls.minThickness.toFixed(1)}mm minimum thickness)`,
      recommendation:
        "Increase wall thickness to at least 2mm to prevent deflection and reduce scrap risk",
      potentialSavings: 120,
    });
  } else if (advancedFeatures.thinWalls.risk === "medium") {
    issues.push({
      severity: "warning",
      issue: `Moderately thin walls (${advancedFeatures.thinWalls.minThickness.toFixed(1)}mm thickness)`,
      recommendation: "Consider increasing to 2.5mm for better machinability",
    });
  }

  // Deep hole warnings
  if (advancedFeatures.holes.deepHoleCount > 0) {
    issues.push({
      severity: "warning",
      issue: `${advancedFeatures.holes.deepHoleCount} deep holes (depth > 5x diameter)`,
      recommendation:
        "Reduce hole depth or increase diameter to improve chip evacuation and reduce drill bit deflection",
      potentialSavings: 45,
    });
  }

  // Micro hole warnings
  if (advancedFeatures.holes.microHoleCount > 0) {
    issues.push({
      severity: "critical",
      issue: `${advancedFeatures.holes.microHoleCount} micro holes (<1mm diameter) detected`,
      recommendation:
        "Micro holes require specialized tooling or EDM. Consider increasing diameter to ≥1mm if possible",
      potentialSavings: 85,
    });
  }

  // Tolerance vs complexity mismatch
  if (tolerance === "tight" && complexity === "complex") {
    issues.push({
      severity: "critical",
      issue: "Tight tolerances specified on complex geometry",
      recommendation:
        "Specify tight tolerances only on critical dimensions, use standard tolerances elsewhere",
      potentialSavings: 200,
    });
  }

  // Large part warnings
  const maxDim = Math.max(boundingBox.x, boundingBox.y, boundingBox.z);
  if (maxDim > 400) {
    issues.push({
      severity: "info",
      issue: `Large part (${maxDim.toFixed(0)}mm max dimension) may require special machine`,
      recommendation: "Consider breaking into smaller assemblies if possible",
      potentialSavings: 100,
    });
  }

  _checkSheetMetalIssues(issues, geometry);

  return issues;
}

/**
 * For STEP files - parse actual geometry using CAD service
 * NOTE: Backend analysis with ray-casting happens in upload modals which have fileUrl.
 * This function provides fallback estimation for when file hasn't been uploaded yet.
 */
export async function estimateSTEPGeometry(file: File): Promise<GeometryData> {
  console.log("⚠️ Using estimation fallback for STEP file:", file.name);
  console.log(
    "   💡 For accurate analysis, backend integration happens during file upload",
  );

  // Fallback: Improved estimation using file size heuristics
  const fileSizeKB = file.size / 1024;
  const estimatedVolume = fileSizeKB * 150; // mm³ - improved estimate
  const estimatedSurfaceArea = Math.pow(estimatedVolume, 2 / 3) * 6.2;

  // More realistic bounding box with rectangular proportions (2:1.5:1 ratio)
  const cubeRoot = Math.pow(estimatedVolume, 1 / 3);
  const boundingBox = {
    x: cubeRoot * 1.26, // Length (longest dimension)
    y: cubeRoot * 0.95, // Width (medium dimension)
    z: cubeRoot * 0.63, // Height (shortest dimension)
  };

  return buildGeometryData(
    file,
    boundingBox,
    estimatedVolume,
    estimatedSurfaceArea,
  );
}

function _computeComplexity(
  aspectRatio: number,
  svRatio: number,
  trianglesPerMm3: number,
): ComplexityLevel {
  let score = 0;
  if (aspectRatio > 10) score += 25;
  else if (aspectRatio > 5) score += 15;
  else if (aspectRatio > 3) score += 8;

  if (svRatio > 100) score += 25;
  else if (svRatio > 50) score += 15;
  else if (svRatio > 25) score += 8;

  if (trianglesPerMm3 > 0.1) score += 20;
  else if (trianglesPerMm3 > 0.05) score += 12;
  else if (trianglesPerMm3 > 0.02) score += 6;

  if (score >= 45) return "complex";
  if (score >= 20) return "moderate";
  return "simple";
}

interface BuildPartialGeometryInput {
  boundingBox: { x: number; y: number; z: number };
  complexity: ComplexityLevel;
  advancedFeatures: AdvancedFeatures;
  partCharacteristics: GeometryData["partCharacteristics"];
  volume: number;
  surfaceArea: number;
  estimatedMachiningTime: number;
  materialWeight: number;
  processRecommendation: { process: GeometryData["recommendedProcess"]; confidence: number };
  sheetMetalFeatures: SheetMetalFeatures | undefined;
}

function _buildPartialGeometry(input: BuildPartialGeometryInput): GeometryData {
  return {
    boundingBox: input.boundingBox,
    complexity: input.complexity,
    advancedFeatures: input.advancedFeatures,
    partCharacteristics: input.partCharacteristics,
    volume: input.volume,
    surfaceArea: input.surfaceArea,
    estimatedMachiningTime: input.estimatedMachiningTime,
    materialWeight: input.materialWeight,
    recommendedProcess: input.processRecommendation.process,
    processConfidence: input.processRecommendation.confidence,
    sheetMetalFeatures: input.sheetMetalFeatures,
    features: buildFeatureTags(input.partCharacteristics),
    holes: [],
    pockets: [],
    recommendedSecondaryOps: [],
    dfmIssues: [],
  } as GeometryData;
}

/**
 * Helper to build GeometryData from volume and bounding box
 * Used for client-side analysis (fallback when backend unavailable)
 */
function buildGeometryData(
  file: File,
  boundingBox: { x: number; y: number; z: number },
  volume: number,
  surfaceArea: number,
): GeometryData {
  const estimatedTriangleCount = Math.floor((file.size - 84) / 50);

  const dims = [boundingBox.x, boundingBox.y, boundingBox.z].sort(
    (a, b) => a - b,
  );
  const aspectRatio = dims[2] / Math.max(dims[0], 0.1);
  const svRatio = surfaceArea / Math.max(volume / 1000, 0.001);
  const trianglesPerMm3 = estimatedTriangleCount / Math.max(volume, 1);

  const complexity = _computeComplexity(aspectRatio, svRatio, trianglesPerMm3);

  const partCharacteristics = analyzePartCharacteristics(
    boundingBox, volume, surfaceArea, estimatedTriangleCount,
  );
  const processRecommendation = recommendManufacturingProcess(
    boundingBox, volume, surfaceArea,
  );
  const estimatedMachiningTime = calculateMachiningTime(volume, surfaceArea, complexity);
  const materialWeight = (volume / 1000) * 2.7;
  const advancedFeatures = detectAdvancedFeatures(
    boundingBox, volume, surfaceArea, estimatedTriangleCount, complexity,
  );

  let sheetMetalFeatures: SheetMetalFeatures | undefined;
  if (processRecommendation.process === "sheet-metal") {
    sheetMetalFeatures = detectSheetMetalFeatures(
      boundingBox, volume, surfaceArea, estimatedTriangleCount,
    );
  }

  const partial = _buildPartialGeometry({
    boundingBox, complexity, advancedFeatures, partCharacteristics,
    volume, surfaceArea, estimatedMachiningTime, materialWeight,
    processRecommendation, sheetMetalFeatures,
  });

  const dfmIssues = generateDFMIssues(partial, "standard");
  const recommendedSecondaryOps = recommendSecondaryOperations(
    partial, "Aluminum 6061", "standard",
  );

  return {
    volume,
    surfaceArea,
    boundingBox,
    complexity,
    estimatedMachiningTime,
    materialWeight,
    recommendedProcess: processRecommendation.process,
    processConfidence: processRecommendation.confidence,
    processReasoning: processRecommendation.reasoning,
    sheetMetalScore: calculateSheetMetalScore(boundingBox, volume, surfaceArea),
    partCharacteristics,
    features: buildFeatureTags(partCharacteristics),
    holes: [],
    pockets: [],
    sheetMetalFeatures,
    advancedFeatures,
    recommendedSecondaryOps,
    dfmIssues,
  };
}

/**
 * Analyze part characteristics to help identify manufacturing process
 */
function analyzePartCharacteristics(
  boundingBox: { x: number; y: number; z: number },
  volume: number,
  surfaceArea: number,
  triangleCount: number,
): GeometryData["partCharacteristics"] {
  const dims = [boundingBox.x, boundingBox.y, boundingBox.z].sort(
    (a, b) => a - b,
  );
  const minDim = dims[0];
  const midDim = dims[1];
  const maxDim = dims[2];

  // Aspect ratio (longest to shortest)
  const aspectRatio = maxDim / Math.max(minDim, 0.1);

  // Check if rotational symmetric (cylinder-like)
  const xyRatio =
    Math.abs(boundingBox.x - boundingBox.y) /
    Math.max(boundingBox.x, boundingBox.y);
  const isRotationalSymmetric = xyRatio < 0.15 && aspectRatio > 1.5;

  // Check if thin-walled (sheet metal candidate)
  // Sheet metal typically: thickness 0.5-6mm, and much larger in other dimensions
  const thicknessRatio = midDim / Math.max(minDim, 0.1);
  // Enhanced sheet metal detection: consider uniform thickness + high aspect ratio
  const isThinWalled =
    minDim >= 0.5 && minDim <= 6 && thicknessRatio > 8 && aspectRatio > 5;

  // Check for curved surfaces (high triangle count relative to size)
  const surfaceComplexity = triangleCount / (surfaceArea / 100);
  const hasCurvedSurfaces = surfaceComplexity > 100;

  // Check for complex features (high surface to volume ratio)
  const surfaceToVolumeRatio = surfaceArea / (volume / 1000);
  const hasComplexFeatures = surfaceToVolumeRatio > 50;

  return {
    isRotationalSymmetric,
    isThinWalled,
    hasCurvedSurfaces,
    hasComplexFeatures,
    aspectRatio,
  };
}

/**
 * Advanced geometric analysis for process identification
 */
interface AdvancedGeometricAnalysis {
  volumeDistribution: number; // 0-1: how evenly distributed is volume
  materialRemovalRatio: number; // 0-1: ratio of material that would be removed in CNC
  wallThicknessConsistency: number; // 0-1: how uniform is wall thickness
  planarityScore: number; // 0-1: how planar/flat is the part
  edgeSharpnessScore: number; // 0-1: sharp edges suggest sheet metal
  dimensionBalance: number; // 0-1: balance of X/Y/Z dimensions
}

/**
 * Perform advanced geometric analysis for better process classification
 */
function _scoreVolumeDistribution(volumeEfficiency: number): number {
  if (volumeEfficiency > 0.7) return 0.9;
  if (volumeEfficiency > 0.5) return 0.6;
  if (volumeEfficiency > 0.3) return 0.3;
  return 0.1;
}

function _scoreWallThicknessConsistency(surfaceToVolumeRatio: number): number {
  if (surfaceToVolumeRatio > 80) return 0.95;
  if (surfaceToVolumeRatio > 60) return 0.85;
  if (surfaceToVolumeRatio > 40) return 0.65;
  if (surfaceToVolumeRatio > 25) return 0.4;
  return 0.2;
}

function _scorePlanarity(aspectRatio: number): number {
  if (aspectRatio > 20) return 0.95;
  if (aspectRatio > 15) return 0.85;
  if (aspectRatio > 10) return 0.7;
  if (aspectRatio > 5) return 0.5;
  return 0.25;
}

function _scoreEdgeSharpness(edgeComplexity: number): number {
  if (edgeComplexity > 120) return 0.7;
  if (edgeComplexity > 80) return 0.55;
  if (edgeComplexity > 50) return 0.4;
  return 0.25;
}

function _performAdvancedGeometricAnalysis(
  boundingBox: { x: number; y: number; z: number },
  volume: number,
  surfaceArea: number,
  triangleCount: number,
): AdvancedGeometricAnalysis {
  const dims = [boundingBox.x, boundingBox.y, boundingBox.z].sort(
    (a, b) => a - b,
  );
  const minDim = dims[0];
  const midDim = dims[1];
  const maxDim = dims[2];

  // 1. Volume Distribution Analysis
  // Sheet metal: volume concentrated in thin layer
  // CNC: volume more evenly distributed
  const envelopeVolume = minDim * midDim * maxDim;
  const volumeEfficiency = volume / envelopeVolume;
  const volumeDistribution = _scoreVolumeDistribution(volumeEfficiency);

  // 2. Material Removal Ratio
  // If this were CNC machined from a block, how much material would be wasted?
  const materialRemovalRatio = 1 - volumeEfficiency;

  // 3. Wall Thickness Consistency
  // Sheet metal: consistent thickness throughout
  // CNC: often varying wall thickness
  const surfaceToVolumeRatio = surfaceArea / Math.max(volume / 1000, 0.1);
  // High S/V ratio suggests uniform thin walls (sheet metal)
  // Low S/V ratio suggests varying thickness (CNC)
  const wallThicknessConsistency = _scoreWallThicknessConsistency(surfaceToVolumeRatio);

  // 4. Planarity Score
  // Sheet metal: composed of planar surfaces even when bent
  // CNC: often has curved/sculptured surfaces
  const aspectRatio = maxDim / Math.max(minDim, 0.1);
  const planarityScore = _scorePlanarity(aspectRatio);

  // 5. Edge Sharpness Score
  // Sheet metal: many sharp edges and corners
  // CNC: often has filleted edges
  // Approximate from triangle count and surface area
  const edgeComplexity = triangleCount / (surfaceArea / 100);
  const edgeSharpnessScore = _scoreEdgeSharpness(edgeComplexity);

  // 6. Dimension Balance
  // CNC Turning: two dimensions similar
  // CNC Milling: all dimensions relatively balanced
  // Sheet Metal: one dimension much smaller
  const xyRatio = Math.abs(dims[0] - dims[1]) / Math.max(dims[0], dims[1]);
  const xzRatio = Math.abs(dims[0] - dims[2]) / Math.max(dims[0], dims[2]);
  const yzRatio = Math.abs(dims[1] - dims[2]) / Math.max(dims[1], dims[2]);

  // Low dimensionBalance = unbalanced (sheet metal), high = balanced (CNC)
  const dimensionBalance = 1 - Math.max(xyRatio, xzRatio, yzRatio);

  return {
    volumeDistribution,
    materialRemovalRatio,
    wallThicknessConsistency,
    planarityScore,
    edgeSharpnessScore,
    dimensionBalance,
  };
}

/**
 * Detect process-specific features that are characteristic or impossible for each process
 */
interface ProcessFeatureAnalysis {
  sheetMetalFeatures: {
    hasBendLines: boolean;
    hasFlanges: boolean;
    hasReliefCuts: boolean;
    hasHemmedEdges: boolean;
    score: number; // 0-100
  };
  cncMillingFeatures: {
    hasPockets: boolean;
    hasBosses: boolean;
    hasFillets: boolean;
    has3DCurves: boolean;
    score: number; // 0-100
  };
  cncTurningFeatures: {
    isRotationalSymmetric: boolean;
    hasCylindrical: boolean;
    hasGrooves: boolean;
    hasThreads: boolean;
    score: number; // 0-100
  };
}

function _scoreSheetMetalFeatures(
  minDim: number,
  triangleCount: number,
  advancedAnalysis: AdvancedGeometricAnalysis,
): ProcessFeatureAnalysis["sheetMetalFeatures"] {
  let score = 0;
  const hasBendLines = advancedAnalysis.planarityScore > 0.6 && triangleCount > 500;
  if (hasBendLines) score += 25;

  const hasFlanges = minDim < 6 && advancedAnalysis.edgeSharpnessScore > 0.5;
  if (hasFlanges) score += 20;

  const hasReliefCuts = triangleCount > 1000 && advancedAnalysis.wallThicknessConsistency > 0.7;
  if (hasReliefCuts) score += 15;

  const hasHemmedEdges = minDim < 4 && advancedAnalysis.planarityScore > 0.7;
  if (hasHemmedEdges) score += 10;

  if (advancedAnalysis.wallThicknessConsistency > 0.8) score += 30;

  return { hasBendLines, hasFlanges, hasReliefCuts, hasHemmedEdges, score: Math.min(100, score) };
}

function _scoreCncMillingFeatures(
  triangleCount: number,
  characteristics: GeometryData["partCharacteristics"],
  advancedAnalysis: AdvancedGeometricAnalysis,
): ProcessFeatureAnalysis["cncMillingFeatures"] {
  let score = 0;
  const hasPockets = characteristics.hasComplexFeatures && advancedAnalysis.volumeDistribution > 0.5;
  if (hasPockets) score += 25;

  const hasBosses = advancedAnalysis.volumeDistribution > 0.6 && triangleCount > 2000;
  if (hasBosses) score += 20;

  const hasFillets = advancedAnalysis.edgeSharpnessScore < 0.5 && triangleCount > 1000;
  if (hasFillets) score += 20;

  const has3DCurves = characteristics.hasCurvedSurfaces && advancedAnalysis.planarityScore < 0.5;
  if (has3DCurves) score += 25;

  if (advancedAnalysis.volumeDistribution > 0.7) score += 10;

  return { hasPockets, hasBosses, hasFillets, has3DCurves, score: Math.min(100, score) };
}

function _scoreCncTurningFeatures(
  triangleCount: number,
  surfaceArea: number,
  volume: number,
  characteristics: GeometryData["partCharacteristics"],
): ProcessFeatureAnalysis["cncTurningFeatures"] {
  let score = 0;
  const isRotationalSymmetric = characteristics.isRotationalSymmetric;
  if (isRotationalSymmetric) score += 40;

  const hasCylindrical =
    isRotationalSymmetric &&
    characteristics.aspectRatio != null &&
    characteristics.aspectRatio > 1.5 &&
    characteristics.aspectRatio < 12;
  if (hasCylindrical) score += 30;

  const hasGrooves = isRotationalSymmetric && triangleCount > 1000;
  if (hasGrooves) score += 15;

  const hasThreads = isRotationalSymmetric && surfaceArea / volume > 20;
  if (hasThreads) score += 15;

  return { isRotationalSymmetric, hasCylindrical, hasGrooves, hasThreads, score: Math.min(100, score) };
}

/**
 * Analyze features specific to each manufacturing process
 * @deprecated Not used in fallback mode - backend handles this
 */
function _analyzeProcessFeatures(
  boundingBox: { x: number; y: number; z: number },
  volume: number,
  surfaceArea: number,
  triangleCount: number,
  characteristics: GeometryData["partCharacteristics"],
  advancedAnalysis: AdvancedGeometricAnalysis,
): ProcessFeatureAnalysis {
  const dims = [boundingBox.x, boundingBox.y, boundingBox.z].sort(
    (a, b) => a - b,
  );
  const minDim = dims[0];

  return {
    sheetMetalFeatures: _scoreSheetMetalFeatures(minDim, triangleCount, advancedAnalysis),
    cncMillingFeatures: _scoreCncMillingFeatures(triangleCount, characteristics, advancedAnalysis),
    cncTurningFeatures: _scoreCncTurningFeatures(triangleCount, surfaceArea, volume, characteristics),
  };
}

/**
 * Calculate sheet metal likelihood score based on multiple geometric factors
 * Enhanced with advanced analysis
 */
/**
 * SIMPLE FALLBACK ONLY - Do not use for accurate classification
 *
 * ⚠️ EMERGENCY FALLBACK WHEN BACKEND UNAVAILABLE ⚠️
 *
 * This is a simple bbox-based estimation that:
 * - Cannot detect bent sheet metal (uses bbox height, not actual thickness)
 * - Cannot detect flanges, relief cuts, or complex bends
 * - Should only be used when backend API fails
 *
 * For accurate analysis, ALWAYS use backend API: /api/cad/analyze-geometry
 */
function calculateSheetMetalScore(
  boundingBox: { x: number; y: number; z: number },
  volume: number,
  _surfaceArea: number,
): number {
  const dims = [boundingBox.x, boundingBox.y, boundingBox.z].sort(
    (a, b) => a - b,
  );
  const minDim = dims[0];
  const maxDim = dims[2];
  const aspectRatio = maxDim / Math.max(minDim, 0.1);
  const envelopeVolume = dims[0] * dims[1] * dims[2];
  const volumeEfficiency = volume / envelopeVolume;

  let score = 0;

  // Basic thickness check (bbox approximation only, aligned with backend 0.4-8mm range)
  if (minDim >= 0.4 && minDim <= 8) score += 40;
  else if (minDim >= 0.3 && minDim <= 10) score += 20; // generous margin

  // Basic aspect ratio check (more permissive for bent parts)
  if (aspectRatio > 10) score += 30;
  else if (aspectRatio > 5) score += 20;
  else if (aspectRatio > 3) score += 10;

  // Basic volume efficiency (hollow = possibly bent sheet metal)
  if (volumeEfficiency < 0.4) score += 30;
  else if (volumeEfficiency < 0.6) score += 15;

  return Math.max(0, Math.min(100, score));
}

/**
 * SIMPLE FALLBACK ONLY - Do not use for accurate classification
 *
 * ⚠️ EMERGENCY FALLBACK WHEN BACKEND UNAVAILABLE ⚠️
 *
 * Uses very conservative logic that defaults to CNC for safety.
 * Cannot detect bent sheet metal or complex geometries accurately.
 *
 * For accurate analysis, ALWAYS use backend API: /api/cad/analyze-geometry
 */
function recommendManufacturingProcess(
  boundingBox: { x: number; y: number; z: number },
  volume: number,
  surfaceArea: number,
): {
  process: GeometryData["recommendedProcess"];
  confidence: number;
  reasoning?: string;
} {
  const dims = [boundingBox.x, boundingBox.y, boundingBox.z].sort(
    (a, b) => a - b,
  );
  const minDim = dims[0];
  const maxDim = dims[2];
  const aspectRatio = maxDim / Math.max(minDim, 0.1);
  const envelopeVolume = dims[0] * dims[1] * dims[2];
  const _volumeEfficiency = volume / envelopeVolume;

  // Simple sheet metal score (bbox-based only)
  const sheetMetalScore = calculateSheetMetalScore(
    boundingBox,
    volume,
    surfaceArea,
  );

  console.log("⚠️ USING FALLBACK ANALYSIS (bbox approximation only)", {
    minDim: minDim.toFixed(2) + "mm",
    aspectRatio: aspectRatio.toFixed(1),
    score: sheetMetalScore.toFixed(0),
    warning: "Cannot detect bent sheet metal - use backend for accuracy",
  });

  // Conservative classification - prefer CNC but identify obvious sheet metal
  if (
    minDim >= 0.3 &&
    minDim <= 8 &&
    aspectRatio > 8 &&
    sheetMetalScore > 60
  ) {
    return {
      process: "sheet-metal",
      confidence: 0.65, // Low confidence for fallback
      reasoning: "Fallback estimation - verify with backend for accuracy",
    };
  }

  // Default to CNC milling for safety in fallback mode
  return {
    process: "cnc-milling",
    confidence: 0.5, // Low confidence - this is fallback only
    reasoning:
      "Fallback default - use backend /api/cad/analyze-geometry for accuracy",
  };
}

/**
 * Main analysis function - determines file type and analyzes accordingly
 */
export async function analyzeCADFile(file: File): Promise<GeometryData> {
  const extension = file.name.toLowerCase().split(".").pop();

  switch (extension) {
    case "stl":
      return await analyzeSTLFile(file);
    case "step":
    case "stp":
    case "iges":
    case "igs":
      return await estimateSTEPGeometry(file);
    default:
      // Default estimation for unknown formats
      return await estimateSTEPGeometry(file);
  }
}
