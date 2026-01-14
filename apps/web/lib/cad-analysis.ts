/**
 * Real CAD Analysis Utilities
 * Extracts geometry data from CAD files for pricing calculations
 */

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
  
  // Analyze part characteristics for process identification
  const partCharacteristics = analyzePartCharacteristics(boundingBox, volume, surfaceArea, triangleCount);
  
  // Determine recommended process
  const processRecommendation = recommendManufacturingProcess(boundingBox, volume, surfaceArea, complexity, partCharacteristics);
  
  // Estimate machining time (simplified)
  const estimatedMachiningTime = calculateMachiningTime(volume, surfaceArea, complexity);
  
  // Calculate material weight (using default aluminum density: 2.7 g/cm³)
  const materialWeight = (volume / 1000) * 2.7; // Convert mm³ to cm³, then to grams
  
  return {
    volume,
    surfaceArea,
    boundingBox,
    complexity,
    estimatedMachiningTime,
    materialWeight,
    recommendedProcess: processRecommendation.process,
    processConfidence: processRecommendation.confidence,
    partCharacteristics
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
  
  return {
    volume,
    surfaceArea,
    boundingBox,
    complexity,
    estimatedMachiningTime,
    materialWeight,
    recommendedProcess: processRecommendation.process,
    processConfidence: processRecommendation.confidence,
    partCharacteristics
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
 * For STEP files - simplified estimation
 */
export function estimateSTEPGeometry(file: File): GeometryData {
  // STEP files require complex CAD kernel parsing
  // For demo purposes, estimate based on file size
  const fileSizeKB = file.size / 1024;
  
  // Rough heuristic: larger files = more complex parts
  const estimatedVolume = fileSizeKB * 100; // Very rough estimate
  const estimatedSurfaceArea = Math.pow(estimatedVolume, 2/3) * 6;
  
  const boundingBox = {
    x: Math.pow(estimatedVolume, 1/3),
    y: Math.pow(estimatedVolume, 1/3),
    z: Math.pow(estimatedVolume, 1/3)
  };
  
  const complexity: GeometryData['complexity'] = 
    fileSizeKB < 500 ? 'simple' :
    fileSizeKB < 2000 ? 'moderate' :
    'complex';
  
  // Estimate triangle count from file size
  const estimatedTriangleCount = fileSizeKB * 10;
  
  // Analyze part characteristics for process identification
  const partCharacteristics = analyzePartCharacteristics(boundingBox, estimatedVolume, estimatedSurfaceArea, estimatedTriangleCount);
  
  // Determine recommended process
  const processRecommendation = recommendManufacturingProcess(boundingBox, estimatedVolume, estimatedSurfaceArea, complexity, partCharacteristics);
  
  const estimatedMachiningTime = calculateMachiningTime(estimatedVolume, estimatedSurfaceArea, complexity);
  const materialWeight = (estimatedVolume / 1000) * 2.7;
  
  return {
    volume: estimatedVolume,
    surfaceArea: estimatedSurfaceArea,
    boundingBox,
    complexity,
    estimatedMachiningTime,
    materialWeight,
    recommendedProcess: processRecommendation.process,
    processConfidence: processRecommendation.confidence,
    partCharacteristics
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
  const isThinWalled = minDim < 6 && (midDim > 50 || maxDim > 50);
  
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
      return estimateSTEPGeometry(file);
    default:
      // Default estimation for unknown formats
      return estimateSTEPGeometry(file);
  }
}
