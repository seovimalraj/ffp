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
          // Complete GeometryData fields to prevent crashes on reload
          partCharacteristics: {
            isRotationalSymmetric: false,
            isThinWalled: false,
            hasCurvedSurfaces: false,
            hasComplexFeatures: false,
            aspectRatio: 1,
          },
          features: ['assembly'],
          advancedFeatures: {
            ribs: { count: 0, avgThickness: 0, minThickness: 0, thinRibCount: 0, deflectionRisk: 'low' },
            holes: { count: 0, avgDiameter: 0, minDiameter: 0, maxDepth: 0, deepHoleCount: 0, blindHoleCount: 0, throughHoleCount: 0, threadedHoleCount: 0, requiresReaming: false, smallDiameterCount: 0, requiresEDM: false, microHoleCount: 0 },
            bosses: { count: 0, avgHeight: 0, maxAspectRatio: 0, requiresThreading: false, requiresReaming: false },
            fillets: { count: 0, avgRadius: 0, minRadius: 0, missingFilletCount: 0, stressConcentrationRisk: 0, blendRadiusCount: 0 },
            pockets: { count: 0, avgDepth: 0, maxDepthRatio: 0, narrowPocketCount: 0, requiresEDM: false, thinWallPockets: 0, microPockets: 0, deepNarrowPockets: 0 },
            threads: { count: 0, standardThreadCount: 0, customThreadCount: 0, internalCount: 0, externalCount: 0, finePitchCount: 0, requiresThreadMilling: false },
            undercuts: { count: 0, internalCount: 0, externalCount: 0, requiresEDM: false, requiresSpecialTooling: false, maxDepth: 0 },
            chamfers: { count: 0, avgSize: 0, deburringRequired: false },
            thinWalls: { count: 0, minThickness: 0, avgThickness: 0, risk: 'low', requiresSupportFixture: false },
            toolAccess: { restrictedAreas: 0, requiresIndexing: false, requiresMultiAxisMachining: false, estimatedSetupCount: 0, axisCounts: { '3-axis': 0, '4-axis': 0, '5-axis': 0 }, specialFixturingNeeded: false },
            surfaceFinish: { estimatedRa: 0, criticalSurfaces: 0, requiresPolishing: false, requiresHoning: false },
          },
          recommendedSecondaryOps: [],
          dfmIssues: [],
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

// ---------- Type aliases ----------
type DFMSeverity = 'info' | 'warning' | 'critical';
type ComplexityLevel = 'simple' | 'moderate' | 'complex';
type SmPartType = 'flat-pattern' | 'simple-enclosure' | 'complex-enclosure' | 'bracket' | 'panel' | 'chassis' | 'housing' | 'cabinet';
type SmComplexity = 'simple' | 'moderate' | 'complex' | 'very-complex';
interface DFMIssueEntry {
  severity: DFMSeverity;
  issue: string;
  recommendation: string;
  potentialSavings?: number;
}
interface GeometryContext {
  backendData: any;
  advancedMetrics: Record<string, any>;
  boundingBox: { x: number; y: number; z: number };
  detectedThickness: number | undefined;
  thicknessConfidence: number;
  thicknessMethod: string;
  thicknessWarning: string | undefined;
  bendData: ReturnType<typeof extractBendData>;
  recommendedProcess: string;
  processConfidence: number;
  processReasoning: string;
  sheetMetalScore: number;
  volumeMm3: number;
  complexity: ComplexityLevel;
}

// ---------- Helpers for transformBackendGeometry ----------

function extractBendData(backendData: any) {
  const advancedMetrics = backendData.advanced_metrics || {};
  const bendAnalysis = advancedMetrics.bend_analysis || {};
  const bendCount = bendAnalysis.bend_count || 0;
  const bendConfidence = bendAnalysis.confidence || 0;
  const isLikelyBent = bendAnalysis.is_likely_bent || false;
  const bendComplexity = bendAnalysis.complexity || 0;

  const stepBendAngles = backendData.step_bend_angles || null;
  const hasStepBendData = !!(stepBendAngles && stepBendAngles.total_bend_count > 0);
  const actualBendCount = hasStepBendData ? stepBendAngles.total_bend_count : bendCount;

  return { bendCount, bendConfidence, isLikelyBent, bendComplexity, stepBendAngles, hasStepBendData, actualBendCount };
}

function resolveProcessConfidence(
  backendConfidence: number | undefined,
  recommendedProcess: string,
  thicknessConfidence: number,
  sheetMetalScore: number,
): number {
  if (typeof backendConfidence === 'number' && backendConfidence > 0) {
    return backendConfidence;
  }
  if (recommendedProcess !== 'sheet-metal') {
    return Math.min(0.9, (100 - sheetMetalScore) / 100);
  }
  if (thicknessConfidence > 0.6) {
    return Math.min(0.95, (sheetMetalScore / 100) * 0.7 + thicknessConfidence * 0.3);
  }
  return Math.min(0.85, sheetMetalScore / 100);
}

function resolveProcessReasoning(
  backendReasoning: string | undefined,
  detectedThickness: number | undefined,
  thicknessConfidence: number,
  recommendedProcess: string,
  sheetMetalScore: number,
): string {
  if (typeof backendReasoning === 'string' && backendReasoning.length > 0) {
    return backendReasoning;
  }
  if (detectedThickness && thicknessConfidence > 0.6) {
    return `Detected ${detectedThickness.toFixed(2)}mm wall thickness using ray-casting (${(thicknessConfidence * 100).toFixed(0)}% confidence)`;
  }
  if (recommendedProcess === 'sheet-metal') {
    return `Sheet metal characteristics detected (score: ${sheetMetalScore.toFixed(0)}/100)`;
  }
  return 'CNC characteristics detected (solid part or varying thickness)';
}

function sanitizeVolumeMm3(backendVolume: number, boundingBox: { x: number; y: number; z: number }): number {
  let volumeMm3 = (backendVolume || 0) * 1000;
  const bboxVolume = boundingBox.x * boundingBox.y * boundingBox.z;
  if (volumeMm3 > bboxVolume * 2 || volumeMm3 > 10000000 || volumeMm3 < 0.001) {
    volumeMm3 = bboxVolume * 0.6;
  }
  return volumeMm3;
}

function resolveComplexity(backendData: any, recommendedProcess: string, bendCount: number): ComplexityLevel {
  if (backendData.complexity && ['simple', 'moderate', 'complex'].includes(backendData.complexity)) {
    return backendData.complexity;
  }
  return calcFallbackComplexity(backendData, recommendedProcess, bendCount);
}

function calcFallbackComplexity(backendData: any, recommendedProcess: string, bendCount: number): ComplexityLevel {
  const pf = backendData.primitive_features || {};
  let score = 0;
  score += scoreFromThresholds(pf.holes || 0, 15, 30, 8, 20, 3, 10);
  score += scoreFromThresholds(pf.pockets || 0, 8, 25, 4, 15, 1, 8);
  score += scoreFromThresholds(pf.faces || 0, 10000, 20, 5000, 12, 2000, 6);
  if (recommendedProcess === 'sheet-metal' && bendCount > 0) {
    score += scoreFromThresholds(bendCount, 5, 25, 2, 15, 0, 8);
  }
  if (score >= 45) return 'complex';
  if (score >= 20) return 'moderate';
  return 'simple';
}

function scoreFromThresholds(
  value: number,
  highThresh: number, highPts: number,
  midThresh: number, midPts: number,
  lowThresh: number, lowPts: number,
): number {
  if (value > highThresh) return highPts;
  if (value > midThresh) return midPts;
  if (value > lowThresh) return lowPts;
  return 0;
}

function resolveBendAngles(hasStepBendData: boolean, stepBendAngles: any, bendCount: number): number[] {
  if (hasStepBendData) {
    return stepBendAngles.bends.map((b: any) => b.angle_deg);
  }
  if (bendCount > 0) {
    return new Array(Math.min(bendCount, 10)).fill(90);
  }
  return [];
}

function resolveBendArray(hasStepBendData: boolean, stepBendAngles: any, bendCount: number, detectedThickness: number | undefined, boundingBox: { x: number; y: number; z: number }): any[] {
  if (hasStepBendData) {
    return stepBendAngles.bends.map((b: any) => ({
      angle: b.angle_deg,
      radius: b.radius_mm,
      length: b.length_mm,
      type: b.bend_type,
      kFactor: b.k_factor,
      bendDeduction: b.bend_deduction_mm,
      isAcute: b.is_acute,
      isObtuse: b.is_obtuse,
    }));
  }
  if (bendCount > 0) {
    return Array.from({ length: Math.min(bendCount, 20) }, (_, i) => ({
      angle: 90,
      radius: (detectedThickness || 2) * 1.5,
      length: Math.max(boundingBox.x, boundingBox.y) * 0.5,
      index: i,
    }));
  }
  return [];
}

function resolveSmPartType(bendCount: number): SmPartType {
  if (bendCount > 4) return 'complex-enclosure';
  if (bendCount > 1) return 'bracket';
  return 'flat-pattern';
}

function resolveSmComplexity(bendCount: number): SmComplexity {
  if (bendCount > 8) return 'complex';
  if (bendCount > 3) return 'moderate';
  return 'simple';
}

function mapCostImpactToSavings(costImpact: string | undefined): number {
  if (costImpact === 'high') return 50;
  if (costImpact === 'medium') return 25;
  return 10;
}

/**
 * Transform backend Python analysis to frontend TypeScript GeometryData format
 */
function transformBackendGeometry(backendData: any, _fileName: string): any {
  // Handle both 'bbox' (STL/STEP) and 'boundingBox' (legacy DXF) keys
  const bboxData = backendData.bbox || backendData.boundingBox || { min: { x: 0, y: 0, z: 0 }, max: { x: 0, y: 0, z: 0 } };
  const boundingBox = {
    x: (bboxData.max?.x || 0) - (bboxData.min?.x || 0),
    y: (bboxData.max?.y || 0) - (bboxData.min?.y || 0),
    z: (bboxData.max?.z || 0) - (bboxData.min?.z || 0)
  };

  const advancedMetrics = backendData.advanced_metrics || {};
  const faceClassification = advancedMetrics.face_classification || {};
  
  // Resolve thickness: prefer ray-casting, fallback to face-pair analysis, then bbox
  let detectedThickness = advancedMetrics.detected_thickness_mm || backendData.thickness;
  let thicknessMethod = advancedMetrics.thickness_detection_method || 'bbox_approximation';
  
  // If detected thickness is invalid (<0.3mm), use dominant_pair_thickness from face classification
  const dominantPairThickness = faceClassification.dominant_pair_thickness;
  if ((!detectedThickness || detectedThickness < 0.3) && dominantPairThickness && dominantPairThickness >= 0.3 && dominantPairThickness <= 25) {
    detectedThickness = dominantPairThickness;
    thicknessMethod = 'face_pair_analysis';
    console.log(`⚠️ Using dominant_pair_thickness (${dominantPairThickness}mm) as fallback for invalid ray-cast result`);
  }
  
  const thicknessConfidence = advancedMetrics.thickness_confidence || (detectedThickness && detectedThickness >= 0.3 ? 0.7 : 0.5);

  const bendData = extractBendData(backendData);

  const processMap: Record<string, string> = {
    'sheet_metal': 'sheet-metal',
    'cnc_milling': 'cnc-milling',
    'cnc_turning': 'cnc-turning',
    'assembly': 'manual-quote',
  };
  const recommendedProcess = processMap[backendData.process_type] || 'cnc-milling';
  const sheetMetalScore = backendData.sheet_metal_score || 0;

  const processConfidence = resolveProcessConfidence(
    advancedMetrics.classification_confidence,
    recommendedProcess, thicknessConfidence, sheetMetalScore,
  );
  const processReasoning = resolveProcessReasoning(
    advancedMetrics.reasoning,
    detectedThickness, thicknessConfidence, recommendedProcess, sheetMetalScore,
  );

  let thicknessWarning: string | undefined;
  if (thicknessMethod === 'bbox_approximation' && thicknessConfidence < 0.7) {
    thicknessWarning = 'Using bounding box approximation. Actual wall thickness may differ for bent sheet metal parts.';
  }

  const volumeMm3 = sanitizeVolumeMm3(backendData.volume, boundingBox);
  const complexity = resolveComplexity(backendData, recommendedProcess, bendData.bendCount);

  return buildGeometryResult({
    backendData, advancedMetrics, boundingBox, detectedThickness,
    thicknessConfidence, thicknessMethod, thicknessWarning,
    bendData, recommendedProcess, processConfidence, processReasoning,
    sheetMetalScore, volumeMm3, complexity,
  });
}

function buildGeometryResult(ctx: GeometryContext): any {
  const { backendData, advancedMetrics, boundingBox, detectedThickness, thicknessConfidence, thicknessMethod, thicknessWarning } = ctx;
  const { bendData, recommendedProcess, processConfidence, processReasoning, sheetMetalScore, volumeMm3, complexity } = ctx;
  const { actualBendCount, bendConfidence, isLikelyBent, bendComplexity, stepBendAngles, hasStepBendData, bendCount } = bendData;

  return {
    volume: volumeMm3,
    surfaceArea: (backendData.surface_area || 0) * 100,
    boundingBox,
    complexity,
    estimatedMachiningTime: estimateMachiningTime(backendData),
    materialWeight: calculateMaterialWeight(backendData.volume || 0),
    recommendedProcess,
    processConfidence,
    processReasoning,
    sheetMetalScore,
    // Assembly / manual-quote flags — propagate from backend
    isAssembly: backendData.is_assembly === true,
    requiresManualQuote: backendData.requires_manual_quote === true || recommendedProcess === 'manual-quote',
    manualQuoteReason: backendData.manual_quote_reason || (recommendedProcess === 'manual-quote' ? 'Assembly or complex part requires manual quoting' : undefined),
    needsReview: advancedMetrics.needs_review === true,
    classificationMethod: advancedMetrics.classification_method || 'unknown',
    machiningFeatureScore: advancedMetrics.machining_feature_score || 0,
    faceClassification: advancedMetrics.face_classification || null,
    detectedWallThickness: detectedThickness,
    thicknessConfidence,
    thicknessDetectionMethod: thicknessMethod,
    thicknessWarning,
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
        avgRadius: 2, minRadius: 1, missingFilletCount: 0,
        stressConcentrationRisk: 0, blendRadiusCount: 0
      },
      pockets: extractPocketFeatures(backendData),
      threads: extractThreadFeatures(backendData),
      undercuts: extractUndercutFeatures(backendData),
      chamfers: { count: 0, avgSize: 1, deburringRequired: false },
      thinWalls: { count: 0, minThickness: detectedThickness || 2, avgThickness: detectedThickness || 2, risk: 'low' as const, requiresSupportFixture: false },
      toolAccess: { restrictedAreas: 0, requiresIndexing: false, requiresMultiAxisMachining: false, estimatedSetupCount: 1, axisCounts: { '3-axis': 1, '4-axis': 0, '5-axis': 0 }, specialFixturingNeeded: false },
      surfaceFinish: { estimatedRa: 3.2, criticalSurfaces: 0, requiresPolishing: false, requiresHoning: false }
    },
    sheetMetalFeatures: recommendedProcess === 'sheet-metal' ? {
      thickness: detectedThickness || Math.min(boundingBox.x, boundingBox.y, boundingBox.z),
      flatArea: (backendData.surface_area || 0) * 100 * 0.5,
      developedLength: 2 * (boundingBox.x + boundingBox.y) * (1 + bendCount * 0.05),
      perimeterLength: 2 * (boundingBox.x + boundingBox.y),
      bendCount: actualBendCount,
      bendAngles: resolveBendAngles(hasStepBendData, stepBendAngles, bendCount),
      minBendRadius: hasStepBendData ? stepBendAngles.min_radius_mm : (detectedThickness || 2),
      maxBendRadius: hasStepBendData ? stepBendAngles.max_radius_mm : (detectedThickness || 2) * 3,
      hasSharptBends: hasStepBendData
        ? stepBendAngles.has_acute_bends
        : (bendCount > 0 && (detectedThickness || 2) > 2),
      bends: resolveBendArray(hasStepBendData, stepBendAngles, bendCount, detectedThickness, boundingBox),
      stepBendData: hasStepBendData ? {
        totalBendLength: stepBendAngles.total_bend_length_mm,
        avgAngle: stepBendAngles.avg_angle_deg,
        hasHems: stepBendAngles.has_hems,
        sequenceComplexity: stepBendAngles.bend_sequence_complexity,
        confidence: stepBendAngles.confidence,
      } : undefined,
      holeCount: backendData.primitive_features?.holes || 0,
      totalHoleDiameter: (backendData.primitive_features?.holes || 0) * Math.PI * 5,
      cornerCount: 4 + bendCount * 2,
      complexCuts: Math.floor(bendComplexity / 20),
      straightCutLength: 2 * (boundingBox.x + boundingBox.y),
      curvedCutLength: bendComplexity > 30 ? 50 : 0,
      hasHems: bendCount > 4,
      hasCountersinks: (backendData.primitive_features?.holes || 0) > 8,
      hasLouvers: bendCount > 6 && bendComplexity > 50,
      hasEmbossments: bendComplexity > 60,
      hasLances: bendComplexity > 70,
      flangeCount: Math.floor(bendCount / 2),
      hasSmallFeatures: (detectedThickness || 2) < 1.5,
      hasTightTolerance: bendCount > 5 && (detectedThickness || 2) < 2,
      requiresMultipleSetups: bendCount > 10,
      nestingEfficiency: Math.max(0.6, 0.85 - bendCount * 0.01),
      recommendedCuttingMethod: 'laser' as const,
      recommendedBendingMethod: 'press-brake' as const,
      estimatedCuttingTime: Math.max(1, 2 * (boundingBox.x + boundingBox.y) / 1000 * 0.5),
      estimatedFormingTime: Math.max(0.5, bendCount * 0.3),
      partType: resolveSmPartType(bendCount),
      complexity: resolveSmComplexity(bendCount),
      bendConfidence,
      isLikelyBent,
    } : undefined,
    recommendedSecondaryOps: [],
    dfmIssues: transformDFMIssues(backendData.dfm_analysis),
    grainDirection: backendData.grain_direction ? {
      recommended: backendData.grain_direction.recommended,
      score: backendData.grain_direction.score,
      notes: backendData.grain_direction.notes || []
    } : undefined,
    nesting: backendData.nesting ? {
      partsPerSheet: backendData.nesting.parts_per_sheet,
      utilizationPct: backendData.nesting.utilization_pct,
      sheetSize: backendData.nesting.sheet_size
    } : undefined,
    validation: backendData.validation || undefined,
    complexityScore: backendData.complexity_score || 0,
    features: generateFeatureTags(backendData, recommendedProcess, bendCount, detectedThickness),
    // === ADVANCED MANUFACTURING ANALYSIS ===
    surfaceFinishAnalysis: transformSurfaceFinish(backendData.surface_finish),
    castingAnalysis: transformCastingAnalysis(backendData.casting_analysis),
    machiningComplexity: transformMachiningComplexity(backendData.machining_complexity),
  };
}

/**
 * Transform backend DFM analysis to frontend dfmIssues format
 */
function transformDFMIssues(dfmAnalysis: any): DFMIssueEntry[] {
  if (!dfmAnalysis?.issues) {
    return [];
  }

  const issues: DFMIssueEntry[] = [];

  for (const issue of dfmAnalysis.issues) {
    let severity: DFMSeverity = 'info';
    if (issue.severity === 'error' || issue.severity === 'critical') {
      severity = 'critical';
    } else if (issue.severity === 'warning') {
      severity = 'warning';
    }

    issues.push({
      severity,
      issue: issue.title || issue.description || 'Unknown issue',
      recommendation: issue.recommendation || '',
      potentialSavings: mapCostImpactToSavings(issue.cost_impact),
    });
  }

  appendRecommendations(issues, dfmAnalysis);
  return issues;
}

function appendRecommendations(issues: DFMIssueEntry[], dfmAnalysis: any): void {
  if (dfmAnalysis.recommendations) {
    for (const rec of dfmAnalysis.recommendations) {
      issues.push({ severity: 'info', issue: 'Optimization opportunity', recommendation: rec });
    }
  }
  if (dfmAnalysis.cost_optimization_opportunities) {
    for (const opt of dfmAnalysis.cost_optimization_opportunities) {
      issues.push({ severity: 'info', issue: 'Cost optimization', recommendation: opt, potentialSavings: 15 });
    }
  }
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
  const volume = data.volume || 0;  // cm³
  const surfaceArea = data.surface_area || 0;  // cm²
  const holes = data.primitive_features?.holes || 0;
  const pockets = data.primitive_features?.pockets || 0;
  const threads = data.primitive_features?.threads || 0;
  const slots = data.primitive_features?.slots || 0;
  const fillets = data.primitive_features?.fillets || 0;
  const complexity = data.complexity || 'moderate';

  // Base time: material removal rate ~2-5 cm³/min for aluminum
  const volumeTime = volume * 0.5;

  // Feature times (minutes)
  const holeTime = holes * 1;             // drilling + deburring
  const pocketTime = pockets * 3;         // roughing + finishing passes
  const threadTime = threads * 2;         // tapping cycles
  const slotTime = slots * 1.5;           // slotting operations
  const filletTime = fillets * 0.3;       // finishing passes on radii

  // Surface finishing based on surface area
  const finishTime = surfaceArea * 0.05;

  // Complexity multiplier for multi-axis, tight tolerances, etc.
  const complexityMult = { simple: 0.8, moderate: 1, complex: 1.4 }[complexity] || 1;

  const rawTime = (volumeTime + holeTime + pocketTime + threadTime + slotTime + filletTime + finishTime) * complexityMult;

  // Setup time component (loading, fixturing, tool changes)
  const setupComponent = 5;  // minimum 5 min for any CNC part

  // Bounding box based floor: even a tiny CNC part needs minimum fixturing time
  const bbox = data.bbox || {};
  const bboxX = (bbox.max?.x || 0) - (bbox.min?.x || 0);
  const bboxY = (bbox.max?.y || 0) - (bbox.min?.y || 0);
  const bboxZ = (bbox.max?.z || 0) - (bbox.min?.z || 0);
  const bboxVolumeFloor = (bboxX * bboxY * bboxZ) / 1000 * 0.1;  // rough floor from bbox

  return Math.max(setupComponent, rawTime, bboxVolumeFloor);
}

function calculateMaterialWeight(volumeCm3: number): number {
  // Aluminum 6061 density: 2.7 g/cm³
  return volumeCm3 * 2.7;
}

/**
 * Transform backend surface finish analysis to frontend format
 */
function transformSurfaceFinish(surfaceFinish: any): any {
  if (!surfaceFinish) return undefined;
  
  return {
    dominantGrade: surfaceFinish.dominant_grade || 'standard',
    minRaRequired: surfaceFinish.min_ra_required || 3.2,
    minRzEstimated: surfaceFinish.min_rz_estimated || surfaceFinish.min_ra_required * 5 || 16,
    precisionFaceCount: surfaceFinish.precision_face_count || 0,
    polishedFaceCount: surfaceFinish.polished_face_count || 0,
    groundFaceCount: surfaceFinish.ground_face_count || 0,
    totalPrecisionAreaMm2: surfaceFinish.total_precision_area_mm2 || 0,
    finishComplexityScore: surfaceFinish.finish_complexity_score || 0,
    features: (surfaceFinish.features || []).map((f: any) => ({
      grade: f.grade || 'standard',
      estimatedRa: f.estimated_ra || 3.2,
      estimatedRz: f.estimated_rz || f.estimated_ra * 5 || 16,
      faceAreaMm2: f.face_area_mm2 || 0,
      faceType: f.face_type || 'unknown',
      isMatingSurface: f.is_mating_surface || false,
      requiresGrinding: f.requires_grinding || false,
      requiresPolishing: f.requires_polishing || false,
    })),
  };
}

/**
 * Transform backend casting analysis to frontend format
 */
function transformCastingAnalysis(castingAnalysis: any): any {
  if (!castingAnalysis) return undefined;
  
  return {
    isLikelyCasting: castingAnalysis.is_likely_casting || false,
    castingType: castingAnalysis.casting_type || 'not_castable',
    optimalPartingZ: castingAnalysis.optimal_parting_z,
    draftCompliantFaces: castingAnalysis.draft_compliant_faces || 0,
    draftInsufficientFaces: castingAnalysis.draft_insufficient_faces || 0,
    averageDraftDeg: castingAnalysis.average_draft_deg || 0,
    minDraftDeg: castingAnalysis.min_draft_deg || 0,
    hasUndercuts: castingAnalysis.has_undercuts || false,
    undercutCount: castingAnalysis.undercut_count || 0,
    ejectorDifficulty: castingAnalysis.ejector_difficulty || 'easy',
    confidence: castingAnalysis.confidence || 0,
    partingLines: (castingAnalysis.parting_lines || []).map((pl: any) => ({
      zLevel: pl.z_level,
      complexity: pl.complexity || 0,
      isPlanar: pl.is_planar !== false,
      confidence: pl.confidence || 0,
    })),
  };
}

/**
 * Transform backend machining complexity analysis to frontend format
 */
function transformMachiningComplexity(machiningComplexity: any): any {
  if (!machiningComplexity) return undefined;
  
  return {
    primaryProcess: machiningComplexity.primary_process || 'milling',
    secondaryProcess: machiningComplexity.secondary_process,
    recommendedMachine: machiningComplexity.recommended_machine || 'mill_3axis',
    estimatedSetupCount: machiningComplexity.estimated_setup_count || 1,
    complexityScore: machiningComplexity.complexity_score || 0,
    requires5Axis: machiningComplexity.requires_5axis || false,
    requires4Axis: machiningComplexity.requires_4axis || false,
    isTurnMill: machiningComplexity.is_turn_mill || false,
    requiresEdm: machiningComplexity.requires_edm || false,
    milling: machiningComplexity.milling ? {
      minAxesRequired: machiningComplexity.milling.min_axes_required || 3,
      hasDeepPockets: machiningComplexity.milling.has_deep_pockets || false,
      hasUndercuts: machiningComplexity.milling.has_undercuts || false,
      hasCompoundAngles: machiningComplexity.milling.has_compound_angles || false,
      accessDirectionCount: machiningComplexity.milling.access_direction_count || 1,
      maxToolLengthMm: machiningComplexity.milling.max_tool_length_mm || 0,
    } : undefined,
    turning: machiningComplexity.turning ? {
      isRotationallySymmetric: machiningComplexity.turning.is_rotationally_symmetric || false,
      symmetryAxis: machiningComplexity.turning.symmetry_axis,
      hasCrossHoles: machiningComplexity.turning.has_cross_holes || false,
      crossHoleCount: machiningComplexity.turning.cross_hole_count || 0,
      hasFlats: machiningComplexity.turning.has_flats || false,
      hasThreads: machiningComplexity.turning.has_threads || false,
      requiresTailstock: machiningComplexity.turning.requires_tailstock || false,
    } : undefined,
    setups: (machiningComplexity.setups || []).map((s: any) => ({
      setupNumber: s.setup_number || 0,
      orientation: s.orientation || 'top',
      requiresSpecialFixture: s.requires_special_fixture || false,
    })),
  };
}
