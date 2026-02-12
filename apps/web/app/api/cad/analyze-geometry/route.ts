import { NextRequest, NextResponse } from 'next/server';

/**
 * Enterprise-level CAD geometry analysis API
 * Connects to Python CAD service for advanced thickness detection using ray-casting
 */
export async function POST(request: NextRequest) {
  console.log('🚀 API ROUTE HIT: /api/cad/analyze-geometry');
  console.log('   Request method:', request.method);
  console.log('   Request URL:', request.url);
  
  try {
    const body = await request.json();
    console.log('   Request body:', body);
    const { fileUrl, fileName } = body;

    if (!fileUrl || !fileName) {
      return NextResponse.json(
        { error: 'Missing required fields: fileUrl, fileName' },
        { status: 400 }
      );
    }

    // Connect to Python CAD service for advanced analysis
    const cadServiceUrl = process.env.CAD_SERVICE_URL || 'https://ffp-cad.frigate.ai';
    const analyzeEndpoint = `${cadServiceUrl}/analyze/sync`;
    
    console.log(`🔬 Requesting backend analysis for ${fileName}`);
    console.log(`   CAD Service: ${cadServiceUrl}`);
    console.log(`   Full endpoint: ${analyzeEndpoint}`);
    console.log(`   File URL: ${fileUrl}`);

    try {
      // Use synchronous endpoint for immediate results
      const cadResponse = await fetch(analyzeEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          file_id: `temp_${Date.now()}`,
          file_url: fileUrl,
          units_hint: 'mm'
        }),
        // 60 second timeout for complex files
        signal: AbortSignal.timeout(60000)
      });

      if (!cadResponse.ok) {
        const errorText = await cadResponse.text();
        console.error('❌ CAD service error:', cadResponse.status, errorText);
        return NextResponse.json(
          { 
            error: 'CAD service analysis failed',
            details: errorText,
            fallback: true 
          },
          { status: cadResponse.status }
        );
      }

      const cadResult = await cadResponse.json();
      
      // Check if we got metrics
      if (!cadResult.metrics) {
        console.error('❌ No metrics in response:', cadResult);
        return NextResponse.json(
          { error: 'Invalid response from CAD service', fallback: true },
          { status: 500 }
        );
      }
      
      // === ASSEMBLY DETECTION ===
      // If backend detected an assembly, return special response
      if (cadResult.metrics.is_assembly) {
        console.warn('⚠️ Assembly detected:', cadResult.metrics.assembly_info);
        return NextResponse.json({
          isAssembly: true,
          assemblyInfo: cadResult.metrics.assembly_info,
          requiresManualQuote: true,
          manualQuoteReason: cadResult.metrics.manual_quote_reason || 'Assembly files require manual quoting',
          recommendedProcess: 'manual-quote',
          processConfidence: 0,
          processReasoning: 'Assembly detected - individual parts must be quoted separately',
          volume: 0,
          surfaceArea: 0,
          boundingBox: { x: 0, y: 0, z: 0 },
          complexity: 'complex' as const,
          estimatedMachiningTime: 0,
          materialWeight: 0,
          sheetMetalScore: 0,
        });
      }
      
      console.log('✅ Backend analysis successful:', {
        process: cadResult.metrics.process_type,
        thickness: cadResult.metrics.thickness,
        confidence: cadResult.metrics.advanced_metrics?.thickness_confidence
      });

      // Transform backend response to frontend GeometryData format
      const geometry = transformBackendGeometry(cadResult.metrics, fileName);

      return NextResponse.json(geometry);

    } catch (cadError: any) {
      if (cadError.name === 'AbortError') {
        console.error('⏱️ CAD service timeout');
        return NextResponse.json(
          { error: 'Analysis timeout - file too complex', fallback: true },
          { status: 504 }
        );
      }
      
      console.error('❌ CAD service connection error:', cadError.message);
      return NextResponse.json(
        { 
          error: 'Failed to connect to CAD service',
          details: cadError.message,
          fallback: true 
        },
        { status: 503 }
      );
    }

  } catch (error: any) {
    console.error('❌ CAD analysis API error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * Transform backend Python analysis to frontend TypeScript GeometryData format
 */
function transformBackendGeometry(backendData: any, fileName: string): any {
  const bbox = backendData.bbox || { min: { x: 0, y: 0, z: 0 }, max: { x: 0, y: 0, z: 0 } };
  const boundingBox = {
    x: bbox.max.x - bbox.min.x,
    y: bbox.max.y - bbox.min.y,
    z: bbox.max.z - bbox.min.z
  };

  // Extract advanced metrics
  const advancedMetrics = backendData.advanced_metrics || {};
  const detectedThickness = advancedMetrics.detected_thickness_mm || backendData.thickness;
  const thicknessConfidence = advancedMetrics.thickness_confidence || 0.5;
  const thicknessMethod = advancedMetrics.thickness_detection_method || 'bbox_approximation';
  
  // === EXTRACT BEND ANALYSIS FROM BACKEND ===
  const bendAnalysis = advancedMetrics.bend_analysis || {};
  const bendCount = bendAnalysis.bend_count || 0;
  const bendConfidence = bendAnalysis.confidence || 0;
  const isLikelyBent = bendAnalysis.is_likely_bent || false;
  const bendComplexity = bendAnalysis.complexity || 0;
  
  // === STEP BEND ANGLES (high-fidelity, from pythonOCC face-pair analysis) ===
  const stepBendAngles = backendData.step_bend_angles || null;
  const hasStepBendData = stepBendAngles && stepBendAngles.total_bend_count > 0;
  const actualBendCount = hasStepBendData ? stepBendAngles.total_bend_count : bendCount;
  
  if (hasStepBendData) {
    console.log('🔧 STEP Bend Angles (high-fidelity):', {
      count: stepBendAngles.total_bend_count,
      angles: `${stepBendAngles.min_angle_deg}°–${stepBendAngles.max_angle_deg}°`,
      radii: `${stepBendAngles.min_radius_mm}–${stepBendAngles.max_radius_mm}mm`,
      hasAcute: stepBendAngles.has_acute_bends,
      hasObtuse: stepBendAngles.has_obtuse_bends,
    });
  }
  
  console.log('🔧 Bend Analysis:', { bendCount: actualBendCount, isLikelyBent, bendConfidence, bendComplexity });

  // Map backend process type to frontend format
  const processMap: Record<string, string> = {
    'sheet_metal': 'sheet-metal',
    'cnc_milling': 'cnc-milling',
    'cnc_turning': 'cnc-turning',
  };
  const recommendedProcess = processMap[backendData.process_type] || 'cnc-milling';

  // Calculate confidence based on sheet metal score and thickness confidence
  const sheetMetalScore = backendData.sheet_metal_score || 0;
  let processConfidence = 0.5;
  
  if (recommendedProcess === 'sheet-metal') {
    // For sheet metal, use thickness confidence if available
    processConfidence = thicknessConfidence > 0.6 
      ? Math.min(0.95, (sheetMetalScore / 100) * 0.7 + thicknessConfidence * 0.3)
      : Math.min(0.85, sheetMetalScore / 100);
  } else {
    // For CNC, confidence based on score
    processConfidence = Math.min(0.90, (100 - sheetMetalScore) / 100);
  }

  // Generate reasoning based on detection method
  let processReasoning = '';
  if (detectedThickness && thicknessConfidence > 0.6) {
    processReasoning = `Detected ${detectedThickness.toFixed(2)}mm wall thickness using ray-casting (${(thicknessConfidence * 100).toFixed(0)}% confidence)`;
  } else if (recommendedProcess === 'sheet-metal') {
    processReasoning = `Sheet metal characteristics detected (score: ${sheetMetalScore.toFixed(0)}/100)`;
  } else {
    processReasoning = `CNC characteristics detected (solid part or varying thickness)`;
  }

  // Warning if bbox approximation used
  let thicknessWarning: string | undefined;
  if (thicknessMethod === 'bbox_approximation' && thicknessConfidence < 0.7) {
    thicknessWarning = 'Using bounding box approximation. Actual wall thickness may differ for bent sheet metal parts.';
  }

  // Sanity check: Prevent absurd volumes from corrupting pricing
  // Reasonable part volumes: 1 mm³ to 10,000,000 mm³ (10 liters)
  let volumeMm3 = (backendData.volume || 0) * 1000; // Convert cm³ to mm³
  const bboxVolume = boundingBox.x * boundingBox.y * boundingBox.z;
  
  if (volumeMm3 > bboxVolume * 2 || volumeMm3 > 10000000 || volumeMm3 < 0.001) {
    console.warn(`⚠️ Suspicious volume detected: ${volumeMm3.toFixed(0)} mm³ (bbox: ${bboxVolume.toFixed(0)} mm³)`);
    console.warn(`   Using estimated volume from bounding box instead`);
    volumeMm3 = bboxVolume * 0.6; // Estimate 60% fill for typical parts
  }
  
  // === ENTERPRISE COMPLEXITY CALCULATION ===
  // Use backend complexity if available, otherwise calculate from features
  let complexity: 'simple' | 'moderate' | 'complex' = 'simple';
  
  if (backendData.complexity && ['simple', 'moderate', 'complex'].includes(backendData.complexity)) {
    complexity = backendData.complexity;
    console.log(`✅ Using backend complexity: ${complexity} (score: ${backendData.complexity_score || 'N/A'})`);
  } else {
    // Fallback: Calculate complexity from primitive features
    const holeCount = backendData.primitive_features?.holes || 0;
    const pocketCount = backendData.primitive_features?.pockets || 0;
    const faceCount = backendData.primitive_features?.faces || 0;
    
    let complexityScore = 0;
    
    // Feature-based scoring
    if (holeCount > 15) complexityScore += 30;
    else if (holeCount > 8) complexityScore += 20;
    else if (holeCount > 3) complexityScore += 10;
    
    if (pocketCount > 8) complexityScore += 25;
    else if (pocketCount > 4) complexityScore += 15;
    else if (pocketCount > 1) complexityScore += 8;
    
    // Triangle/face complexity
    if (faceCount > 10000) complexityScore += 20;
    else if (faceCount > 5000) complexityScore += 12;
    else if (faceCount > 2000) complexityScore += 6;
    
    // Bend complexity for sheet metal
    if (recommendedProcess === 'sheet-metal' && bendCount > 0) {
      if (bendCount > 5) complexityScore += 25;
      else if (bendCount > 2) complexityScore += 15;
      else complexityScore += 8;
    }
    
    complexity = complexityScore >= 45 ? 'complex' : complexityScore >= 20 ? 'moderate' : 'simple';
    console.log(`📊 Calculated complexity: ${complexity} (score: ${complexityScore})`);
  }
  
  return {
    volume: volumeMm3,
    surfaceArea: (backendData.surface_area || 0) * 100, // Convert cm² to mm²
    boundingBox,
    complexity,  // Use our calculated complexity, not the fallback
    estimatedMachiningTime: estimateMachiningTime(backendData),
    materialWeight: calculateMaterialWeight(backendData.volume || 0),
    recommendedProcess,
    processConfidence,
    processReasoning,
    sheetMetalScore,
    
    // Enterprise-level thickness detection metadata
    detectedWallThickness: detectedThickness,
    thicknessConfidence,
    thicknessDetectionMethod: thicknessMethod,
    thicknessWarning,
    
    // === DFM ANALYSIS METADATA FROM BACKEND ===
    dfmAnalysis: backendData.dfm_analysis ? {
      overallScore: backendData.dfm_analysis.overall_score || 100,
      rating: backendData.dfm_analysis.rating || 'excellent',
      isManufacturable: backendData.dfm_analysis.is_manufacturable !== false,
      issueCount: (backendData.dfm_analysis.issues || []).length,
      recommendations: backendData.dfm_analysis.recommendations || [],
      costOptimizations: backendData.dfm_analysis.cost_optimization_opportunities || []
    } : undefined,
    
    partCharacteristics: {
      isRotationalSymmetric: false,
      isThinWalled: detectedThickness ? detectedThickness < 3 : false,
      hasCurvedSurfaces: false,
      hasComplexFeatures: (backendData.primitive_features?.pockets || 0) > 5,
      aspectRatio: Math.max(boundingBox.x, boundingBox.y, boundingBox.z) / Math.min(boundingBox.x, boundingBox.y, boundingBox.z)
    },
    
    advancedFeatures: {
      ribs: { count: 0, avgThickness: 2, minThickness: 2, thinRibCount: 0, deflectionRisk: 'low' as const },
      holes: extractHoleFeatures(backendData),
      bosses: { count: backendData.primitive_features?.bosses || 0, avgHeight: 5, maxAspectRatio: 2, requiresThreading: false, requiresReaming: false },
      fillets: {
        count: backendData.primitive_features?.fillets || 0,
        avgRadius: 2,
        minRadius: 1,
        missingFilletCount: 0,
        stressConcentrationRisk: 0,
        blendRadiusCount: 0
      },
      pockets: extractPocketFeatures(backendData),
      threads: extractThreadFeatures(backendData),
      undercuts: extractUndercutFeatures(backendData),
      chamfers: { count: 0, avgSize: 1, deburringRequired: false },
      thinWalls: { count: 0, minThickness: detectedThickness || 2, avgThickness: detectedThickness || 2, risk: 'low' as const, requiresSupportFixture: false },
      toolAccess: { restrictedAreas: 0, requiresIndexing: false, requiresMultiAxisMachining: false, estimatedSetupCount: 1, axisCounts: { '3-axis': 1, '4-axis': 0, '5-axis': 0 }, specialFixturingNeeded: false },
      surfaceFinish: { estimatedRa: 3.2, criticalSurfaces: 0, requiresPolishing: false, requiresHoning: false }
    },
    
    // === SHEET METAL FEATURES FROM BACKEND BEND DETECTION ===
    sheetMetalFeatures: {
      thickness: detectedThickness || Math.min(boundingBox.x, boundingBox.y, boundingBox.z),
      flatArea: (backendData.surface_area || 0) * 100 * 0.5, // Approximate flat area
      developedLength: 2 * (boundingBox.x + boundingBox.y) * (1 + bendCount * 0.05),
      perimeterLength: 2 * (boundingBox.x + boundingBox.y),
      
      // BEND DATA FROM BACKEND
      bendCount: actualBendCount,
      bendAngles: hasStepBendData
        ? stepBendAngles.bends.map((b: any) => b.angle_deg)
        : (bendCount > 0 ? Array(Math.min(bendCount, 10)).fill(90) : []),
      minBendRadius: hasStepBendData
        ? stepBendAngles.min_radius_mm
        : (detectedThickness || 2) * 1.0,
      maxBendRadius: hasStepBendData
        ? stepBendAngles.max_radius_mm
        : (detectedThickness || 2) * 3.0,
      hasSharptBends: hasStepBendData
        ? stepBendAngles.has_acute_bends
        : (bendCount > 0 && (detectedThickness || 2) > 2),
      
      // Bend array for pricing engine (PricingStrategy reads .bends?.length and .bends?.some())
      bends: hasStepBendData
        ? stepBendAngles.bends.map((b: any) => ({
            angle: b.angle_deg,
            radius: b.radius_mm,
            length: b.length_mm,
            type: b.bend_type,
            kFactor: b.k_factor,
            bendDeduction: b.bend_deduction_mm,
            isAcute: b.is_acute,
            isObtuse: b.is_obtuse,
          }))
        : (bendCount > 0
          ? Array.from({ length: Math.min(bendCount, 20) }, (_, i) => ({
              angle: 90,
              radius: (detectedThickness || 2) * 1.5,
              length: Math.max(boundingBox.x, boundingBox.y) * 0.5,
              index: i
            }))
          : []),
      
      // STEP bend extraction metadata
      stepBendData: hasStepBendData ? {
        totalBendLength: stepBendAngles.total_bend_length_mm,
        avgAngle: stepBendAngles.avg_angle_deg,
        hasHems: stepBendAngles.has_hems,
        sequenceComplexity: stepBendAngles.bend_sequence_complexity,
        confidence: stepBendAngles.confidence,
      } : undefined,
      
      // Cutting features (estimated)
      holeCount: backendData.primitive_features?.holes || 0,
      totalHoleDiameter: (backendData.primitive_features?.holes || 0) * Math.PI * 5,
      cornerCount: 4 + bendCount * 2,
      complexCuts: Math.floor(bendComplexity / 20),
      straightCutLength: 2 * (boundingBox.x + boundingBox.y),
      curvedCutLength: bendComplexity > 30 ? 50 : 0,
      
      // Forming features (inferred from bend analysis)
      hasHems: bendCount > 4,
      hasCountersinks: (backendData.primitive_features?.holes || 0) > 8,
      hasLouvers: bendCount > 6 && bendComplexity > 50,
      hasEmbossments: bendComplexity > 60,
      hasLances: bendComplexity > 70,
      flangeCount: Math.floor(bendCount / 2),
      
      // Manufacturing complexity
      hasSmallFeatures: (detectedThickness || 2) < 1.5,
      hasTightTolerance: bendCount > 5 && (detectedThickness || 2) < 2,
      requiresMultipleSetups: bendCount > 10,
      nestingEfficiency: Math.max(0.6, 0.85 - bendCount * 0.01),
      
      // Process recommendations (required by interface)
      recommendedCuttingMethod: 'laser' as const,
      recommendedBendingMethod: 'press-brake' as const,
      estimatedCuttingTime: Math.max(1, 2 * (boundingBox.x + boundingBox.y) / 1000 * 0.5), // perimeter-based
      estimatedFormingTime: Math.max(0.5, bendCount * 0.3), // per-bend time
      
      // Part classification
      partType: bendCount > 4 ? 'complex-enclosure' : bendCount > 1 ? 'bracket' : 'flat-pattern' as 'flat-pattern' | 'simple-enclosure' | 'complex-enclosure' | 'bracket' | 'panel' | 'chassis' | 'housing' | 'cabinet',
      complexity: bendCount > 8 ? 'complex' : bendCount > 3 ? 'moderate' : 'simple' as 'simple' | 'moderate' | 'complex' | 'very-complex',
      
      // Backend analysis info
      bendConfidence: bendConfidence,
      isLikelyBent: isLikelyBent
    },
    
    recommendedSecondaryOps: [],
    dfmIssues: transformDFMIssues(backendData.dfm_analysis),
    
    // === FORWARD ADDITIONAL BACKEND DATA ===
    // Grain direction analysis (sheet metal only)
    grainDirection: backendData.grain_direction ? {
      recommended: backendData.grain_direction.recommended,
      score: backendData.grain_direction.score,
      notes: backendData.grain_direction.notes || []
    } : undefined,
    
    // Nesting optimization (sheet metal only)
    nesting: backendData.nesting ? {
      partsPerSheet: backendData.nesting.parts_per_sheet,
      utilizationPct: backendData.nesting.utilization_pct,
      sheetSize: backendData.nesting.sheet_size
    } : undefined,
    
    // Validation results from backend
    validation: backendData.validation || undefined,
    
    // Numeric complexity score for fine-grained pricing
    complexityScore: backendData.complexity_score || 0,
    
    // Feature tags for quick lookups
    features: generateFeatureTags(backendData, recommendedProcess, bendCount, detectedThickness)
  };
}

/**
 * Transform backend DFM analysis to frontend dfmIssues format
 */
function transformDFMIssues(dfmAnalysis: any): { severity: 'info' | 'warning' | 'critical'; issue: string; recommendation: string; potentialSavings?: number }[] {
  if (!dfmAnalysis || !dfmAnalysis.issues) {
    return [];
  }

  const issues: { severity: 'info' | 'warning' | 'critical'; issue: string; recommendation: string; potentialSavings?: number }[] = [];

  for (const issue of dfmAnalysis.issues) {
    // Map backend severity to frontend severity
    let severity: 'info' | 'warning' | 'critical' = 'info';
    if (issue.severity === 'error' || issue.severity === 'critical') {
      severity = 'critical';
    } else if (issue.severity === 'warning') {
      severity = 'warning';
    }

    issues.push({
      severity,
      issue: issue.title || issue.description || 'Unknown issue',
      recommendation: issue.recommendation || '',
      potentialSavings: issue.cost_impact === 'high' ? 50 : issue.cost_impact === 'medium' ? 25 : 10
    });
  }

  // Add recommendations as info-level issues
  if (dfmAnalysis.recommendations) {
    for (const rec of dfmAnalysis.recommendations) {
      issues.push({
        severity: 'info',
        issue: 'Optimization opportunity',
        recommendation: rec
      });
    }
  }

  // Add cost optimization opportunities
  if (dfmAnalysis.cost_optimization_opportunities) {
    for (const opt of dfmAnalysis.cost_optimization_opportunities) {
      issues.push({
        severity: 'info',
        issue: 'Cost optimization',
        recommendation: opt,
        potentialSavings: 15
      });
    }
  }

  console.log(`📋 Transformed ${issues.length} DFM issues from backend analysis`);
  return issues;
}

/**
 * Extract thread features from backend data
 */
function extractThreadFeatures(backendData: any): {
  count: number;
  internalThreads: number;
  externalThreads: number;
  specifications: { type: 'metric' | 'imperial' | 'custom'; size: string; count: number }[];
  avgDiameter: number;
  requiresTapping: boolean;
  requiresThreadMilling: boolean;
  singlePointThreading: boolean;
} {
  const threadCount = backendData.primitive_features?.threads || 0;
  
  return {
    count: threadCount,
    internalThreads: threadCount, // Assume internal by default
    externalThreads: 0,
    specifications: threadCount > 0 ? [{ type: 'metric' as const, size: 'M6', count: threadCount }] : [],
    avgDiameter: 6, // Default M6
    requiresTapping: threadCount > 0,
    requiresThreadMilling: threadCount > 4,
    singlePointThreading: false
  };
}

/**
 * Extract undercut features from backend data
 */
function extractUndercutFeatures(backendData: any): {
  count: number;
  severity: 'minor' | 'moderate' | 'severe';
  requires5Axis: boolean;
} {
  const undercutCount = backendData.primitive_features?.undercuts || 0;
  
  let severity: 'minor' | 'moderate' | 'severe' = 'minor';
  if (undercutCount > 4) severity = 'severe';
  else if (undercutCount > 1) severity = 'moderate';
  
  return {
    count: undercutCount,
    severity: undercutCount > 0 ? severity : 'minor',
    requires5Axis: undercutCount > 2
  };
}

/**
 * Generate feature tags for quick lookups
 */
function generateFeatureTags(backendData: any, process: string, bendCount: number, thickness?: number): string[] {
  const tags: string[] = [];
  const pf = backendData.primitive_features || {};
  
  if (process === 'sheet-metal') tags.push('sheet-metal');
  if (process === 'cnc-milling') tags.push('cnc-milling');
  if (process === 'cnc-turning') tags.push('cnc-turning');
  if (thickness && thickness < 3) tags.push('thin-wall');
  if (bendCount > 0) tags.push('has-bends');
  if (bendCount > 4) tags.push('complex-bends');
  if ((pf.holes || 0) > 0) tags.push('has-holes');
  if ((pf.holes || 0) > 10) tags.push('many-holes');
  if ((pf.threads || 0) > 0) tags.push('has-threads');
  if ((pf.undercuts || 0) > 0) tags.push('has-undercuts');
  if ((pf.pockets || 0) > 0) tags.push('has-pockets');
  if ((pf.fillets || 0) > 0) tags.push('has-fillets');
  if ((pf.slots || 0) > 0) tags.push('has-slots');
  
  return tags;
}

/**
 * Extract hole features from backend DFM analysis
 */
function extractHoleFeatures(backendData: any): {
  count: number;
  throughHoles: number;
  blindHoles: number;
  tappedHoles: number;
  reamedHoles: number;
  countersunkHoles: number;
  counterboredHoles: number;
  avgDiameter: number;
  minDiameter: number;
  maxDiameter: number;
  deepHoleCount: number;
  microHoleCount: number;
  avgDepthRatio: number;
  drillingMethod: string;
  toolAccessIssues: number;
} {
  const dfmAnalysis = backendData.dfm_analysis;
  const holeCount = backendData.primitive_features?.holes || 0;
  
  // Try to get detailed hole data from DFM analysis
  let deepHoles = 0;
  let smallHoles = 0;
  let drillingMethod = 'standard-drill';
  
  if (dfmAnalysis?.issues) {
    for (const issue of dfmAnalysis.issues) {
      if (issue.title?.toLowerCase().includes('deep hole')) {
        deepHoles = issue.measurement || 1;
      }
      if (issue.title?.toLowerCase().includes('small hole')) {
        smallHoles = issue.measurement || 1;
      }
    }
    
    // Determine drilling method based on issues
    if (deepHoles > 0) drillingMethod = 'peck-drill';
    if (smallHoles > 0) drillingMethod = 'micro-drill';
  }
  
  return {
    count: holeCount,
    throughHoles: Math.ceil(holeCount * 0.6), // Estimate 60% through
    blindHoles: Math.floor(holeCount * 0.4),
    tappedHoles: backendData.primitive_features?.threads || 0,
    reamedHoles: 0,
    countersunkHoles: 0,
    counterboredHoles: 0,
    avgDiameter: 5,
    minDiameter: 3,
    maxDiameter: 10,
    deepHoleCount: deepHoles,
    microHoleCount: smallHoles,
    avgDepthRatio: 3,
    drillingMethod,
    toolAccessIssues: 0
  };
}

/**
 * Extract pocket features from backend DFM analysis
 */
function extractPocketFeatures(backendData: any): {
  count: number;
  openPockets: number;
  closedPockets: number;
  deepPockets: number;
  avgDepth: number;
  maxAspectRatio: number;
  minCornerRadius: number;
  sharpCornersCount: number;
  requiresSquareEndmill: boolean;
  requiresBallEndmill: boolean;
} {
  const dfmAnalysis = backendData.dfm_analysis;
  const pocketCount = backendData.primitive_features?.pockets || 0;
  
  // Try to get detailed pocket data from DFM analysis
  let deepPockets = 0;
  if (dfmAnalysis?.issues) {
    for (const issue of dfmAnalysis.issues) {
      if (issue.title?.toLowerCase().includes('deep pocket')) {
        deepPockets++;
      }
    }
  }
  
  return {
    count: pocketCount,
    openPockets: Math.ceil(pocketCount * 0.5),
    closedPockets: Math.floor(pocketCount * 0.5),
    deepPockets,
    avgDepth: 5,
    maxAspectRatio: deepPockets > 0 ? 4 : 2,
    minCornerRadius: 2,
    sharpCornersCount: 0,
    requiresSquareEndmill: pocketCount > 0,
    requiresBallEndmill: false
  };
}

function estimateMachiningTime(data: any): number {
  const volume = data.volume || 0;
  const holes = data.primitive_features?.holes || 0;
  const pockets = data.primitive_features?.pockets || 0;
  
  // Rough estimation: 0.5 min per cm³ + 1 min per hole + 3 min per pocket
  return Math.max(5, volume * 0.5 + holes * 1 + pockets * 3);
}

function calculateMaterialWeight(volumeCm3: number): number {
  // Aluminum 6061 density: 2.7 g/cm³
  return volumeCm3 * 2.7;
}
