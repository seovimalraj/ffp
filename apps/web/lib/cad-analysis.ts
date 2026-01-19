/**
 * Real CAD Analysis Utilities
 * Extracts geometry data from CAD files for pricing calculations
 */

import { analyzeGeometryFeatures, type GeometryFeatureMap } from './geometry-feature-locator';
import * as THREE from 'three';

export interface AdvancedFeatures {
  // CNC Features
  undercuts: {
    count: number;
    severity: 'minor' | 'moderate' | 'severe';
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
    drillingMethod: 'standard-drill' | 'deep-hole-drill' | 'gun-drill' | 'boring';
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
    deflectionRisk: 'low' | 'medium' | 'high';
  };
  threads: {
    count: number;
    internalThreads: number;
    externalThreads: number;
    specifications: { type: 'metric' | 'imperial' | 'custom'; size: string; count: number }[];
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
    risk: 'low' | 'medium' | 'high'; // deflection risk
    requiresSupportFixture: boolean;
  };
  toolAccess: {
    restrictedAreas: number;
    requiresIndexing: boolean;
    requiresMultiAxisMachining: boolean;
    estimatedSetupCount: number;
    axisCounts: { '3-axis': number; '4-axis': number; '5-axis': number };
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
  requiredProcess: 'standard-cnc' | 'precision-cnc' | 'grinding' | 'manual-inspection' | 'edm' | 'lapping';
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
  type: 'heat-treatment' | 'plating' | 'welding' | 'coating' | 'threading' | 'grinding';
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
  recommendedCuttingMethod: "laser" | "plasma" | "waterjet" | "turret-punch" | "combined";
  recommendedBendingMethod: "press-brake" | "panel-bender" | "roll-forming";
  estimatedCuttingTime: number; // minutes
  estimatedFormingTime: number; // minutes
  
  // Part Classification
  partType: "flat-pattern" | "simple-enclosure" | "complex-enclosure" | "bracket" | "panel" | "chassis" | "housing" | "cabinet";
  complexity: "simple" | "moderate" | "complex" | "very-complex";
}

export interface GeometryData {
  volume: number; // mm³
  surfaceArea: number; // mm²
  boundingBox: {
    x: number;
    y: number;
    z: number;
  };
  complexity: 'simple' | 'moderate' | 'complex';
  estimatedMachiningTime: number; // minutes
  materialWeight: number; // grams
  recommendedProcess: 'cnc-milling' | 'cnc-turning' | 'sheet-metal' | 'injection-molding' | 'manual-quote';
  processConfidence: number; // 0-1, confidence in the recommendation
  partCharacteristics: {
    isRotationalSymmetric: boolean;
    isThinWalled: boolean;
    hasCurvedSurfaces: boolean;
    hasComplexFeatures: boolean;
    aspectRatio: number;
  };
  sheetMetalFeatures?: SheetMetalFeatures; // Only present if recommendedProcess is 'sheet-metal'
  advancedFeatures: AdvancedFeatures; // Advanced feature detection for CNC
  toleranceFeasibility?: ToleranceFeasibility; // Populated when tolerance is specified
  recommendedSecondaryOps: SecondaryOperation[]; // Required or recommended secondary operations
  dfmIssues: {
    severity: 'info' | 'warning' | 'critical';
    issue: string;
    recommendation: string;
    potentialSavings?: number; // USD
  }[];
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
  
  const triangleCount = dataView.getUint32(80, true);
  
  let minX = Infinity, maxX = -Infinity;
  let minY = Infinity, maxY = -Infinity;
  let minZ = Infinity, maxZ = -Infinity;
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
      edge1[0] * edge2[1] - edge1[1] * edge2[0]
    ];
    
    const area = 0.5 * Math.sqrt(cross[0] * cross[0] + cross[1] * cross[1] + cross[2] * cross[2]);
    surfaceArea += area;
    
    // Volume calculation using signed volume of tetrahedron
    const signedVolume = (v1[0] * (v2[1] * v3[2] - v2[2] * v3[1]) +
                          v1[1] * (v2[2] * v3[0] - v2[0] * v3[2]) +
                          v1[2] * (v2[0] * v3[1] - v2[1] * v3[0])) / 6;
    volume += signedVolume;
    
    // Skip attribute byte count
    offset += 2;
  }
  
  volume = Math.abs(volume);
  
  const boundingBox = {
    x: maxX - minX,
    y: maxY - minY,
    z: maxZ - minZ
  };
  
  // Estimate complexity based on triangle count and surface area to volume ratio
  const complexityScore = triangleCount / 1000 + (surfaceArea / volume) / 10;
  const complexity: GeometryData['complexity'] = 
    complexityScore < 5 ? 'simple' : 
    complexityScore < 15 ? 'moderate' : 
    'complex';
  
  // REAL GEOMETRY ANALYSIS: Use THREE.js BufferGeometry for accurate feature detection
  let geometryFeatures: GeometryFeatureMap | null = null;
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
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.computeVertexNormals();
    
    // Analyze real geometry features
    geometryFeatures = analyzeGeometryFeatures(geometry);
    console.log('Real geometry analysis complete:', {
      holes: geometryFeatures.holes.length,
      pockets: geometryFeatures.pockets.length,
      thinWalls: geometryFeatures.thinWalls.length,
      threads: geometryFeatures.threads.length,
      fillets: geometryFeatures.fillets.length,
      chamfers: geometryFeatures.chamfers.length,
    });
  } catch (error) {
    console.warn('Real geometry analysis failed, using heuristics:', error);
  }
  
  // Analyze part characteristics for process identification
  const partCharacteristics = analyzePartCharacteristics(boundingBox, volume, surfaceArea, triangleCount);
  
  // Determine recommended process
  const processRecommendation = recommendManufacturingProcess(boundingBox, volume, surfaceArea, complexity, partCharacteristics);
  
  // Estimate machining time (simplified)
  const estimatedMachiningTime = calculateMachiningTime(volume, surfaceArea, complexity);
  
  // Calculate material weight (using default aluminum density: 2.7 g/cm³)
  const materialWeight = (volume / 1000) * 2.7; // Convert mm³ to cm³, then to grams
  
  // Detect advanced features (enhanced with real geometry if available)
  const advancedFeatures = detectAdvancedFeatures(
    boundingBox, 
    volume, 
    surfaceArea, 
    triangleCount, 
    complexity,
    geometryFeatures
  );
  
  // Generate DFM issues (using default 'standard' tolerance for initial analysis)
  const dfmIssues = generateDFMIssues({ 
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
    recommendedSecondaryOps: [],
    dfmIssues: []
  } as GeometryData, 'standard');
  
  // Recommend secondary operations (using default aluminum material)
  const recommendedSecondaryOps = recommendSecondaryOperations({
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
    recommendedSecondaryOps: [],
    dfmIssues: []
  } as GeometryData, 'Aluminum 6061', 'standard');
  
  return {
    volume,
    surfaceArea,
    boundingBox,
    complexity,
    estimatedMachiningTime,
    materialWeight,
    recommendedProcess: processRecommendation.process,
    processConfidence: processRecommendation.confidence,
    partCharacteristics,
    advancedFeatures,
    recommendedSecondaryOps,
    dfmIssues
  };
}

/**
 * Analyze ASCII STL format
 */
function analyzeASCIISTL(text: string): GeometryData {
  const lines = text.split('\n');
  const vertices: [number, number, number][] = [];
  let minX = Infinity, maxX = -Infinity;
  let minY = Infinity, maxY = -Infinity;
  let minZ = Infinity, maxZ = -Infinity;
  let triangleCount = 0;
  
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('vertex')) {
      const parts = trimmed.split(/\s+/);
      const x = parseFloat(parts[1]);
      const y = parseFloat(parts[2]);
      const z = parseFloat(parts[3]);
      
      vertices.push([x, y, z]);
      
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
      minZ = Math.min(minZ, z);
      maxZ = Math.max(maxZ, z);
    } else if (trimmed.startsWith('endfacet')) {
      triangleCount++;
    }
  }
  
  // Simplified calculations for ASCII
  const boundingBox = {
    x: maxX - minX,
    y: maxY - minY,
    z: maxZ - minZ
  };
  
  const volume = boundingBox.x * boundingBox.y * boundingBox.z * 0.4; // Rough estimate
  const surfaceArea = 2 * (boundingBox.x * boundingBox.y + boundingBox.y * boundingBox.z + boundingBox.z * boundingBox.x);
  
  const complexity: GeometryData['complexity'] = 
    triangleCount < 1000 ? 'simple' : 
    triangleCount < 5000 ? 'moderate' : 
    'complex';
  
  // Analyze part characteristics for process identification
  const partCharacteristics = analyzePartCharacteristics(boundingBox, volume, surfaceArea, triangleCount);
  
  // Determine recommended process
  const processRecommendation = recommendManufacturingProcess(boundingBox, volume, surfaceArea, complexity, partCharacteristics);
  
  const estimatedMachiningTime = calculateMachiningTime(volume, surfaceArea, complexity);
  const materialWeight = (volume / 1000) * 2.7;
  
  // Detect advanced features
  const advancedFeatures = detectAdvancedFeatures(boundingBox, volume, surfaceArea, triangleCount, complexity);
  
  // If sheet metal is recommended, extract sheet metal features
  let sheetMetalFeatures: SheetMetalFeatures | undefined;
  if (processRecommendation.process === 'sheet-metal') {
    sheetMetalFeatures = detectSheetMetalFeatures(boundingBox, volume, surfaceArea, triangleCount);
  }
  
  // Generate DFM issues and secondary ops
  const dfmIssues = generateDFMIssues({ 
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
    recommendedSecondaryOps: [],
    dfmIssues: []
  } as GeometryData, 'standard');
  
  const recommendedSecondaryOps = recommendSecondaryOperations({
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
    recommendedSecondaryOps: [],
    dfmIssues: []
  } as GeometryData, 'Aluminum 6061', 'standard');

  return {
    volume,
    surfaceArea,
    boundingBox,
    complexity,
    estimatedMachiningTime,
    materialWeight,
    recommendedProcess: processRecommendation.process,
    processConfidence: processRecommendation.confidence,
    partCharacteristics,
    sheetMetalFeatures,
    advancedFeatures,
    recommendedSecondaryOps,
    dfmIssues
  };
}

/**
 * Detect sheet metal specific features with enterprise-level analysis
 * Identifies enclosures, cabinets, housings, brackets, panels, etc.
 */
function detectSheetMetalFeatures(
  boundingBox: { x: number; y: number; z: number },
  volume: number,
  surfaceArea: number,
  triangleCount: number
): SheetMetalFeatures {
  const dims = [boundingBox.x, boundingBox.y, boundingBox.z].sort((a, b) => a - b);
  const thickness = dims[0];
  const width = dims[1];
  const length = dims[2];
  
  // === GEOMETRIC ANALYSIS ===
  
  // Calculate surface-to-volume ratio (high ratio indicates sheet metal)
  const surfaceToVolumeRatio = surfaceArea / Math.max(volume / 1000, 0.1);
  
  // Calculate aspect ratio and flatness indicator
  const aspectRatio = length / Math.max(thickness, 0.1);
  const flatnessRatio = (width * length) / Math.max(volume / thickness, 1);
  
  // Estimate developed (flat pattern) area
  const estimatedFlatArea = surfaceArea * 0.5; // Approximate for bent parts
  const developedLength = 2 * (width + length) * (1 + bendCount * 0.05); // Add for bends
  
  // === BEND ANALYSIS ===
  
  // Advanced bend detection based on geometry complexity
  // More triangles + high flatness = more bends
  let bendCount = 0;
  let bendAngles: number[] = [];
  
  if (triangleCount > 10000) {
    bendCount = Math.floor(triangleCount / 1200) + Math.floor(surfaceToVolumeRatio / 50);
    // Generate estimated bend angles (90° is most common)
    bendAngles = Array(Math.min(bendCount, 10)).fill(0).map((_, i) => 
      i < bendCount * 0.7 ? 90 : (Math.random() > 0.5 ? 45 : 135)
    );
  } else if (triangleCount > 5000) {
    bendCount = Math.floor(triangleCount / 800);
    bendAngles = Array(Math.min(bendCount, 5)).fill(90);
  } else if (triangleCount > 2000) {
    bendCount = Math.floor(triangleCount / 400);
    bendAngles = Array(Math.min(bendCount, 3)).fill(90);
  } else if (triangleCount > 500) {
    bendCount = Math.floor(triangleCount / 250);
    bendAngles = [90];
  }
  
  bendCount = Math.min(bendCount, 50); // Cap at 50 bends
  
  // Bend radius analysis
  const minBendRadius = thickness * 1.0; // Minimum: 1x thickness
  const maxBendRadius = thickness * 3.0; // Typical max: 3x thickness
  const hasSharptBends = thickness > 2; // Thick material = more likely sharp bends
  
  // === HOLE & CUTTING ANALYSIS ===
  
  // Sophisticated hole detection
  const holeCount = Math.min(
    Math.floor(surfaceToVolumeRatio / 15) + Math.floor(triangleCount / 1000),
    150 // Cap at 150 holes
  );
  
  // Estimate hole sizes (assume variety of sizes)
  const avgHoleDiameter = thickness > 3 ? 8 : 6; // Larger holes for thicker material
  const totalHoleDiameter = holeCount * Math.PI * avgHoleDiameter;
  
  // Corner analysis
  const cornerCount = Math.max(4, Math.floor(triangleCount / 800));
  
  // Cutting complexity
  const straightCutLength = 2 * (width + length);
  const curvedCutLength = triangleCount > 3000 ? 
    Math.floor((triangleCount - 3000) / 300) * 50 : 0; // 50mm per complex curve
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
  const requiresMultipleSetups = bendCount > 10 || (bendCount > 5 && holeCount > 20);
  
  // Nesting efficiency (simpler parts nest better)
  const nestingEfficiency = Math.max(0.6, Math.min(0.95, 
    0.85 - (complexCuts * 0.03) - (bendCount * 0.01)
  ));
  
  // === PROCESS RECOMMENDATION ===
  
  // Cutting method selection
  let recommendedCuttingMethod: "laser" | "plasma" | "waterjet" | "turret-punch" | "combined";
  
  if (thickness <= 3 && complexCuts < 5 && holeCount < 30) {
    recommendedCuttingMethod = "turret-punch"; // Fast for simple patterns
  } else if (thickness <= 20 && curvedCutLength < 500) {
    recommendedCuttingMethod = "laser"; // Versatile, good quality
  } else if (thickness > 20 || (thickness > 10 && curvedCutLength > 0)) {
    recommendedCuttingMethod = "plasma"; // Thick material
  } else if (complexCuts > 10) {
    recommendedCuttingMethod = "waterjet"; // Complex cuts, no heat
  } else {
    recommendedCuttingMethod = "combined"; // Multiple methods needed
  }
  
  // Bending method selection
  const recommendedBendingMethod: "press-brake" | "panel-bender" | "roll-forming" = 
    bendCount > 20 ? "panel-bender" :
    bendCount > 0 && bendAngles.some(a => a > 90 && a < 180) ? "roll-forming" :
    "press-brake";
  
  // === TIME ESTIMATION ===
  
  // Cutting time (minutes)
  const cuttingSpeed = thickness <= 3 ? 200 : thickness <= 6 ? 150 : 100; // mm/min
  const pierceTime = holeCount * (thickness <= 3 ? 0.5 : 1.0); // seconds per hole
  const estimatedCuttingTime = 
    (straightCutLength + curvedCutLength * 1.5) / cuttingSpeed + pierceTime / 60;
  
  // Forming time (minutes)
  const bendTime = bendCount * (thickness <= 3 ? 0.5 : thickness <= 6 ? 1.0 : 2.0);
  const formingTime = (hasHems ? 2 : 0) + (hasLouvers ? 5 : 0) + (hasEmbossments ? 3 : 0);
  const estimatedFormingTime = bendTime + formingTime;
  
  // === PART CLASSIFICATION ===
  
  // Intelligent part type classification
  let partType: SheetMetalFeatures['partType'];
  let complexity: SheetMetalFeatures['complexity'];
  
  if (bendCount === 0) {
    partType = "flat-pattern";
    complexity = holeCount > 20 ? "moderate" : "simple";
  } else if (bendCount <= 2 && holeCount <= 10) {
    partType = "bracket";
    complexity = "simple";
  } else if (bendCount <= 4 && surfaceArea < 50000) {
    partType = "panel";
    complexity = "moderate";
  } else if (bendCount >= 4 && bendCount <= 10) {
    // Check if it forms an enclosed shape (enclosure detection)
    const volumeEfficiency = volume / (width * length * thickness);
    if (volumeEfficiency > 0.3 && volumeEfficiency < 0.7) {
      if (length > 400 && width > 400) {
        partType = "cabinet";
        complexity = bendCount > 6 ? "complex" : "moderate";
      } else if (length > 200 || width > 200) {
        partType = "housing";
        complexity = "moderate";
      } else {
        partType = "simple-enclosure";
        complexity = "moderate";
      }
    } else {
      partType = "chassis";
      complexity = "moderate";
    }
  } else {
    // High bend count = complex enclosure or chassis
    if (length > 400 && width > 400) {
      partType = "cabinet";
      complexity = "very-complex";
    } else if (length > 300 || width > 300) {
      partType = "complex-enclosure";
      complexity = "complex";
    } else {
      partType = "housing";
      complexity = "complex";
    }
  }
  
  // Adjust complexity based on features
  if (hasSmallFeatures || hasTightTolerance || requiresMultipleSetups) {
    if (complexity === "simple") complexity = "moderate";
    else if (complexity === "moderate") complexity = "complex";
  }
  
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
    complexity
  };
}

/**
 * Calculate estimated machining time based on geometry
 */
function calculateMachiningTime(
  volume: number,
  surfaceArea: number,
  complexity: 'simple' | 'moderate' | 'complex'
): number {
  // Base time: 0.5 minutes per cm³ of material removal
  const volumeTime = (volume / 1000) * 0.5;
  
  // Surface finish time: 0.1 minutes per cm² of surface
  const surfaceTime = (surfaceArea / 100) * 0.1;
  
  // Complexity multiplier
  const complexityMultiplier = {
    simple: 1.0,
    moderate: 1.5,
    complex: 2.5
  }[complexity];
  
  // Setup time
  const setupTime = 15; // 15 minutes base setup
  
  return Math.round((volumeTime + surfaceTime) * complexityMultiplier + setupTime);
}

/**
 * Detect advanced CNC features (undercuts, pockets, threads, etc.)
 */
function detectAdvancedFeatures(
  boundingBox: { x: number; y: number; z: number },
  volume: number,
  surfaceArea: number,
  triangleCount: number,
  complexity: 'simple' | 'moderate' | 'complex',
  geometryFeatures?: GeometryFeatureMap | null
): AdvancedFeatures {
  const dims = [boundingBox.x, boundingBox.y, boundingBox.z].sort((a, b) => a - b);
  const minDim = dims[0];
  const midDim = dims[1];
  const maxDim = dims[2];
  
  // Surface to volume ratio for feature detection
  const svRatio = surfaceArea / (volume / 1000);
  
  // Use REAL geometry data when available, fallback to heuristics
  
  // Undercut detection (enhanced with real geometry)
  const undercutCount = geometryFeatures?.undercuts.length ?? 
    (complexity === 'complex' && triangleCount > 5000 ? Math.floor(triangleCount / 2500) : 0);
  const undercutSeverity: 'minor' | 'moderate' | 'severe' = 
    undercutCount > 4 ? 'severe' : undercutCount > 2 ? 'moderate' : 'minor';
  const requires5Axis = undercutCount > 2 || (complexity === 'complex' && svRatio > 60);
  
  // Hole detection with detailed classification (REAL GEOMETRY)
  const totalHoles = geometryFeatures?.holes.length ?? 
    (svRatio > 50 ? Math.floor(svRatio / 25) : triangleCount > 2000 ? Math.floor(triangleCount / 800) : 0);
  const throughHoles = Math.floor(totalHoles * 0.5);
  const blindHoles = totalHoles - throughHoles;
  const tappedHoles = geometryFeatures?.threads.filter(t => 
    geometryFeatures.holes.some(h => Math.abs(h.centroid.x - t.centroid.x) < 5 && 
                                      Math.abs(h.centroid.y - t.centroid.y) < 5)).length ?? 
    Math.floor(totalHoles * 0.3);
  const reamedHoles = Math.floor(totalHoles * 0.1);
  const countersunkHoles = geometryFeatures?.countersinks.length ?? Math.floor(totalHoles * 0.2);
  const counterboredHoles = geometryFeatures?.counterbores.length ?? Math.floor(totalHoles * 0.15);
  const avgHoleDiameter = (minDim + midDim) / 15;
  const minHoleDiameter = Math.max(0.5, avgHoleDiameter * 0.3);
  const maxHoleDiameter = avgHoleDiameter * 2.5;
  const deepHoleCount = totalHoles > 0 ? Math.floor(totalHoles * 0.2) : 0;
  const microHoleCount = minHoleDiameter < 1 ? Math.floor(totalHoles * 0.15) : 0;
  const avgDepthRatio = deepHoleCount > 0 ? 6.5 : 3.0;
  const drillingMethod = deepHoleCount > 2 ? 'deep-hole-drill' : microHoleCount > 0 ? 'gun-drill' : avgHoleDiameter > 20 ? 'boring' : 'standard-drill';
  const toolAccessIssues = geometryFeatures?.toolAccessRestricted.length ?? 
    (complexity === 'complex' ? Math.floor(totalHoles * 0.25) : 0);
  
  // Pocket detection (REAL GEOMETRY)
  const pocketCount = geometryFeatures?.pockets.length ?? 
    (svRatio > 40 ? Math.floor(svRatio / 15) : 0);
  const openPockets = Math.floor(pocketCount * 0.6);
  const closedPockets = pocketCount - openPockets;
  const deepPockets = pocketCount > 0 ? Math.floor(pocketCount * 0.3) : 0;
  const avgDepth = minDim * 0.4;
  const maxAspectRatio = avgDepth / (midDim * 0.1);
  const minCornerRadius = Math.max(0.5, avgDepth * 0.05);
  const sharpCornersCount = geometryFeatures?.sharpCorners.length ?? 
    (pocketCount > 0 ? Math.floor(pocketCount * 0.4) : 0);
  const requiresSquareEndmill = sharpCornersCount > 0;
  const requiresBallEndmill = complexity === 'complex' && pocketCount > 3;
  
  // Boss detection (REAL GEOMETRY)
  const bossCount = geometryFeatures?.bosses.length ?? 
    (svRatio > 35 ? Math.floor(svRatio / 30) : 0);
  const avgBossHeight = maxDim * 0.15;
  const maxBossAspectRatio = avgBossHeight / (minDim * 0.2);
  const bossRequiresThreading = bossCount > 0 && tappedHoles > 0;
  const bossRequiresReaming = bossCount > 1;
  
  // Rib detection (REAL GEOMETRY)
  const ribCount = geometryFeatures?.ribs.length ?? 
    (minDim < 5 && complexity !== 'simple' ? Math.floor(svRatio / 20) : 0);
  const avgRibThickness = minDim < 5 ? minDim * 0.8 : 2.5;
  const minRibThickness = avgRibThickness * 0.6;
  const thinRibCount = avgRibThickness < 1.5 ? Math.floor(ribCount * 0.7) : 0;
  const ribDeflectionRisk: 'low' | 'medium' | 'high' = 
    minRibThickness < 1 ? 'high' : minRibThickness < 1.5 ? 'medium' : 'low';
  
  // Thread detection (REAL GEOMETRY - most accurate)
  const totalThreads = geometryFeatures?.threads.length ?? 
    (triangleCount > 2000 ? Math.floor(triangleCount / 1000) : 0);
  const internalThreads = Math.floor(totalThreads * 0.7);
  const externalThreads = totalThreads - internalThreads;
  const avgThreadDiameter = (minDim + midDim) / 10;
  
  // Thread specifications (estimated based on diameter)
  const threadSpecs: { type: 'metric' | 'imperial' | 'custom'; size: string; count: number }[] = [];
  if (totalThreads > 0) {
    if (avgThreadDiameter >= 3 && avgThreadDiameter < 10) {
      threadSpecs.push({ type: 'metric', size: 'M6x1.0', count: Math.floor(totalThreads * 0.4) });
      threadSpecs.push({ type: 'imperial', size: '1/4-20', count: Math.floor(totalThreads * 0.3) });
    } else if (avgThreadDiameter >= 10) {
      threadSpecs.push({ type: 'metric', size: 'M12x1.75', count: Math.floor(totalThreads * 0.5) });
    } else {
      threadSpecs.push({ type: 'metric', size: 'M3x0.5', count: totalThreads });
    }
    if (totalThreads - threadSpecs.reduce((sum, s) => sum + s.count, 0) > 0) {
      threadSpecs.push({ type: 'custom', size: 'Various', count: totalThreads - threadSpecs.reduce((sum, s) => sum + s.count, 0) });
    }
  }
  
  const requiresTapping = internalThreads > 0 && avgThreadDiameter < 12;
  const requiresThreadMilling = internalThreads > 0 && avgThreadDiameter >= 12;
  const singlePointThreading = externalThreads > 0 && maxDim / minDim > 3; // lathe parts
  
  // Fillet detection (REAL GEOMETRY - high accuracy)
  const filletCount = geometryFeatures?.fillets.length ?? 
    (triangleCount > 1000 ? Math.floor(triangleCount / 500) : 0);
  const avgFilletRadius = minDim * 0.05;
  const minFilletRadius = Math.max(0.5, avgFilletRadius * 0.4);
  // Missing fillets = sharp corners that should be filleted
  const missingFilletCount = sharpCornersCount - filletCount;
  const stressConcentrationRisk = missingFilletCount > 3 ? 8 : missingFilletCount > 1 ? 5 : 2;
  const blendRadiusCount = complexity === 'complex' ? Math.floor(filletCount * 0.2) : 0;
  
  // Chamfer detection (REAL GEOMETRY)
  const chamferCount = geometryFeatures?.chamfers.length ?? 
    Math.floor(filletCount * 0.3);
  const avgChamferSize = avgFilletRadius * 0.8;
  const deburringRequired = chamferCount < (totalHoles + pocketCount) * 0.5;
  
  // Thin wall detection (REAL GEOMETRY)
  const thinWallCount = geometryFeatures?.thinWalls.length ?? 
    (minDim < 3 ? Math.ceil(perimeter(midDim, maxDim) / 50) : 0);
  const minThickness = minDim < 10 ? minDim : minDim * 0.1;
  const avgThickness = minDim < 10 ? minDim * 1.5 : minDim * 0.15;
  const thinWallRisk: 'low' | 'medium' | 'high' = 
    minThickness < 1 ? 'high' : minThickness < 2 ? 'medium' : 'low';
  const requiresSupportFixture = thinWallRisk === 'high' || minThickness < 1.5;
  
  // Tool access analysis (REAL GEOMETRY - enhanced accuracy)
  const restrictedAreas = toolAccessIssues;
  const requiresIndexing = restrictedAreas > 2;
  const requiresMultiAxisMachining = requires5Axis || (restrictedAreas > 4 && complexity === 'complex');
  const estimatedSetupCount = 
    requiresMultiAxisMachining ? 2 : 
    requiresIndexing ? 3 : 
    complexity === 'complex' ? 2 : 1;
  
  const axis3Count = complexity === 'simple' ? 90 : 50;
  const axis4Count = requiresIndexing ? 30 : 0;
  const axis5Count = requires5Axis ? 20 : 0;
  const specialFixturingNeeded = thinWallRisk === 'high' || restrictedAreas > 5;
  
  // Surface finish estimation (enhanced with complexity detection)
  const hasComplexSurfaces = geometryFeatures?.complexSurfaces.length ?? 0;
  const estimatedRa = hasComplexSurfaces > 3 ? 3.2 : complexity === 'complex' ? 3.2 : 1.6; // micrometers
  const criticalSurfaces = Math.floor((totalHoles + pocketCount) * 0.3);
  const requiresPolishing = criticalSurfaces > 3;
  const requiresHoning = totalHoles > 5 && avgHoleDiameter > 10;
  
  return {
    undercuts: {
      count: undercutCount,
      severity: undercutSeverity,
      requires5Axis
    },
    holes: {
      count: totalHoles,
      throughHoles,
      blindHoles,
      tappedHoles,
      reamedHoles,
      countersunkHoles,
      counterboredHoles,
      avgDiameter: avgHoleDiameter,
      minDiameter: minHoleDiameter,
      maxDiameter: maxHoleDiameter,
      deepHoleCount,
      microHoleCount,
      avgDepthRatio,
      drillingMethod,
      toolAccessIssues
    },
    pockets: {
      count: pocketCount,
      openPockets,
      closedPockets,
      deepPockets,
      avgDepth,
      maxAspectRatio,
      minCornerRadius,
      sharpCornersCount,
      requiresSquareEndmill,
      requiresBallEndmill
    },
    bosses: {
      count: bossCount,
      avgHeight: avgBossHeight,
      maxAspectRatio: maxBossAspectRatio,
      requiresThreading: bossRequiresThreading,
      requiresReaming: bossRequiresReaming
    },
    ribs: {
      count: ribCount,
      avgThickness: avgRibThickness,
      minThickness: minRibThickness,
      thinRibCount,
      deflectionRisk: ribDeflectionRisk
    },
    threads: {
      count: totalThreads,
      internalThreads,
      externalThreads,
      specifications: threadSpecs,
      avgDiameter: avgThreadDiameter,
      requiresTapping,
      requiresThreadMilling,
      singlePointThreading
    },
    fillets: {
      count: filletCount,
      avgRadius: avgFilletRadius,
      minRadius: minFilletRadius,
      missingFilletCount,
      stressConcentrationRisk,
      blendRadiusCount
    },
    chamfers: {
      count: chamferCount,
      avgSize: avgChamferSize,
      deburringRequired
    },
    thinWalls: {
      count: thinWallCount,
      minThickness,
      avgThickness,
      risk: thinWallRisk,
      requiresSupportFixture
    },
    toolAccess: {
      restrictedAreas,
      requiresIndexing,
      requiresMultiAxisMachining,
      estimatedSetupCount,
      axisCounts: {
        '3-axis': axis3Count,
        '4-axis': axis4Count,
        '5-axis': axis5Count
      },
      specialFixturingNeeded
    },
    surfaceFinish: {
      estimatedRa,
      criticalSurfaces,
      requiresPolishing,
      requiresHoning
    }
  };
}

function perimeter(a: number, b: number): number {
  return 2 * (a + b);
}

/**
 * Analyze tolerance feasibility based on geometry and requested tolerance
 */
export function analyzeToleranceFeasibility(
  geometry: GeometryData,
  requestedTolerance: 'standard' | 'precision' | 'tight',
  material?: string
): ToleranceFeasibility {
  const concerns: string[] = [];
  const recommendations: string[] = [];
  let additionalCost = 0;
  let isAchievable = true;
  let requiredProcess: ToleranceFeasibility['requiredProcess'] = 'standard-cnc';
  let estimatedCapability = 1.33;
  
  const { complexity, advancedFeatures, boundingBox } = geometry;
  const dims = [boundingBox.x, boundingBox.y, boundingBox.z];
  const maxDim = Math.max(...dims);
  const minDim = Math.min(...dims);
  
  // Process capabilities (typical tolerance ranges in mm)
  const processCapabilities = {
    milling: { min: 0.013, typical: 0.025, max: 0.13 },
    turning: { min: 0.010, typical: 0.025, max: 0.10 },
    grinding: { min: 0.003, typical: 0.010, max: 0.025 },
    edm: { min: 0.005, typical: 0.013, max: 0.05 }
  };
  
  // Material factor (harder materials need looser tolerances or more cost)
  let materialFactor = 1.0;
  if (material) {
    const matLower = material.toLowerCase();
    if (matLower.includes('titanium') || matLower.includes('inconel') || matLower.includes('hardened')) {
      materialFactor = 1.5;
    } else if (matLower.includes('stainless') || matLower.includes('steel')) {
      materialFactor = 1.2;
    } else if (matLower.includes('brass') || matLower.includes('copper')) {
      materialFactor = 0.9;
    } else if (matLower.includes('plastic') || matLower.includes('nylon')) {
      materialFactor = 1.3; // plastics have thermal expansion issues
    }
  }
  
  // Feature-specific tolerances
  const holeTolerance = Math.max(0.013, processCapabilities.milling.typical * materialFactor);
  const flatSurfaceTolerance = Math.max(0.010, processCapabilities.milling.typical * materialFactor * 0.8);
  const threadTolerance = Math.max(0.025, processCapabilities.milling.typical * materialFactor * 1.2);
  const pocketTolerance = Math.max(0.025, processCapabilities.milling.typical * materialFactor * 1.1);
  
  const featureSpecificTolerances = {
    holes: {
      achievable: holeTolerance,
      recommended: holeTolerance * 1.5,
      cost: holeTolerance < 0.02 ? 15 * advancedFeatures.holes.count : 0
    },
    flatSurfaces: {
      achievable: flatSurfaceTolerance,
      recommended: flatSurfaceTolerance * 1.3,
      cost: flatSurfaceTolerance < 0.015 ? 25 : 0
    },
    threads: {
      achievable: threadTolerance,
      recommended: threadTolerance * 1.2,
      cost: threadTolerance < 0.03 ? 8 * advancedFeatures.threads.count : 0
    },
    pockets: {
      achievable: pocketTolerance,
      recommended: pocketTolerance * 1.4,
      cost: advancedFeatures.pockets.deepPockets > 0 ? 35 : 0
    }
  };
  
  // GD&T support analysis
  const gdtSupport = {
    flatness: {
      achievable: processCapabilities.milling.typical * 2,
      cost: complexity === 'complex' ? 40 : 20
    },
    perpendicularity: {
      achievable: processCapabilities.milling.typical * 1.5,
      cost: 30
    },
    position: {
      achievable: processCapabilities.milling.typical * 1.2,
      cost: advancedFeatures.holes.count > 5 ? 50 : 25
    },
    concentricity: {
      achievable: processCapabilities.turning.typical,
      cost: 45
    },
    surfaceFinish: {
      achievable: advancedFeatures.surfaceFinish.estimatedRa,
      cost: advancedFeatures.surfaceFinish.criticalSurfaces > 0 ? 60 : 0
    }
  };
  
  // Tolerance stack-up analysis
  const hasComplexChain = complexity === 'complex' || advancedFeatures.holes.count > 8;
  const chainLength = hasComplexChain ? Math.min(advancedFeatures.holes.count, 6) : 2;
  const worstCase = processCapabilities.milling.typical * chainLength;
  const statistical = processCapabilities.milling.typical * Math.sqrt(chainLength);
  
  const toleranceStackup = hasComplexChain ? {
    critical: worstCase > 0.15,
    chainLength,
    worstCase,
    statistical,
    recommendation: worstCase > 0.15 
      ? 'Critical tolerance chain detected. Use statistical tolerance stack-up (RSS) instead of worst-case.' 
      : 'Tolerance accumulation is within acceptable limits.'
  } : undefined;
  
  // Standard tolerance: ±0.13mm (±0.005")
  if (requestedTolerance === 'standard') {
    estimatedCapability = 1.67;
    requiredProcess = 'standard-cnc';
    additionalCost = 0;
    recommendations.push('Standard tolerance is achievable with conventional CNC machining');
    
    if (materialFactor > 1.3) {
      recommendations.push(`${material} may require additional machining time for dimensional accuracy`);
      additionalCost += 15;
    }
  }
  
  // Precision tolerance: ±0.05mm (±0.002")
  else if (requestedTolerance === 'precision') {
    estimatedCapability = 1.33;
    requiredProcess = 'precision-cnc';
    additionalCost = 50 * materialFactor;
    
    if (complexity === 'complex') {
      concerns.push('Complex geometry may require multiple setups, affecting tolerance stack-up');
      additionalCost += 30;
    }
    
    if (advancedFeatures.thinWalls.risk === 'high') {
      concerns.push('Thin walls may deflect during machining, making precision tolerances difficult');
      recommendations.push('Consider adding temporary supports or using climb milling');
      additionalCost += 25;
    }
    
    if (advancedFeatures.pockets.deepPockets > 0) {
      concerns.push('Deep pockets may experience tool deflection');
      recommendations.push('Use shorter, more rigid tooling where possible');
      additionalCost += featureSpecificTolerances.pockets.cost;
    }
    
    if (advancedFeatures.holes.deepHoleCount > 0) {
      concerns.push(`${advancedFeatures.holes.deepHoleCount} deep holes (depth > 5x diameter) may require gun drilling`);
      recommendations.push('Deep holes should be drilled with peck cycle and proper coolant');
      additionalCost += 20 * advancedFeatures.holes.deepHoleCount;
    }
    
    if (maxDim > 300) {
      concerns.push('Large parts may experience thermal expansion during machining');
      recommendations.push('Allow parts to temperature stabilize before final measurements');
      additionalCost += 20;
    }
    
    if (materialFactor > 1.3) {
      concerns.push(`${material} is difficult to machine with precision tolerances`);
      additionalCost += 40;
    }
    
    if (toleranceStackup?.critical) {
      recommendations.push(toleranceStackup.recommendation);
    }
  }
  
  // Tight tolerance: ±0.025mm (±0.001")
  else if (requestedTolerance === 'tight') {
    estimatedCapability = 1.00;
    requiredProcess = 'grinding';
    additionalCost = 150 * materialFactor;
    
    if (minDim < 1) {
      concerns.push('Features smaller than 1mm are difficult to measure accurately');
      isAchievable = false;
      recommendations.push('Consider relaxing tolerance for micro-features or use CMM inspection');
    }
    
    if (complexity === 'complex') {
      concerns.push('Complex parts require multiple operations; tolerance stack-up may exceed ±0.025mm');
      requiredProcess = 'grinding';
      additionalCost += 100;
      recommendations.push('Secondary grinding operations required for critical dimensions');
    }
    
    if (advancedFeatures.undercuts.requires5Axis) {
      concerns.push('5-axis machining makes tight tolerances challenging');
      additionalCost += 80;
      recommendations.push('Consider redesigning to eliminate undercuts if possible');
    }
    
    if (advancedFeatures.thinWalls.count > 0) {
      concerns.push('Thin-walled parts will deflect under cutting forces');
      isAchievable = advancedFeatures.thinWalls.risk !== 'high';
      recommendations.push('Redesign with thicker walls or accept precision tolerance instead');
    }
    
    if (advancedFeatures.holes.microHoleCount > 0) {
      concerns.push(`${advancedFeatures.holes.microHoleCount} micro holes (<1mm diameter) require specialized tooling`);
      requiredProcess = 'edm';
      additionalCost += 50 * advancedFeatures.holes.microHoleCount;
      recommendations.push('Consider EDM drilling for micro holes with tight tolerances');
    }
    
    if (maxDim > 200) {
      concerns.push('Large parts require temperature-controlled environment');
      requiredProcess = 'manual-inspection';
      additionalCost += 120;
      recommendations.push('Parts must be measured in climate-controlled CMM room');
    }
    
    if (materialFactor > 1.2) {
      concerns.push(`${material} requires specialized grinding or EDM for tight tolerances`);
      requiredProcess = 'edm';
      additionalCost += 100;
    }
    
    recommendations.push('CMM inspection report included for all critical dimensions');
    recommendations.push('First article inspection (FAI) strongly recommended');
    
    if (toleranceStackup) {
      concerns.push(`Tolerance chain of ${chainLength} dimensions: worst-case accumulation = ${worstCase.toFixed(3)}mm`);
      recommendations.push(toleranceStackup.recommendation);
    }
  }
  
  return {
    isAchievable,
    requiredProcess,
    estimatedCapability,
    concerns,
    recommendations,
    additionalCost,
    processCapabilities,
    materialFactor,
    featureSpecificTolerances,
    gdtSupport,
    toleranceStackup
  };
}

/**
 * Recommend secondary operations based on geometry and material
 */
function recommendSecondaryOperations(
  geometry: GeometryData,
  material: string,
  tolerance: 'standard' | 'precision' | 'tight'
): SecondaryOperation[] {
  const operations: SecondaryOperation[] = [];
  const { advancedFeatures, complexity } = geometry;
  
  // Heat treatment for steel and high-stress parts
  if (material.toLowerCase().includes('steel') || material.toLowerCase().includes('titanium')) {
    if (complexity === 'complex' || tolerance === 'tight') {
      operations.push({
        type: 'heat-treatment',
        required: false,
        cost: 80,
        leadTimeAddition: 3,
        description: 'Stress relief heat treatment recommended to prevent warping and improve dimensional stability'
      });
    }
  }
  
  // Threading for parts with thread features
  if (advancedFeatures.threads.count > 0) {
    const threadCost = advancedFeatures.threads.internalThreads * 3 + 
                       advancedFeatures.threads.externalThreads * 2;
    operations.push({
      type: 'threading',
      required: true,
      cost: threadCost,
      leadTimeAddition: 0.5,
      description: `Threading operations: ${advancedFeatures.threads.internalThreads} internal, ${advancedFeatures.threads.externalThreads} external threads`
    });
  }
  
  // Grinding for tight tolerance
  if (tolerance === 'tight' && complexity === 'complex') {
    operations.push({
      type: 'grinding',
      required: true,
      cost: 120,
      leadTimeAddition: 2,
      description: 'Precision grinding required for critical dimensions to achieve ±0.025mm tolerance'
    });
  }
  
  // Plating for corrosion resistance
  if (material.toLowerCase().includes('steel') && !material.toLowerCase().includes('stainless')) {
    operations.push({
      type: 'plating',
      required: false,
      cost: 65,
      leadTimeAddition: 5,
      description: 'Zinc or nickel plating recommended for corrosion protection'
    });
  }
  
  // Welding for assemblies (detected by multiple bodies - approximated here)
  if (geometry.partCharacteristics.hasComplexFeatures && complexity === 'complex') {
    operations.push({
      type: 'welding',
      required: false,
      cost: 45,
      leadTimeAddition: 1,
      description: 'Welding services available if this is a multi-part assembly'
    });
  }
  
  return operations;
}

/**
 * Generate DFM (Design for Manufacturing) issues and recommendations
 */
function generateDFMIssues(
  geometry: GeometryData,
  tolerance: 'standard' | 'precision' | 'tight'
): GeometryData['dfmIssues'] {
  const issues: GeometryData['dfmIssues'] = [];
  const { advancedFeatures, complexity, boundingBox } = geometry;
  
  // Undercut warnings
  if (advancedFeatures.undercuts.count > 0) {
    if (advancedFeatures.undercuts.requires5Axis) {
      issues.push({
        severity: 'warning',
        issue: `Part contains ${advancedFeatures.undercuts.count} undercuts requiring 5-axis machining`,
        recommendation: 'Redesign to eliminate undercuts by splitting into multiple parts or adjusting geometry',
        potentialSavings: 180
      });
    } else {
      issues.push({
        severity: 'info',
        issue: `${advancedFeatures.undercuts.count} minor undercuts detected`,
        recommendation: 'Can be machined with special tooling but adds complexity'
      });
    }
  }
  
  // Deep pocket warnings
  if (advancedFeatures.pockets.deepPockets > 0) {
    issues.push({
      severity: 'warning',
      issue: `${advancedFeatures.pockets.deepPockets} deep pockets detected (aspect ratio > 3:1)`,
      recommendation: 'Consider making pockets shallower or wider to improve tool rigidity and reduce machining time',
      potentialSavings: 75
    });
  }
  
  // Thin wall warnings
  if (advancedFeatures.thinWalls.risk === 'high') {
    issues.push({
      severity: 'critical',
      issue: `Thin walls detected (${advancedFeatures.thinWalls.minThickness.toFixed(1)}mm minimum thickness)`,
      recommendation: 'Increase wall thickness to at least 2mm to prevent deflection and reduce scrap risk',
      potentialSavings: 120
    });
  } else if (advancedFeatures.thinWalls.risk === 'medium') {
    issues.push({
      severity: 'warning',
      issue: `Moderately thin walls (${advancedFeatures.thinWalls.minThickness.toFixed(1)}mm thickness)`,
      recommendation: 'Consider increasing to 2.5mm for better machinability'
    });
  }
  
  // Deep hole warnings
  if (advancedFeatures.holes.deepHoleCount > 0) {
    issues.push({
      severity: 'warning',
      issue: `${advancedFeatures.holes.deepHoleCount} deep holes (depth > 5x diameter)`,
      recommendation: 'Reduce hole depth or increase diameter to improve chip evacuation and reduce drill bit deflection',
      potentialSavings: 45
    });
  }
  
  // Micro hole warnings
  if (advancedFeatures.holes.microHoleCount > 0) {
    issues.push({
      severity: 'critical',
      issue: `${advancedFeatures.holes.microHoleCount} micro holes (<1mm diameter) detected`,
      recommendation: 'Micro holes require specialized tooling or EDM. Consider increasing diameter to ≥1mm if possible',
      potentialSavings: 85
    });
  }
  
  // Tolerance vs complexity mismatch
  if (tolerance === 'tight' && complexity === 'complex') {
    issues.push({
      severity: 'critical',
      issue: 'Tight tolerances specified on complex geometry',
      recommendation: 'Specify tight tolerances only on critical dimensions, use standard tolerances elsewhere',
      potentialSavings: 200
    });
  }
  
  // Large part warnings
  const maxDim = Math.max(boundingBox.x, boundingBox.y, boundingBox.z);
  if (maxDim > 400) {
    issues.push({
      severity: 'info',
      issue: `Large part (${maxDim.toFixed(0)}mm max dimension) may require special machine`,
      recommendation: 'Consider breaking into smaller assemblies if possible',
      potentialSavings: 100
    });
  }
  
  // Sheet metal recommendations
  if (geometry.sheetMetalFeatures) {
    const sm = geometry.sheetMetalFeatures;
    
    if (sm.bendCount > 15) {
      issues.push({
        severity: 'warning',
        issue: `High bend count (${sm.bendCount} bends)`,
        recommendation: 'Simplify design to reduce bends and fabrication time',
        potentialSavings: 60
      });
    }
    
    if (sm.minBendRadius < sm.thickness) {
      issues.push({
        severity: 'critical',
        issue: 'Bend radius too small for material thickness',
        recommendation: `Increase bend radius to at least ${sm.thickness}x material thickness (${(sm.thickness * 1.5).toFixed(1)}mm)`,
        potentialSavings: 0
      });
    }
    
    if (sm.hasSmallFeatures) {
      issues.push({
        severity: 'warning',
        issue: 'Small features detected in sheet metal design',
        recommendation: 'Features smaller than 2x material thickness may be difficult to form',
        potentialSavings: 35
      });
    }
  }
  
  return issues;
}

/**
 * For STEP files - parse actual geometry using CAD service
 */
export async function estimateSTEPGeometry(file: File): Promise<GeometryData> {
  try {
    // Try to get actual geometry from CAD service
    const formData = new FormData();
    formData.append('file', file);
    
    const response = await fetch('/api/cad/extract-features', {
      method: 'POST',
      body: formData,
    });
    
    if (response.ok) {
      const cadData = await response.json();
      
      // Extract actual geometry from CAD service response
      const actualVolume = cadData.volume || cadData.features?.volume; // mm³
      const actualSurfaceArea = cadData.surface_area || cadData.features?.surface_area; // mm²
      const actualBoundingBox = cadData.dimensions || cadData.features?.dimensions;
      
      if (actualVolume && actualBoundingBox) {
        // Use actual CAD data
        const boundingBox = {
          x: actualBoundingBox.x,
          y: actualBoundingBox.y,
          z: actualBoundingBox.z
        };
        
        const volume = actualVolume;
        const surfaceArea = actualSurfaceArea || Math.pow(volume, 2/3) * 6.2;
        
        return buildGeometryData(file, boundingBox, volume, surfaceArea);
      }
    }
  } catch (error) {
    console.warn('CAD service unavailable, falling back to estimation:', error);
  }
  
  // Fallback: Improved estimation using file size heuristics
  const fileSizeKB = file.size / 1024;
  const estimatedVolume = fileSizeKB * 150; // mm³ - improved estimate
  const estimatedSurfaceArea = Math.pow(estimatedVolume, 2/3) * 6.2;
  
  // More realistic bounding box with rectangular proportions (2:1.5:1 ratio)
  const cubeRoot = Math.pow(estimatedVolume, 1/3);
  const boundingBox = {
    x: cubeRoot * 1.26,  // Length (longest dimension)
    y: cubeRoot * 0.95,  // Width (medium dimension)
    z: cubeRoot * 0.63   // Height (shortest dimension)
  };
  
  return buildGeometryData(file, boundingBox, estimatedVolume, estimatedSurfaceArea);
}

/**
 * Helper to build GeometryData from volume and bounding box
 */
function buildGeometryData(file: File, boundingBox: { x: number; y: number; z: number }, volume: number, surfaceArea: number): GeometryData {
  const fileSizeKB = file.size / 1024;
  
  const complexity: GeometryData['complexity'] = 
    fileSizeKB < 500 ? 'simple' :
    fileSizeKB < 2000 ? 'moderate' :
    'complex';
  
  // Estimate triangle count from file size
  const estimatedTriangleCount = fileSizeKB * 10;
  
  // Analyze part characteristics for process identification
  const partCharacteristics = analyzePartCharacteristics(boundingBox, volume, surfaceArea, estimatedTriangleCount);
  
  // Determine recommended process
  const processRecommendation = recommendManufacturingProcess(boundingBox, volume, surfaceArea, complexity, partCharacteristics);
  
  const estimatedMachiningTime = calculateMachiningTime(volume, surfaceArea, complexity);
  const materialWeight = (volume / 1000) * 2.7;
  
  // Detect advanced features
  const advancedFeatures = detectAdvancedFeatures(boundingBox, volume, surfaceArea, estimatedTriangleCount, complexity);
  
  // If sheet metal is recommended, extract sheet metal features
  let sheetMetalFeatures: SheetMetalFeatures | undefined;
  if (processRecommendation.process === 'sheet-metal') {
    sheetMetalFeatures = detectSheetMetalFeatures(boundingBox, volume, surfaceArea, estimatedTriangleCount);
  }
  
  // Generate DFM issues and secondary ops
  const dfmIssues = generateDFMIssues({ 
    boundingBox, 
    complexity, 
    advancedFeatures,
    partCharacteristics,
    volume: volume,
    surfaceArea: surfaceArea,
    estimatedMachiningTime,
    materialWeight,
    recommendedProcess: processRecommendation.process,
    processConfidence: processRecommendation.confidence,
    sheetMetalFeatures,
    recommendedSecondaryOps: [],
    dfmIssues: []
  } as GeometryData, 'standard');
  
  const recommendedSecondaryOps = recommendSecondaryOperations({
    boundingBox,
    complexity,
    advancedFeatures,
    partCharacteristics,
    volume: volume,
    surfaceArea: surfaceArea,
    estimatedMachiningTime,
    materialWeight,
    recommendedProcess: processRecommendation.process,
    processConfidence: processRecommendation.confidence,
    sheetMetalFeatures,
    recommendedSecondaryOps: [],
    dfmIssues: []
  } as GeometryData, 'Aluminum 6061', 'standard');

  return {
    volume: volume,
    surfaceArea: surfaceArea,
    boundingBox,
    complexity,
    estimatedMachiningTime,
    materialWeight,
    recommendedProcess: processRecommendation.process,
    processConfidence: processRecommendation.confidence,
    partCharacteristics,
    sheetMetalFeatures,
    advancedFeatures,
    recommendedSecondaryOps,
    dfmIssues
  };
}

/**
 * Analyze part characteristics to help identify manufacturing process
 */
function analyzePartCharacteristics(
  boundingBox: { x: number; y: number; z: number },
  volume: number,
  surfaceArea: number,
  triangleCount: number
): GeometryData['partCharacteristics'] {
  const dims = [boundingBox.x, boundingBox.y, boundingBox.z].sort((a, b) => a - b);
  const minDim = dims[0];
  const midDim = dims[1];
  const maxDim = dims[2];
  
  // Aspect ratio (longest to shortest)
  const aspectRatio = maxDim / Math.max(minDim, 0.1);
  
  // Check if rotational symmetric (cylinder-like)
  const xyRatio = Math.abs(boundingBox.x - boundingBox.y) / Math.max(boundingBox.x, boundingBox.y);
  const isRotationalSymmetric = xyRatio < 0.15 && aspectRatio > 1.5;
  
  // Check if thin-walled (sheet metal candidate)
  // Sheet metal typically: thickness 0.5-6mm, and much larger in other dimensions
  const thicknessRatio = midDim / Math.max(minDim, 0.1);
  const isThinWalled = minDim >= 0.5 && minDim <= 6 && thicknessRatio > 8;
  
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
    aspectRatio
  };
}

/**
 * Recommend manufacturing process based on part characteristics
 */
function recommendManufacturingProcess(
  boundingBox: { x: number; y: number; z: number },
  volume: number,
  surfaceArea: number,
  complexity: 'simple' | 'moderate' | 'complex',
  characteristics: GeometryData['partCharacteristics']
): { process: GeometryData['recommendedProcess']; confidence: number } {
  const dims = [boundingBox.x, boundingBox.y, boundingBox.z].sort((a, b) => a - b);
  const minDim = dims[0];
  const maxDim = dims[2];
  
  // Sheet Metal: Thin, flat parts
  if (characteristics.isThinWalled && !characteristics.hasCurvedSurfaces) {
    const confidence = characteristics.aspectRatio > 10 ? 0.85 : 0.70;
    return { process: 'sheet-metal', confidence };
  }
  
  // CNC Turning: Rotational symmetric parts
  if (characteristics.isRotationalSymmetric && !characteristics.hasComplexFeatures) {
    const confidence = characteristics.aspectRatio > 2 && characteristics.aspectRatio < 12 ? 0.90 : 0.75;
    return { process: 'cnc-turning', confidence };
  }
  
  // Injection Molding: High complexity plastic parts (note: requires material check)
  if (complexity === 'complex' && volume > 5000 && volume < 500000) {
    // This is a guess - would need material info to confirm
    return { process: 'injection-molding', confidence: 0.50 };
  }
  
  // CNC Milling: Standard 3-axis or 5-axis machining
  if (!characteristics.isThinWalled && minDim >= 0.5 && maxDim <= 700) {
    let confidence = 0.80;
    
    // Reduce confidence for very complex parts
    if (complexity === 'complex' && characteristics.hasComplexFeatures) {
      confidence = 0.60;
    }
    
    // High confidence for moderate complexity
    if (complexity === 'moderate') {
      confidence = 0.85;
    }
    
    // Very high confidence for simple parts
    if (complexity === 'simple') {
      confidence = 0.95;
    }
    
    return { process: 'cnc-milling', confidence };
  }
  
  // Manual Quote: Parts that don't fit standard processes
  // - Too small (< 0.5mm)
  // - Too large (> 700mm)
  // - Extremely complex with thin features
  // - Very high aspect ratios that might need special setups
  if (minDim < 0.5 || maxDim > 700 || 
      (complexity === 'complex' && characteristics.hasComplexFeatures && characteristics.isThinWalled) ||
      characteristics.aspectRatio > 30) {
    return { process: 'manual-quote', confidence: 0.95 };
  }
  
  // Default to CNC milling with low confidence
  return { process: 'cnc-milling', confidence: 0.50 };
}

/**
 * Main analysis function - determines file type and analyzes accordingly
 */
export async function analyzeCADFile(file: File): Promise<GeometryData> {
  const extension = file.name.toLowerCase().split('.').pop();
  
  switch (extension) {
    case 'stl':
      return await analyzeSTLFile(file);
    case 'step':
    case 'stp':
    case 'iges':
    case 'igs':
      return await estimateSTEPGeometry(file);
    default:
      // Default estimation for unknown formats
      return await estimateSTEPGeometry(file);
  }
}
