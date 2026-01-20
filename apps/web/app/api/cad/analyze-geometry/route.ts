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
  
  return {
    volume: volumeMm3,
    surfaceArea: (backendData.surface_area || 0) * 100, // Convert cm² to mm²
    boundingBox,
    complexity: backendData.complexity || 'simple',
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
    
    partCharacteristics: {
      isRotationalSymmetric: false,
      isThinWalled: detectedThickness ? detectedThickness < 3 : false,
      hasCurvedSurfaces: false,
      hasComplexFeatures: (backendData.primitive_features?.pockets || 0) > 5,
      aspectRatio: Math.max(boundingBox.x, boundingBox.y, boundingBox.z) / Math.min(boundingBox.x, boundingBox.y, boundingBox.z)
    },
    
    advancedFeatures: {
      ribs: { count: 0, minThickness: 2, locations: [], deflectionRisk: 'low' },
      holes: {
        count: backendData.primitive_features?.holes || 0,
        avgDiameter: 5,
        deepHoles: 0,
        microHoles: 0,
        drillingMethod: 'standard-drill'
      },
      bosses: { count: backendData.primitive_features?.bosses || 0, locations: [] },
      fillets: { count: 0, avgRadius: 2, missingCount: 0 },
      pockets: { count: backendData.primitive_features?.pockets || 0, avgDepth: 5, deepPockets: 0 },
      threads: { count: 0, specs: [] },
      undercuts: { count: 0, severity: 'none' as const },
      thinWalls: { count: 0, minThickness: detectedThickness || 2, locations: [] }
    },
    
    recommendedSecondaryOps: [],
    dfmIssues: []
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
