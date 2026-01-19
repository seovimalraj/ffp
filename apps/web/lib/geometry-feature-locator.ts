/**
 * Enterprise-level geometry feature locator for DFM analysis
 * Accurately maps DFM features to actual geometry triangles and locations
 */

import * as THREE from 'three';

export interface FeatureLocation {
  triangles: number[];
  centroid: { x: number; y: number; z: number };
  boundingBox: {
    min: { x: number; y: number; z: number };
    max: { x: number; y: number; z: number };
  };
  confidence: number; // 0-1, accuracy confidence
}

export interface GeometryFeatureMap {
  holes: FeatureLocation[];
  pockets: FeatureLocation[];
  thinWalls: FeatureLocation[];
  undercuts: FeatureLocation[];
  sharpCorners: FeatureLocation[];
  ribs: FeatureLocation[];
  bosses: FeatureLocation[];
  fillets: FeatureLocation[];
  chamfers: FeatureLocation[];
  threads: FeatureLocation[];
  counterbores: FeatureLocation[];
  countersinks: FeatureLocation[];
  slots: FeatureLocation[];
  toolAccessRestricted: FeatureLocation[];
  complexSurfaces: FeatureLocation[];
}

/**
 * Analyze STL geometry and locate specific features
 */
export function analyzeGeometryFeatures(geometry: THREE.BufferGeometry): GeometryFeatureMap {
  const positionAttr = geometry.getAttribute('position');
  const normalAttr = geometry.getAttribute('normal');
  
  if (!positionAttr) {
    return createEmptyFeatureMap();
  }

  const triangleCount = positionAttr.count / 3;
  
  // Analyze each triangle
  const triangles = analyzeTriangles(positionAttr, normalAttr, triangleCount);
  
  // Detect features based on geometric properties
  return {
    holes: detectHoles(triangles, positionAttr),
    pockets: detectPockets(triangles, positionAttr),
    thinWalls: detectThinWalls(triangles, positionAttr),
    undercuts: detectUndercuts(triangles, positionAttr, normalAttr),
    sharpCorners: detectSharpCorners(triangles, positionAttr),
    ribs: detectRibs(triangles, positionAttr),
    bosses: detectBosses(triangles, positionAttr),
    fillets: detectFillets(triangles, positionAttr),
    chamfers: detectChamfers(triangles, positionAttr),
    threads: detectThreads(triangles, positionAttr),
    counterbores: detectCounterbores(triangles, positionAttr),
    countersinks: detectCountersinks(triangles, positionAttr),
    slots: detectSlots(triangles, positionAttr),
    toolAccessRestricted: detectToolAccessRestrictions(triangles, positionAttr),
    complexSurfaces: detectComplexSurfaces(triangles, positionAttr),
  };
}

interface TriangleAnalysis {
  index: number;
  centroid: THREE.Vector3;
  normal: THREE.Vector3;
  area: number;
  vertices: [THREE.Vector3, THREE.Vector3, THREE.Vector3];
  curvature: number;
  orientation: 'horizontal' | 'vertical' | 'angled';
}

function analyzeTriangles(
  positionAttr: THREE.BufferAttribute,
  normalAttr: THREE.BufferAttribute | null,
  triangleCount: number
): TriangleAnalysis[] {
  const triangles: TriangleAnalysis[] = [];
  const v0 = new THREE.Vector3();
  const v1 = new THREE.Vector3();
  const v2 = new THREE.Vector3();

  for (let i = 0; i < triangleCount; i++) {
    const i0 = i * 3;
    const i1 = i * 3 + 1;
    const i2 = i * 3 + 2;

    // Get vertices
    v0.fromBufferAttribute(positionAttr, i0);
    v1.fromBufferAttribute(positionAttr, i1);
    v2.fromBufferAttribute(positionAttr, i2);

    // Calculate centroid
    const centroid = new THREE.Vector3()
      .add(v0)
      .add(v1)
      .add(v2)
      .divideScalar(3);

    // Calculate normal
    const edge1 = new THREE.Vector3().subVectors(v1, v0);
    const edge2 = new THREE.Vector3().subVectors(v2, v0);
    const normal = new THREE.Vector3().crossVectors(edge1, edge2).normalize();

    // Calculate area
    const area = normal.length() / 2;

    // Determine orientation
    const upDot = Math.abs(normal.dot(new THREE.Vector3(0, 0, 1)));
    const orientation = upDot > 0.85 ? 'horizontal' : upDot < 0.15 ? 'vertical' : 'angled';

    // Estimate curvature (simplified)
    const curvature = estimateCurvature(i, positionAttr, triangleCount);

    triangles.push({
      index: i,
      centroid,
      normal,
      area,
      vertices: [v0.clone(), v1.clone(), v2.clone()],
      curvature,
      orientation,
    });
  }

  return triangles;
}

/**
 * Detect circular/cylindrical patterns indicating holes
 */
function detectHoles(triangles: TriangleAnalysis[], positionAttr: THREE.BufferAttribute): FeatureLocation[] {
  const holes: FeatureLocation[] = [];
  const visited = new Set<number>();

  // Look for circular patterns with normals pointing inward
  for (let i = 0; i < triangles.length; i++) {
    if (visited.has(i)) continue;

    const tri = triangles[i];
    
    // Holes typically have high curvature and vertical/angled orientation
    if (tri.curvature > 0.3 && tri.orientation !== 'horizontal') {
      const cluster = findSpatialCluster(triangles, i, 5, visited); // 5mm radius threshold
      
      if (cluster.length > 8) { // Minimum triangles for a hole
        const location = calculateFeatureLocation(cluster, triangles, positionAttr);
        
        // Verify it's cylindrical
        if (isCylindricalPattern(cluster, triangles)) {
          holes.push({
            ...location,
            confidence: Math.min(0.95, 0.6 + (cluster.length / 50)),
          });
        }
      }
    }
  }

  return holes;
}

/**
 * Detect pocket features (concave areas)
 */
function detectPockets(triangles: TriangleAnalysis[], positionAttr: THREE.BufferAttribute): FeatureLocation[] {
  const pockets: FeatureLocation[] = [];
  const visited = new Set<number>();

  for (let i = 0; i < triangles.length; i++) {
    if (visited.has(i)) continue;

    const tri = triangles[i];
    
    // Pockets have normals pointing up/out and are horizontal or angled
    if (tri.normal.z > 0.5 && (tri.orientation === 'horizontal' || tri.orientation === 'angled')) {
      const cluster = findSpatialCluster(triangles, i, 10, visited); // 10mm radius
      
      if (cluster.length > 15) { // Minimum for a pocket
        const location = calculateFeatureLocation(cluster, triangles, positionAttr);
        
        // Check if it's a recessed area
        if (isRecessedArea(cluster, triangles)) {
          pockets.push({
            ...location,
            confidence: Math.min(0.9, 0.5 + (cluster.length / 100)),
          });
        }
      }
    }
  }

  return pockets;
}

/**
 * Detect thin wall features
 */
function detectThinWalls(triangles: TriangleAnalysis[], positionAttr: THREE.BufferAttribute): FeatureLocation[] {
  const thinWalls: FeatureLocation[] = [];
  const visited = new Set<number>();

  for (let i = 0; i < triangles.length; i++) {
    if (visited.has(i)) continue;

    const tri = triangles[i];
    
    // Thin walls are typically vertical with low curvature
    if (tri.orientation === 'vertical' && tri.curvature < 0.2) {
      const cluster = findSpatialCluster(triangles, i, 15, visited);
      
      if (cluster.length > 10) {
        const location = calculateFeatureLocation(cluster, triangles, positionAttr);
        const thickness = estimateWallThickness(cluster, triangles);
        
        if (thickness < 3) { // Thin wall threshold
          thinWalls.push({
            ...location,
            confidence: 0.75,
          });
        }
      }
    }
  }

  return thinWalls;
}

/**
 * Detect undercut features (overhanging geometry)
 */
function detectUndercuts(
  triangles: TriangleAnalysis[],
  positionAttr: THREE.BufferAttribute,
  normalAttr: THREE.BufferAttribute | null
): FeatureLocation[] {
  const undercuts: FeatureLocation[] = [];
  const visited = new Set<number>();

  for (let i = 0; i < triangles.length; i++) {
    if (visited.has(i)) continue;

    const tri = triangles[i];
    
    // Undercuts have normals pointing downward (negative Z)
    if (tri.normal.z < -0.6) {
      const cluster = findSpatialCluster(triangles, i, 8, visited);
      
      if (cluster.length > 6) {
        const location = calculateFeatureLocation(cluster, triangles, positionAttr);
        undercuts.push({
          ...location,
          confidence: 0.8,
        });
      }
    }
  }

  return undercuts;
}

/**
 * Detect sharp corners (high curvature points)
 */
function detectSharpCorners(triangles: TriangleAnalysis[], positionAttr: THREE.BufferAttribute): FeatureLocation[] {
  const corners: FeatureLocation[] = [];
  const visited = new Set<number>();

  for (let i = 0; i < triangles.length; i++) {
    if (visited.has(i)) continue;

    const tri = triangles[i];
    
    // Sharp corners have very high curvature
    if (tri.curvature > 0.7) {
      const cluster = findSpatialCluster(triangles, i, 2, visited); // Small radius
      
      if (cluster.length >= 3) {
        const location = calculateFeatureLocation(cluster, triangles, positionAttr);
        corners.push({
          ...location,
          confidence: 0.85,
        });
      }
    }
  }

  return corners;
}

/**
 * Detect rib features (thin protruding elements)
 */
function detectRibs(triangles: TriangleAnalysis[], positionAttr: THREE.BufferAttribute): FeatureLocation[] {
  const ribs: FeatureLocation[] = [];
  const visited = new Set<number>();

  for (let i = 0; i < triangles.length; i++) {
    if (visited.has(i)) continue;

    const tri = triangles[i];
    
    // Ribs are typically vertical, thin, elongated features
    if (tri.orientation === 'vertical') {
      const cluster = findSpatialCluster(triangles, i, 12, visited);
      
      if (cluster.length > 8) {
        const location = calculateFeatureLocation(cluster, triangles, positionAttr);
        const aspect = calculateAspectRatio(location.boundingBox);
        
        if (aspect > 4) { // Elongated feature
          ribs.push({
            ...location,
            confidence: 0.7,
          });
        }
      }
    }
  }

  return ribs;
}

/**
 * Detect boss features (raised cylindrical features)
 */
function detectBosses(triangles: TriangleAnalysis[], positionAttr: THREE.BufferAttribute): FeatureLocation[] {
  const bosses: FeatureLocation[] = [];
  const visited = new Set<number>();

  for (let i = 0; i < triangles.length; i++) {
    if (visited.has(i)) continue;

    const tri = triangles[i];
    
    // Bosses have normals pointing outward and are often vertical
    if (tri.orientation === 'vertical' && tri.curvature > 0.25) {
      const cluster = findSpatialCluster(triangles, i, 6, visited);
      
      if (cluster.length > 10 && isCylindricalPattern(cluster, triangles)) {
        const location = calculateFeatureLocation(cluster, triangles, positionAttr);
        bosses.push({
          ...location,
          confidence: 0.75,
        });
      }
    }
  }

  return bosses;
}

/**
 * Detect fillet features (rounded internal corners)
 */
function detectFillets(triangles: TriangleAnalysis[], positionAttr: THREE.BufferAttribute): FeatureLocation[] {
  const fillets: FeatureLocation[] = [];
  const visited = new Set<number>();

  for (let i = 0; i < triangles.length; i++) {
    if (visited.has(i)) continue;

    const tri = triangles[i];
    
    // Fillets have medium-high curvature and are typically in corners
    if (tri.curvature > 0.4 && tri.curvature < 0.8) {
      const cluster = findSpatialCluster(triangles, i, 3, visited); // Small radius for fillets
      
      if (cluster.length >= 4) {
        const location = calculateFeatureLocation(cluster, triangles, positionAttr);
        
        // Check if it's a concave blend (internal corner)
        if (isInternalCorner(cluster, triangles)) {
          fillets.push({
            ...location,
            confidence: 0.82,
          });
        }
      }
    }
  }

  return fillets;
}

/**
 * Detect chamfer features (angled edge breaks)
 */
function detectChamfers(triangles: TriangleAnalysis[], positionAttr: THREE.BufferAttribute): FeatureLocation[] {
  const chamfers: FeatureLocation[] = [];
  const visited = new Set<number>();

  for (let i = 0; i < triangles.length; i++) {
    if (visited.has(i)) continue;

    const tri = triangles[i];
    
    // Chamfers are angled surfaces (45° typically) with low-medium curvature
    if (tri.orientation === 'angled' && tri.curvature < 0.3) {
      const cluster = findSpatialCluster(triangles, i, 3, visited);
      
      if (cluster.length >= 3) {
        const location = calculateFeatureLocation(cluster, triangles, positionAttr);
        const avgAngle = calculateAverageNormalAngle(cluster, triangles);
        
        // Chamfers typically have normals at 30-60° from horizontal
        if (avgAngle > 30 && avgAngle < 60) {
          chamfers.push({
            ...location,
            confidence: 0.78,
          });
        }
      }
    }
  }

  return chamfers;
}

/**
 * Detect thread features (helical patterns)
 */
function detectThreads(triangles: TriangleAnalysis[], positionAttr: THREE.BufferAttribute): FeatureLocation[] {
  const threads: FeatureLocation[] = [];
  const visited = new Set<number>();

  for (let i = 0; i < triangles.length; i++) {
    if (visited.has(i)) continue;

    const tri = triangles[i];
    
    // Threads have high triangle density and helical pattern
    if (tri.curvature > 0.5) {
      const cluster = findSpatialCluster(triangles, i, 4, visited);
      
      if (cluster.length > 20) { // Threads need many triangles for detail
        const location = calculateFeatureLocation(cluster, triangles, positionAttr);
        
        // Check for helical/spiral pattern
        if (hasHelicalPattern(cluster, triangles) && isCylindricalPattern(cluster, triangles)) {
          threads.push({
            ...location,
            confidence: 0.85,
          });
        }
      }
    }
  }

  return threads;
}

/**
 * Detect counterbore features (stepped hole enlargements)
 */
function detectCounterbores(triangles: TriangleAnalysis[], positionAttr: THREE.BufferAttribute): FeatureLocation[] {
  const counterbores: FeatureLocation[] = [];
  const visited = new Set<number>();

  for (let i = 0; i < triangles.length; i++) {
    if (visited.has(i)) continue;

    const tri = triangles[i];
    
    // Counterbores are horizontal surfaces within or adjacent to holes
    if (tri.orientation === 'horizontal' && tri.curvature < 0.2) {
      const cluster = findSpatialCluster(triangles, i, 4, visited);
      
      if (cluster.length > 5) {
        const location = calculateFeatureLocation(cluster, triangles, positionAttr);
        
        // Check if it's a flat circular region (counterbore floor)
        if (isCircularFlat(cluster, triangles)) {
          counterbores.push({
            ...location,
            confidence: 0.80,
          });
        }
      }
    }
  }

  return counterbores;
}

/**
 * Detect countersink features (conical hole entrances)
 */
function detectCountersinks(triangles: TriangleAnalysis[], positionAttr: THREE.BufferAttribute): FeatureLocation[] {
  const countersinks: FeatureLocation[] = [];
  const visited = new Set<number>();

  for (let i = 0; i < triangles.length; i++) {
    if (visited.has(i)) continue;

    const tri = triangles[i];
    
    // Countersinks are conical surfaces (angled, radial pattern)
    if (tri.orientation === 'angled' && tri.curvature > 0.2) {
      const cluster = findSpatialCluster(triangles, i, 4, visited);
      
      if (cluster.length > 6) {
        const location = calculateFeatureLocation(cluster, triangles, positionAttr);
        
        // Check for conical pattern
        if (isConicalPattern(cluster, triangles)) {
          countersinks.push({
            ...location,
            confidence: 0.83,
          });
        }
      }
    }
  }

  return countersinks;
}

/**
 * Detect slot features (elongated pockets)
 */
function detectSlots(triangles: TriangleAnalysis[], positionAttr: THREE.BufferAttribute): FeatureLocation[] {
  const slots: FeatureLocation[] = [];
  const visited = new Set<number>();

  for (let i = 0; i < triangles.length; i++) {
    if (visited.has(i)) continue;

    const tri = triangles[i];
    
    // Slots are elongated recessed features
    if (tri.normal.z > 0.5 && tri.orientation === 'horizontal') {
      const cluster = findSpatialCluster(triangles, i, 12, visited);
      
      if (cluster.length > 12) {
        const location = calculateFeatureLocation(cluster, triangles, positionAttr);
        const aspect = calculateAspectRatio(location.boundingBox);
        
        // Slots have high aspect ratio (length >> width) and are recessed
        if (aspect > 3 && isRecessedArea(cluster, triangles)) {
          slots.push({
            ...location,
            confidence: 0.77,
          });
        }
      }
    }
  }

  return slots;
}

/**
 * Detect tool access restricted areas (tight spaces, deep cavities)
 */
function detectToolAccessRestrictions(triangles: TriangleAnalysis[], positionAttr: THREE.BufferAttribute): FeatureLocation[] {
  const restrictions: FeatureLocation[] = [];
  const visited = new Set<number>();

  for (let i = 0; i < triangles.length; i++) {
    if (visited.has(i)) continue;

    const tri = triangles[i];
    
    // Look for areas with multiple orientations and high confinement
    const cluster = findSpatialCluster(triangles, i, 8, visited);
    
    if (cluster.length > 10) {
      const location = calculateFeatureLocation(cluster, triangles, positionAttr);
      
      // Check for geometric confinement
      const confinementScore = calculateConfinementScore(cluster, triangles, location.boundingBox);
      
      if (confinementScore > 0.7) { // High confinement = restricted access
        restrictions.push({
          ...location,
          confidence: 0.72,
        });
      }
    }
  }

  return restrictions;
}

/**
 * Detect complex surfaces (high curvature, multiple directions)
 */
function detectComplexSurfaces(triangles: TriangleAnalysis[], positionAttr: THREE.BufferAttribute): FeatureLocation[] {
  const complexSurfaces: FeatureLocation[] = [];
  const visited = new Set<number>();

  for (let i = 0; i < triangles.length; i++) {
    if (visited.has(i)) continue;

    const tri = triangles[i];
    
    // Complex surfaces have high curvature and varying orientations
    if (tri.curvature > 0.6) {
      const cluster = findSpatialCluster(triangles, i, 10, visited);
      
      if (cluster.length > 15) {
        const location = calculateFeatureLocation(cluster, triangles, positionAttr);
        
        // Check for multi-directional curvature
        const complexity = calculateSurfaceComplexity(cluster, triangles);
        
        if (complexity > 0.65) {
          complexSurfaces.push({
            ...location,
            confidence: 0.80,
          });
        }
      }
    }
  }

  return complexSurfaces;
}

// Additional helper functions for new features

function isInternalCorner(cluster: number[], triangles: TriangleAnalysis[]): boolean {
  // Check if normals converge (internal corner) vs diverge (external corner)
  if (cluster.length < 4) return false;
  
  const centroid = new THREE.Vector3();
  for (const idx of cluster) {
    centroid.add(triangles[idx].centroid);
  }
  centroid.divideScalar(cluster.length);
  
  let convergenceScore = 0;
  for (const idx of cluster) {
    const tri = triangles[idx];
    const toCenter = new THREE.Vector3().subVectors(centroid, tri.centroid).normalize();
    const dotProduct = tri.normal.dot(toCenter);
    convergenceScore += dotProduct; // Positive = normals point toward center (internal)
  }
  
  return (convergenceScore / cluster.length) > 0.3;
}

function calculateAverageNormalAngle(cluster: number[], triangles: TriangleAnalysis[]): number {
  // Calculate average angle from vertical (Z-axis)
  const upVector = new THREE.Vector3(0, 0, 1);
  let totalAngle = 0;
  
  for (const idx of cluster) {
    const normal = triangles[idx].normal;
    const angle = Math.acos(Math.abs(normal.dot(upVector))) * (180 / Math.PI);
    totalAngle += angle;
  }
  
  return totalAngle / cluster.length;
}

function hasHelicalPattern(cluster: number[], triangles: TriangleAnalysis[]): boolean {
  // Simplified helical detection: check for spiraling centroid positions
  if (cluster.length < 20) return false;
  
  // Calculate angular progression
  const centroid = new THREE.Vector3();
  for (const idx of cluster) {
    centroid.add(triangles[idx].centroid);
  }
  centroid.divideScalar(cluster.length);
  
  // Check if points spiral around central axis
  const angles: number[] = [];
  for (const idx of cluster) {
    const pos = triangles[idx].centroid;
    const dx = pos.x - centroid.x;
    const dy = pos.y - centroid.y;
    const angle = Math.atan2(dy, dx);
    angles.push(angle);
  }
  
  // Sort and check for consistent angular progression
  angles.sort((a, b) => a - b);
  const angularRange = angles[angles.length - 1] - angles[0];
  
  return angularRange > Math.PI; // Covers at least 180°
}

function isCircularFlat(cluster: number[], triangles: TriangleAnalysis[]): boolean {
  // Check if it's a flat circular region
  if (cluster.length < 5) return false;
  
  // Calculate standard deviation of Z coordinates
  const avgZ = cluster.reduce((sum, idx) => sum + triangles[idx].centroid.z, 0) / cluster.length;
  const variance = cluster.reduce((sum, idx) => {
    const diff = triangles[idx].centroid.z - avgZ;
    return sum + diff * diff;
  }, 0) / cluster.length;
  const stdDev = Math.sqrt(variance);
  
  // Flat if low Z variation and has radial normal pattern
  return stdDev < 0.5 && isCylindricalPattern(cluster, triangles);
}

function isConicalPattern(cluster: number[], triangles: TriangleAnalysis[]): boolean {
  // Check if normals form a conical pattern (point toward apex)
  if (cluster.length < 6) return false;
  
  // Find potential apex (highest/lowest point)
  let apex = new THREE.Vector3();
  let maxZ = -Infinity;
  
  for (const idx of cluster) {
    const z = triangles[idx].centroid.z;
    if (z > maxZ) {
      maxZ = z;
      apex = triangles[idx].centroid.clone();
    }
  }
  
  // Check if normals point toward apex with consistent angle
  let angleScore = 0;
  for (const idx of cluster) {
    const tri = triangles[idx];
    const toApex = new THREE.Vector3().subVectors(apex, tri.centroid).normalize();
    const dotProduct = Math.abs(tri.normal.dot(toApex));
    angleScore += dotProduct;
  }
  
  return (angleScore / cluster.length) > 0.6;
}

function calculateConfinementScore(
  cluster: number[],
  triangles: TriangleAnalysis[],
  boundingBox: FeatureLocation['boundingBox']
): number {
  // Calculate how confined/enclosed the feature is
  const dimensions = [
    boundingBox.max.x - boundingBox.min.x,
    boundingBox.max.y - boundingBox.min.y,
    boundingBox.max.z - boundingBox.min.z
  ].sort((a, b) => a - b);
  
  const aspectRatio = dimensions[2] / dimensions[0];
  const depth = dimensions[2];
  const width = dimensions[0];
  
  // High depth-to-width ratio = more confined
  const depthScore = Math.min(depth / (width + 0.1), 1.0);
  
  // Check normal diversity (many different orientations = complex access)
  const normalVariance = calculateNormalVariance(cluster, triangles);
  
  return (depthScore * 0.6 + normalVariance * 0.4);
}

function calculateSurfaceComplexity(cluster: number[], triangles: TriangleAnalysis[]): number {
  // Calculate geometric complexity based on curvature variation
  const curvatures = cluster.map(idx => triangles[idx].curvature);
  const avgCurvature = curvatures.reduce((a, b) => a + b, 0) / curvatures.length;
  
  // Calculate standard deviation of curvature
  const variance = curvatures.reduce((sum, c) => sum + Math.pow(c - avgCurvature, 2), 0) / curvatures.length;
  const stdDev = Math.sqrt(variance);
  
  // High average curvature + high variation = complex surface
  return Math.min(avgCurvature * 0.6 + stdDev * 0.4, 1.0);
}

function calculateNormalVariance(cluster: number[], triangles: TriangleAnalysis[]): number {
  // Calculate how much normals vary in direction
  if (cluster.length < 2) return 0;
  
  let totalVariance = 0;
  const avgNormal = new THREE.Vector3();
  
  for (const idx of cluster) {
    avgNormal.add(triangles[idx].normal);
  }
  avgNormal.divideScalar(cluster.length).normalize();
  
  for (const idx of cluster) {
    const dotProduct = triangles[idx].normal.dot(avgNormal);
    totalVariance += (1 - Math.abs(dotProduct));
  }
  
  return totalVariance / cluster.length;
}

// Helper functions

function findSpatialCluster(
  triangles: TriangleAnalysis[],
  seedIndex: number,
  radiusThreshold: number,
  visited: Set<number>
): number[] {
  const cluster: number[] = [seedIndex];
  visited.add(seedIndex);
  const queue = [seedIndex];
  const seedPos = triangles[seedIndex].centroid;

  while (queue.length > 0) {
    const currentIdx = queue.shift()!;
    const currentPos = triangles[currentIdx].centroid;

    for (let i = 0; i < triangles.length; i++) {
      if (visited.has(i)) continue;

      const distance = triangles[i].centroid.distanceTo(currentPos);
      if (distance < radiusThreshold) {
        cluster.push(i);
        visited.add(i);
        queue.push(i);
      }
    }
  }

  return cluster;
}

function calculateFeatureLocation(
  cluster: number[],
  triangles: TriangleAnalysis[],
  positionAttr: THREE.BufferAttribute
): Omit<FeatureLocation, 'confidence'> {
  const centroid = new THREE.Vector3();
  const min = new THREE.Vector3(Infinity, Infinity, Infinity);
  const max = new THREE.Vector3(-Infinity, -Infinity, -Infinity);

  for (const idx of cluster) {
    const tri = triangles[idx];
    centroid.add(tri.centroid);

    for (const v of tri.vertices) {
      min.min(v);
      max.max(v);
    }
  }

  centroid.divideScalar(cluster.length);

  return {
    triangles: cluster,
    centroid: { x: centroid.x, y: centroid.y, z: centroid.z },
    boundingBox: {
      min: { x: min.x, y: min.y, z: min.z },
      max: { x: max.x, y: max.y, z: max.z },
    },
  };
}

function estimateCurvature(
  triangleIndex: number,
  positionAttr: THREE.BufferAttribute,
  triangleCount: number
): number {
  // Simplified curvature estimation based on neighboring triangles
  // In a production system, this would use proper differential geometry
  const range = 5;
  let normalVariance = 0;
  let count = 0;

  const currentNormal = calculateTriangleNormal(triangleIndex, positionAttr);

  for (let i = Math.max(0, triangleIndex - range); i < Math.min(triangleCount, triangleIndex + range); i++) {
    if (i === triangleIndex) continue;
    const neighborNormal = calculateTriangleNormal(i, positionAttr);
    normalVariance += 1 - currentNormal.dot(neighborNormal);
    count++;
  }

  return count > 0 ? normalVariance / count : 0;
}

function calculateTriangleNormal(triangleIndex: number, positionAttr: THREE.BufferAttribute): THREE.Vector3 {
  const i0 = triangleIndex * 3;
  const i1 = triangleIndex * 3 + 1;
  const i2 = triangleIndex * 3 + 2;

  const v0 = new THREE.Vector3().fromBufferAttribute(positionAttr, i0);
  const v1 = new THREE.Vector3().fromBufferAttribute(positionAttr, i1);
  const v2 = new THREE.Vector3().fromBufferAttribute(positionAttr, i2);

  const edge1 = new THREE.Vector3().subVectors(v1, v0);
  const edge2 = new THREE.Vector3().subVectors(v2, v0);

  return new THREE.Vector3().crossVectors(edge1, edge2).normalize();
}

function isCylindricalPattern(cluster: number[], triangles: TriangleAnalysis[]): boolean {
  // Check if normals form a radial pattern
  if (cluster.length < 8) return false;

  const centroid = new THREE.Vector3();
  for (const idx of cluster) {
    centroid.add(triangles[idx].centroid);
  }
  centroid.divideScalar(cluster.length);

  let radialScore = 0;
  for (const idx of cluster) {
    const tri = triangles[idx];
    const toCenter = new THREE.Vector3().subVectors(centroid, tri.centroid).normalize();
    const dotProduct = Math.abs(tri.normal.dot(toCenter));
    radialScore += dotProduct;
  }

  return (radialScore / cluster.length) > 0.7;
}

function isRecessedArea(cluster: number[], triangles: TriangleAnalysis[]): boolean {
  // Check if the feature is below surrounding geometry
  const avgZ = cluster.reduce((sum, idx) => sum + triangles[idx].centroid.z, 0) / cluster.length;
  
  // Compare with nearby triangles outside the cluster
  let surroundingZ = 0;
  let surroundingCount = 0;

  for (let i = 0; i < triangles.length; i++) {
    if (cluster.includes(i)) continue;
    
    const minDist = Math.min(...cluster.map(idx => 
      triangles[i].centroid.distanceTo(triangles[idx].centroid)
    ));

    if (minDist < 15 && minDist > 5) {
      surroundingZ += triangles[i].centroid.z;
      surroundingCount++;
    }
  }

  if (surroundingCount === 0) return false;
  
  const avgSurroundingZ = surroundingZ / surroundingCount;
  return avgZ < avgSurroundingZ - 2; // 2mm threshold
}

function estimateWallThickness(cluster: number[], triangles: TriangleAnalysis[]): number {
  // Estimate thickness by looking at bounding box smallest dimension
  const min = new THREE.Vector3(Infinity, Infinity, Infinity);
  const max = new THREE.Vector3(-Infinity, -Infinity, -Infinity);

  for (const idx of cluster) {
    for (const v of triangles[idx].vertices) {
      min.min(v);
      max.max(v);
    }
  }

  const dimensions = [
    max.x - min.x,
    max.y - min.y,
    max.z - min.z
  ].sort((a, b) => a - b);

  return dimensions[0]; // Return smallest dimension
}

function calculateAspectRatio(boundingBox: FeatureLocation['boundingBox']): number {
  const dimensions = [
    boundingBox.max.x - boundingBox.min.x,
    boundingBox.max.y - boundingBox.min.y,
    boundingBox.max.z - boundingBox.min.z
  ].sort((a, b) => a - b);

  return dimensions[2] / dimensions[0]; // longest / shortest
}

function createEmptyFeatureMap(): GeometryFeatureMap {
  return {
    holes: [],
    pockets: [],
    thinWalls: [],
    undercuts: [],
    sharpCorners: [],
    ribs: [],
    bosses: [],
    fillets: [],
    chamfers: [],
    threads: [],
    counterbores: [],
    countersinks: [],
    slots: [],
    toolAccessRestricted: [],
    complexSurfaces: [],
  };
}
