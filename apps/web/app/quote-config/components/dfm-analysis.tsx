"use client";

import {
  FileType,
  Layers,
  Maximize2,
  Shield,
  Ruler,
  Circle,
  Zap,
  LayoutDashboard,
  CheckCheck,
  Sparkles,
  TrendingDown,
} from "lucide-react";
import React, { useEffect, useState, useRef } from "react";
import { cn } from "@/lib/utils";
import { PartConfig } from "@/types/part-config";
import { motion, AnimatePresence } from "framer-motion";
import { analyzeGeometryFeatures, GeometryFeatureMap } from "@/lib/geometry-feature-locator";

// DFM Check Status Types
type CheckStatus = "pass" | "warning" | "fail" | "critical" | "info" | "loading";

interface DFMCheck {
  id: string;
  name: string;
  description: string;
  status: CheckStatus;
  details?: string;
  icon: React.ReactNode;
  category: "geometry" | "feasibility" | "manufacturability" | "tolerances" | "features" | "optimization" | "bending" | "forming";
  severity?: "low" | "medium" | "high" | "critical";
  potentialSavings?: number;
  actionable?: boolean;
  selectionHint?: {
    type: 'feature' | 'surface' | 'edge' | 'dimension';
    featureType?: string;
    location?: { x: number; y: number; z: number };
    triangles?: number[];
    description?: string;
  };
}

interface DFMAnalysisResult {
  overallScore: number;
  manufacturability: "excellent" | "good" | "fair" | "poor" | "critical";
  checks: DFMCheck[];
  recommendations: string[];
  estimatedIssues: number;
  criticalIssues: number;
  potentialSavings: number;
  processingComplexity: "simple" | "moderate" | "complex";
  processType: "cnc" | "sheet-metal" | "unknown";
}

const SUPPORTED_FILE_TYPES = [
  "stl",
  "step",
  "stp",
  "iges",
  "igs",
  "obj",
  "3mf",
  "x_t",
  "x_b",
];
const MAX_DIMENSIONS = { x: 1000, y: 500, z: 500 };
const MIN_WALL_THICKNESS = 0.8;

function analyzeDFM(part: PartConfig, geometryFeatures?: GeometryFeatureMap): DFMAnalysisResult {
  const checks: DFMCheck[] = [];
  const recommendations: string[] = [];
  let totalPotentialSavings = 0;

  const geometry = part.geometry;
  const hasGeometry = !!geometry;
  
  // Detect process type - check part config first, then geometry recommendation
  const processType: "cnc" | "sheet-metal" | "unknown" = 
    part.process === "sheet-metal" ? "sheet-metal" :
    part.process === "cnc" || part.process === "cnc-milling" || part.process === "cnc-turning" ? "cnc" :
    geometry?.recommendedProcess === "sheet-metal" ? "sheet-metal" :
    geometry?.recommendedProcess === "cnc-milling" || geometry?.recommendedProcess === "cnc-turning" ? "cnc" :
    geometry?.sheetMetalFeatures ? "sheet-metal" :
    "cnc"; // Default to CNC
  
  const isCNC = processType === "cnc";
  const isSheetMetal = processType === "sheet-metal";

  // ===== GEOMETRY VALIDATION =====
  const fileExt = part.fileName.split(".").pop()?.toLowerCase() || "";
  const isValidFileType = SUPPORTED_FILE_TYPES.includes(fileExt);
  checks.push({
    id: "file-type",
    name: "File Format",
    description: "CAD file format validation",
    status: isValidFileType ? "pass" : "fail",
    details: isValidFileType ? `${fileExt.toUpperCase()} format` : "Unsupported format",
    icon: <FileType className="w-4 h-4" />,
    category: "geometry",
    severity: isValidFileType ? "low" : "critical",
    actionable: !isValidFileType,
  });

  if (!isValidFileType) {
    recommendations.push("Convert file to STEP or STL format for accurate analysis.");
  }

  // Model integrity
  checks.push({
    id: "model-integrity",
    name: "Geometric Integrity",
    description: "3D model structure validation",
    status: hasGeometry ? "pass" : "fail",
    details: hasGeometry ? `${geometry.complexity} geometry validated` : "No geometry data",
    icon: <Shield className="w-4 h-4" />,
    category: "geometry",
    severity: hasGeometry ? "low" : "critical",
  });

  if (hasGeometry) {
    const boundingBox = geometry.boundingBox;
    const maxDim = Math.max(boundingBox.x, boundingBox.y, boundingBox.z);
    const minDim = Math.min(boundingBox.x, boundingBox.y, boundingBox.z);

    // Machine capacity check
    const exceedsMaxSize =
      boundingBox.x > MAX_DIMENSIONS.x ||
      boundingBox.y > MAX_DIMENSIONS.y ||
      boundingBox.z > MAX_DIMENSIONS.z;
    
    checks.push({
      id: "machine-capacity",
      name: "Machine Work Envelope",
      description: "Part size vs machine capacity",
      status: exceedsMaxSize ? "fail" : maxDim > 500 ? "warning" : "pass",
      details: `${boundingBox.x.toFixed(0)}×${boundingBox.y.toFixed(0)}×${boundingBox.z.toFixed(0)}mm`,
      icon: <Maximize2 className="w-4 h-4" />,
      category: "feasibility",
      severity: exceedsMaxSize ? "critical" : maxDim > 500 ? "medium" : "low",
    });

    if (exceedsMaxSize) {
      recommendations.push(`Part exceeds machine capacity. Consider splitting into smaller components or using specialized equipment.`);
    }

    // ===== ADVANCED FEATURE ANALYSIS =====
    const features = geometry.advancedFeatures;

    // Hole analysis
    if (features.holes.count > 0) {
      const holeStatus = 
        features.holes.microHoleCount > 0 ? "critical" :
        features.holes.deepHoleCount > 3 ? "warning" : 
        features.holes.toolAccessIssues > 0 ? "warning" : "pass";

      checks.push({
        id: "hole-features",
        name: "Hole Manufacturing",
        description: `${features.holes.count} holes analyzed`,
        status: holeStatus,
        details: `${features.holes.throughHoles} through, ${features.holes.blindHoles} blind, ${features.holes.tappedHoles} tapped`,
        icon: <Circle className="w-4 h-4" />,
        category: "features",
        severity: features.holes.microHoleCount > 0 ? "critical" : "medium",
        potentialSavings: features.holes.microHoleCount * 50 + features.holes.deepHoleCount * 20,
        actionable: holeStatus !== "pass",
        selectionHint: geometryFeatures && geometryFeatures.holes.length > 0 ? {
          type: 'feature',
          featureType: 'holes',
          location: geometryFeatures.holes[0].centroid,
          triangles: geometryFeatures.holes.flatMap(h => h.triangles).slice(0, 100),
          description: `${geometryFeatures.holes.length} hole locations detected with ${(geometryFeatures.holes[0].confidence * 100).toFixed(0)}% accuracy`
        } : features.holes.count > 0 ? {
          type: 'feature',
          featureType: 'holes',
          location: { x: 0, y: 0, z: 10 },
          triangles: [],
          description: `${features.holes.count} holes requiring machining`
        } : undefined,
      });

      if (features.holes.microHoleCount > 0) {
        recommendations.push(`${features.holes.microHoleCount} micro holes (<1mm) require specialized tooling. Consider enlarging to ≥1mm diameter for standard machining.`);
        totalPotentialSavings += features.holes.microHoleCount * 50;
      }
      if (features.holes.deepHoleCount > 0) {
        recommendations.push(`${features.holes.deepHoleCount} deep holes (L/D > 5:1) require peck drilling cycles. Reduce depth or increase diameter if possible.`);
        totalPotentialSavings += features.holes.deepHoleCount * 20;
      }
      if (features.holes.drillingMethod === 'gun-drill' || features.holes.drillingMethod === 'boring') {
        recommendations.push(`Specialized drilling method required: ${features.holes.drillingMethod}. Lead time may increase.`);
      }
    }

    // Pocket & boss analysis (CNC only)
    if (isCNC && features.pockets.count > 0) {
      const pocketStatus = 
        features.pockets.sharpCornersCount > 5 ? "warning" :
        features.pockets.deepPockets > 3 ? "warning" : "pass";

      checks.push({
        id: "pocket-features",
        name: "Pockets & Cavities",
        description: `${features.pockets.count} pockets detected`,
        status: pocketStatus,
        details: `${features.pockets.deepPockets} deep, ${features.pockets.sharpCornersCount} sharp corners`,
        icon: <Layers className="w-4 h-4" />,
        category: "features",
        severity: pocketStatus === "warning" ? "medium" : "low",
        potentialSavings: features.pockets.sharpCornersCount * 8 + features.pockets.deepPockets * 25,
        actionable: pocketStatus === "warning",
        selectionHint: geometryFeatures && geometryFeatures.pockets.length > 0 ? {
          type: 'feature',
          featureType: 'pockets',
          location: geometryFeatures.pockets[0].centroid,
          triangles: geometryFeatures.pockets.flatMap(p => p.triangles).slice(0, 150),
          description: `${geometryFeatures.pockets.length} pocket areas identified with ${(geometryFeatures.pockets[0].confidence * 100).toFixed(0)}% confidence`
        } : features.pockets.count > 0 ? {
          type: 'feature',
          featureType: 'pockets',
          location: { x: 0, y: 0, z: -5 },
          triangles: [],
          description: `${features.pockets.count} pockets with ${features.pockets.sharpCornersCount} sharp corners`
        } : undefined,
      });

      if (features.pockets.sharpCornersCount > 3) {
        recommendations.push(`${features.pockets.sharpCornersCount} sharp pocket corners detected. Add R${features.pockets.minCornerRadius.toFixed(1)}mm radii to eliminate square endmill requirement.`);
        totalPotentialSavings += features.pockets.sharpCornersCount * 8;
      }
      if (features.pockets.deepPockets > 2) {
        recommendations.push(`${features.pockets.deepPockets} deep pockets (depth > 3x width) may cause tool deflection. Consider reducing depth by 30%.`);
        totalPotentialSavings += features.pockets.deepPockets * 25;
      }
    }

    // Thread analysis (CNC only)
    if (isCNC && features.threads.count > 0) {
      checks.push({
        id: "thread-features",
        name: "Threading Operations",
        description: `${features.threads.count} threads required`,
        status: features.threads.count > 10 ? "warning" : "pass",
        details: `${features.threads.internalThreads} internal, ${features.threads.externalThreads} external`,
        icon: <Zap className="w-4 h-4" />,
        category: "features",
        severity: features.threads.count > 10 ? "medium" : "low",
        potentialSavings: Math.min(features.threads.count * 3, 80),
      });

      if (features.threads.count > 8) {
        const cost = features.threads.internalThreads * 3 + features.threads.externalThreads * 2;
        recommendations.push(`High thread count (${features.threads.count}). Threading cost: $${cost}. Consider using fewer, larger fasteners.`);
      }
    }

    // Fillet analysis (CNC only)
    if (isCNC && features.fillets.missingFilletCount > 2) {
      checks.push({
        id: "fillet-analysis",
        name: "Internal Corners",
        description: "Stress concentration analysis",
        status: features.fillets.stressConcentrationRisk > 6 ? "critical" : "warning",
        details: `${features.fillets.missingFilletCount} sharp corners, risk ${features.fillets.stressConcentrationRisk}/10`,
        icon: <Shield className="w-4 h-4" />,
        category: "features",
        severity: features.fillets.stressConcentrationRisk > 6 ? "critical" : "medium",
        actionable: true,
        selectionHint: geometryFeatures && geometryFeatures.fillets.length > 0 ? {
          type: 'feature',
          featureType: 'fillets',
          location: geometryFeatures.fillets[0].centroid,
          triangles: geometryFeatures.fillets.flatMap(f => f.triangles).slice(0, 80),
          description: `${geometryFeatures.fillets.length} fillet locations detected (avg confidence: ${(geometryFeatures.fillets.reduce((sum, f) => sum + f.confidence, 0) / geometryFeatures.fillets.length * 100).toFixed(0)}%)`
        } : undefined,
      });

      recommendations.push(`${features.fillets.missingFilletCount} sharp internal corners increase stress concentration (risk: ${features.fillets.stressConcentrationRisk}/10). Add R${features.fillets.minRadius.toFixed(1)}mm fillets to prevent crack initiation.`);
    }

    // Chamfer analysis (CNC only) - NEW
    if (isCNC && geometryFeatures && geometryFeatures.chamfers.length > 0) {
      const chamferCount = geometryFeatures.chamfers.length;
      const chamferStatus = chamferCount < 5 ? "info" : "pass";
      
      checks.push({
        id: "chamfer-features",
        name: "Edge Treatment",
        description: `${chamferCount} chamfers detected`,
        status: chamferStatus,
        details: `Deburring and edge finishing requirements`,
        icon: <Maximize2 className="w-4 h-4" />,
        category: "features",
        severity: "low",
        actionable: false,
        selectionHint: {
          type: 'feature',
          featureType: 'chamfers',
          location: geometryFeatures.chamfers[0].centroid,
          triangles: geometryFeatures.chamfers.flatMap(c => c.triangles).slice(0, 60),
          description: `${chamferCount} chamfer edges identified (avg confidence: ${(geometryFeatures.chamfers.reduce((sum, c) => sum + c.confidence, 0) / chamferCount * 100).toFixed(0)}%)`
        },
      });
    }

    // Thread feature analysis - ENHANCED
    if (geometryFeatures && geometryFeatures.threads.length > 0) {
      const threadCount = geometryFeatures.threads.length;
      const threadStatus = threadCount > 5 ? "warning" : "info";
      
      checks.push({
        id: "thread-features",
        name: "Threading Operations",
        description: `${threadCount} threaded features detected`,
        status: threadStatus,
        details: `High-precision threading required`,
        icon: <Circle className="w-4 h-4" />,
        category: "features",
        severity: threadCount > 5 ? "medium" : "low",
        potentialSavings: threadCount * 8,
        actionable: threadCount > 5,
        selectionHint: {
          type: 'feature',
          featureType: 'threads',
          location: geometryFeatures.threads[0].centroid,
          triangles: geometryFeatures.threads.flatMap(t => t.triangles).slice(0, 120),
          description: `${threadCount} threaded regions (helical patterns) detected with ${(geometryFeatures.threads[0].confidence * 100).toFixed(0)}% confidence`
        },
      });
      
      if (threadCount > 5) {
        recommendations.push(`${threadCount} threaded features detected. Consider using press-fit inserts or reducing thread count to lower manufacturing time.`);
        totalPotentialSavings += threadCount * 8;
      }
    }

    // Counterbore/Countersink analysis - NEW
    if (geometryFeatures && (geometryFeatures.counterbores.length > 0 || geometryFeatures.countersinks.length > 0)) {
      const cbCount = geometryFeatures.counterbores.length;
      const cskCount = geometryFeatures.countersinks.length;
      const total = cbCount + cskCount;
      
      checks.push({
        id: "secondary-hole-ops",
        name: "Secondary Hole Operations",
        description: `${cbCount} counterbores, ${cskCount} countersinks`,
        status: total > 8 ? "warning" : "pass",
        details: `Additional hole operations required`,
        icon: <Circle className="w-4 h-4" />,
        category: "features",
        severity: total > 8 ? "medium" : "low",
        potentialSavings: total * 4,
        actionable: total > 8,
        selectionHint: cbCount > 0 ? {
          type: 'feature',
          featureType: 'counterbores',
          location: geometryFeatures.counterbores[0].centroid,
          triangles: [...geometryFeatures.counterbores, ...geometryFeatures.countersinks].flatMap(f => f.triangles).slice(0, 100),
          description: `${total} secondary hole features (${cbCount} CB, ${cskCount} CSK) with ${((geometryFeatures.counterbores[0]?.confidence || 0.8) * 100).toFixed(0)}% detection accuracy`
        } : undefined,
      });
      
      if (total > 8) {
        recommendations.push(`${total} secondary hole operations (counterbores/countersinks) add cycle time. Consider standardizing hole types where possible.`);
        totalPotentialSavings += total * 4;
      }
    }

    // Slot analysis - NEW
    if (geometryFeatures && geometryFeatures.slots.length > 0) {
      const slotCount = geometryFeatures.slots.length;
      const slotStatus = slotCount > 3 ? "warning" : "info";
      
      checks.push({
        id: "slot-features",
        name: "Slot Machining",
        description: `${slotCount} elongated slots detected`,
        status: slotStatus,
        details: `Require specialized end mill operations`,
        icon: <Layers className="w-4 h-4" />,
        category: "features",
        severity: slotCount > 3 ? "medium" : "low",
        potentialSavings: slotCount * 15,
        actionable: slotCount > 3,
        selectionHint: {
          type: 'feature',
          featureType: 'slots',
          location: geometryFeatures.slots[0].centroid,
          triangles: geometryFeatures.slots.flatMap(s => s.triangles).slice(0, 150),
          description: `${slotCount} slot features with elongated geometry (confidence: ${(geometryFeatures.slots[0].confidence * 100).toFixed(0)}%)`
        },
      });
      
      if (slotCount > 3) {
        recommendations.push(`${slotCount} slots require multiple passes and tool changes. Consider using simple holes where functionality permits.`);
        totalPotentialSavings += slotCount * 15;
      }
    }

    // Tool access restriction analysis - NEW
    if (geometryFeatures && geometryFeatures.toolAccessRestricted.length > 0) {
      const restrictedCount = geometryFeatures.toolAccessRestricted.length;
      const restrictionStatus = restrictedCount > 2 ? "critical" : restrictedCount > 0 ? "warning" : "pass";
      
      checks.push({
        id: "tool-access-restrictions",
        name: "Tool Accessibility",
        description: `${restrictedCount} restricted access areas`,
        status: restrictionStatus,
        details: `May require special tooling or multiple setups`,
        icon: <Zap className="w-4 h-4" />,
        category: "manufacturability",
        severity: restrictedCount > 2 ? "high" : "medium",
        potentialSavings: restrictedCount * 45,
        actionable: true,
        selectionHint: {
          type: 'feature',
          featureType: 'tool-access',
          location: geometryFeatures.toolAccessRestricted[0].centroid,
          triangles: geometryFeatures.toolAccessRestricted.flatMap(r => r.triangles).slice(0, 200),
          description: `${restrictedCount} confined areas with limited tool access (confinement score: ${(geometryFeatures.toolAccessRestricted[0].confidence * 100).toFixed(0)}%)`
        },
      });
      
      if (restrictedCount > 0) {
        recommendations.push(`${restrictedCount} areas have restricted tool access requiring special fixturing or extended reach tooling. Estimated additional cost: $${restrictedCount * 45}.`);
        totalPotentialSavings += restrictedCount * 45;
      }
    }

    // Complex surface analysis - NEW
    if (geometryFeatures && geometryFeatures.complexSurfaces.length > 0) {
      const complexCount = geometryFeatures.complexSurfaces.length;
      const complexStatus = complexCount > 3 ? "warning" : "info";
      
      checks.push({
        id: "complex-surfaces",
        name: "Complex Surface Machining",
        description: `${complexCount} complex curved surfaces`,
        status: complexStatus,
        details: `Require ball end mills and 3+ axis machining`,
        icon: <Sparkles className="w-4 h-4" />,
        category: "manufacturability",
        severity: complexCount > 3 ? "medium" : "low",
        potentialSavings: complexCount * 35,
        actionable: complexCount > 3,
        selectionHint: {
          type: 'surface',
          featureType: 'complex-surface',
          location: geometryFeatures.complexSurfaces[0].centroid,
          triangles: geometryFeatures.complexSurfaces.flatMap(cs => cs.triangles).slice(0, 200),
          description: `${complexCount} regions with multi-directional curvature (complexity: ${(geometryFeatures.complexSurfaces[0].confidence * 100).toFixed(0)}%)`
        },
      });
      
      if (complexCount > 3) {
        recommendations.push(`${complexCount} complex surfaces require extensive tool path programming and slower feed rates. Consider simplifying geometry where possible.`);
        totalPotentialSavings += complexCount * 35;
      }
    }

    // ===== MANUFACTURABILITY CHECKS =====

    // Thin wall analysis (Both CNC and Sheet Metal)
    if (features.thinWalls.count > 0) {
      const wallStatus = 
        features.thinWalls.risk === "high" ? "critical" :
        features.thinWalls.risk === "medium" ? "warning" : "pass";

      checks.push({
        id: "thin-walls",
        name: "Wall Thickness",
        description: "Deflection risk assessment",
        status: wallStatus,
        details: `${features.thinWalls.minThickness.toFixed(1)}mm minimum, ${features.thinWalls.risk} risk`,
        icon: <Ruler className="w-4 h-4" />,
        category: "manufacturability",
        severity: features.thinWalls.risk === "high" ? "critical" : features.thinWalls.risk === "medium" ? "medium" : "low",
        potentialSavings: features.thinWalls.risk === "high" ? 120 : 45,
        actionable: wallStatus !== "pass",
        selectionHint: geometryFeatures && geometryFeatures.thinWalls.length > 0 ? {
          type: 'surface',
          featureType: 'thin-wall',
          location: geometryFeatures.thinWalls[0].centroid,
          triangles: geometryFeatures.thinWalls.flatMap(w => w.triangles).slice(0, 200),
          description: `${geometryFeatures.thinWalls.length} thin wall regions detected (accuracy: ${(geometryFeatures.thinWalls[0].confidence * 100).toFixed(0)}%)`
        } : {
          type: 'surface',
          featureType: 'thin-wall',
          description: `Thin walls ${features.thinWalls.minThickness.toFixed(1)}mm requiring special attention`,
        },
      });

      if (features.thinWalls.risk === "high") {
        recommendations.push(`Critical: Walls ${features.thinWalls.minThickness.toFixed(1)}mm thick will deflect during machining. Increase to 2.5mm minimum or accept high scrap risk.`);
        totalPotentialSavings += 120;
      } else if (features.thinWalls.risk === "medium") {
        recommendations.push(`Moderate thin walls (${features.thinWalls.minThickness.toFixed(1)}mm). Recommend increasing to 2.5mm for better rigidity.`);
        totalPotentialSavings += 45;
      }

      if (features.thinWalls.requiresSupportFixture) {
        recommendations.push("Specialized fixtures required to support thin walls during machining.");
      }
    }

    // Rib analysis (CNC only) - ENHANCED
    if (isCNC && features.ribs.thinRibCount > 2) {
      checks.push({
        id: "rib-thickness",
        name: "Rib Structures",
        description: "Rib manufacturability check",
        status: features.ribs.deflectionRisk === "high" ? "critical" : "warning",
        details: `${features.ribs.thinRibCount} thin ribs, ${features.ribs.minThickness.toFixed(1)}mm minimum`,
        icon: <Layers className="w-4 h-4" />,
        category: "manufacturability",
        severity: features.ribs.deflectionRisk === "high" ? "critical" : "medium",
        potentialSavings: features.ribs.deflectionRisk === "high" ? 55 : 30,
        actionable: true,
        selectionHint: geometryFeatures && geometryFeatures.ribs.length > 0 ? {
          type: 'feature',
          featureType: 'ribs',
          location: geometryFeatures.ribs[0].centroid,
          triangles: geometryFeatures.ribs.flatMap(r => r.triangles).slice(0, 100),
          description: `${geometryFeatures.ribs.length} elongated vertical features detected (confidence: ${(geometryFeatures.ribs[0].confidence * 100).toFixed(0)}%)`
        } : undefined,
      });

      recommendations.push(`${features.ribs.thinRibCount} ribs below 1.5mm thickness. Increase to 2mm minimum for manufacturability.`);
      totalPotentialSavings += features.ribs.deflectionRisk === "high" ? 55 : 30;
    }

    // Boss analysis (CNC only) - NEW
    if (geometryFeatures && geometryFeatures.bosses.length > 0) {
      const bossCount = geometryFeatures.bosses.length;
      const bossStatus = bossCount > 5 ? "info" : "pass";
      
      checks.push({
        id: "boss-features",
        name: "Boss Features",
        description: `${bossCount} raised cylindrical bosses`,
        status: bossStatus,
        details: `Require additional machining time`,
        icon: <Circle className="w-4 h-4" />,
        category: "features",
        severity: "low",
        actionable: false,
        selectionHint: {
          type: 'feature',
          featureType: 'bosses',
          location: geometryFeatures.bosses[0].centroid,
          triangles: geometryFeatures.bosses.flatMap(b => b.triangles).slice(0, 80),
          description: `${bossCount} cylindrical protrusions identified (confidence: ${(geometryFeatures.bosses[0].confidence * 100).toFixed(0)}%)`
        },
      });
    }

    // Sharp corner analysis - NEW
    if (geometryFeatures && geometryFeatures.sharpCorners.length > 5) {
      const cornerCount = geometryFeatures.sharpCorners.length;
      const cornerStatus = cornerCount > 15 ? "warning" : "info";
      
      checks.push({
        id: "sharp-corner-analysis",
        name: "Sharp Corner Detection",
        description: `${cornerCount} sharp corners detected`,
        status: cornerStatus,
        details: `High curvature areas requiring careful tooling`,
        icon: <Maximize2 className="w-4 h-4" />,
        category: "features",
        severity: cornerCount > 15 ? "medium" : "low",
        potentialSavings: cornerCount > 15 ? Math.min(cornerCount * 2, 50) : 0,
        actionable: cornerCount > 15,
        selectionHint: {
          type: 'feature',
          featureType: 'sharp-corners',
          location: geometryFeatures.sharpCorners[0].centroid,
          triangles: geometryFeatures.sharpCorners.flatMap(c => c.triangles).slice(0, 60),
          description: `${cornerCount} high-curvature regions (avg confidence: ${(geometryFeatures.sharpCorners.reduce((sum, c) => sum + c.confidence, 0) / cornerCount * 100).toFixed(0)}%)`
        },
      });
      
      if (cornerCount > 15) {
        recommendations.push(`${cornerCount} sharp corners detected. Consider adding small radii (0.5mm) to reduce tool wear and improve surface finish.`);
        totalPotentialSavings += Math.min(cornerCount * 2, 50);
      }
    }

    // ===== ENTERPRISE-LEVEL SHEET METAL CHECKS =====
    if (isSheetMetal && geometry.sheetMetalFeatures) {
      const smFeatures = geometry.sheetMetalFeatures;
      
      // Material Thickness Validation
      checks.push({
        id: "sheet-thickness-enterprise",
        name: "Material Thickness",
        description: "Sheet metal thickness validation",
        status: smFeatures.thickness >= 0.5 && smFeatures.thickness <= 25 ? "pass" : "warning",
        details: `${smFeatures.thickness.toFixed(2)}mm${smFeatures.partType ? ` • ${smFeatures.partType.replace(/-/g, ' ').toUpperCase()}` : ''}`,
        icon: <Layers className="w-4 h-4" />,
        category: "geometry",
        severity: smFeatures.thickness < 0.5 || smFeatures.thickness > 25 ? "high" : "low",
      });
      
      // Bend Radius Check (Enhanced)
      if (smFeatures.bendCount > 0) {
        const idealMinRadius = smFeatures.thickness * 1.0;
        const isBendRadiusOk = smFeatures.minBendRadius >= idealMinRadius;
        
        checks.push({
          id: "bend-radius-enterprise",
          name: "Bend Radius",
          description: "Minimum bend radius validation",
          status: isBendRadiusOk ? "pass" : smFeatures.hasSharptBends ? "critical" : "warning",
          details: `${smFeatures.minBendRadius.toFixed(2)}mm (${(smFeatures.minBendRadius / smFeatures.thickness).toFixed(1)}x material)`,
          icon: <Activity className="w-4 h-4" />,
          category: "feasibility",
          severity: smFeatures.hasSharptBends ? "critical" : isBendRadiusOk ? "low" : "medium",
          potentialSavings: !isBendRadiusOk ? 40 : 0,
        });
        
        if (!isBendRadiusOk) {
          recommendations.push(`⚠️ Increase bend radius to ${idealMinRadius.toFixed(1)}mm minimum to prevent cracking ($40 rework risk).`);
          totalPotentialSavings += 40;
        }
      }
      
      // Cutting Method & Efficiency
      if (smFeatures.recommendedCuttingMethod) {
        checks.push({
          id: "cutting-method-enterprise",
          name: "Cutting Process",
          description: "Optimal cutting method selection",
          status: "pass",
          details: `${smFeatures.recommendedCuttingMethod.replace('-', ' ').toUpperCase()} • ${smFeatures.estimatedCuttingTime?.toFixed(1)}min`,
          icon: <Zap className="w-4 h-4" />,
          category: "optimization",
          severity: "low",
        });
      }
      
      // Nesting Efficiency
      if (smFeatures.nestingEfficiency) {
        const isEfficient = smFeatures.nestingEfficiency > 0.75;
        const wasteSavings = !isEfficient ? Math.round((1 - smFeatures.nestingEfficiency) * smFeatures.flatArea / 1000 * 0.5) : 0;
        
        checks.push({
          id: "nesting-efficiency-enterprise",
          name: "Material Utilization",
          description: "Sheet nesting efficiency",
          status: isEfficient ? "pass" : "warning",
          details: `${(smFeatures.nestingEfficiency * 100).toFixed(0)}% utilization • ${((1 - smFeatures.nestingEfficiency) * 100).toFixed(0)}% scrap`,
          icon: <TrendingDown className="w-4 h-4" />,
          category: "optimization",
          severity: isEfficient ? "low" : "medium",
          potentialSavings: wasteSavings,
        });
        
        if (!isEfficient && wasteSavings > 10) {
          recommendations.push(`📊 Material waste at ${((1 - smFeatures.nestingEfficiency) * 100).toFixed(0)}%. Optimize part shape for $${wasteSavings} savings.`);
          totalPotentialSavings += wasteSavings;
        }
      }
      
      // Complexity & Setup Analysis
      const complexity = smFeatures.complexity || 'moderate';
      const requiresMultipleSetups = smFeatures.requiresMultipleSetups || false;
      
      if (complexity === 'complex' || complexity === 'very-complex' || requiresMultipleSetups) {
        const setupCost = requiresMultipleSetups ? 45 : 0;
        checks.push({
          id: "manufacturing-complexity-enterprise",
          name: "Manufacturing Complexity",
          description: `${complexity.toUpperCase()} part${requiresMultipleSetups ? ', multiple setups' : ''}`,
          status: complexity === 'very-complex' || requiresMultipleSetups ? "warning" : "info",
          details: `${smFeatures.bendCount} bends • ${smFeatures.holeCount} holes • ${smFeatures.estimatedCuttingTime?.toFixed(0)}+${smFeatures.estimatedFormingTime?.toFixed(0)}min`,
          icon: <LayoutDashboard className="w-4 h-4" />,
          category: "feasibility",
          severity: requiresMultipleSetups ? "high" : complexity === 'very-complex' ? "medium" : "low",
          potentialSavings: setupCost,
        });
        
        if (requiresMultipleSetups) {
          recommendations.push(`🔧 Multiple setups required add $${setupCost}. Consider single-setup redesign.`);
          totalPotentialSavings += setupCost;
        }
      }
      
      // Small Features Warning
      if (smFeatures.hasSmallFeatures) {
        checks.push({
          id: "small-features-enterprise",
          name: "Small Features",
          description: "Features smaller than recommended",
          status: "warning",
          details: "Features <2mm may be difficult to form accurately",
          icon: <Ruler className="w-4 h-4" />,
          category: "manufacturability",
          severity: "medium",
          potentialSavings: 20,
        });
        
        recommendations.push(`⚠️ Small features (<2mm) detected. Increase to ≥2mm for better quality ($20 rework savings).`);
        totalPotentialSavings += 20;
      }
      
      // Tolerance Feasibility
      if (smFeatures.hasTightTolerance) {
        checks.push({
          id: "tolerance-feasibility-enterprise",
          name: "Tolerance Requirements",
          description: "Tight tolerances on sheet metal",
          status: "warning",
          details: "Tolerances <±0.1mm require secondary operations (grinding/milling)",
          icon: <Ruler className="w-4 h-4" />,
          category: "tolerances",
          severity: "medium",
          potentialSavings: 35,
        });
        
        recommendations.push(`📏 Tight tolerances add $35. Relax to ±0.2mm if acceptable.`);
        totalPotentialSavings += 35;
      }
      
      // Cut Path Optimization
      if (smFeatures.straightCutLength && smFeatures.curvedCutLength) {
        const totalCutLength = smFeatures.straightCutLength + smFeatures.curvedCutLength;
        const complexCutRatio = smFeatures.curvedCutLength / totalCutLength;
        
        if (complexCutRatio > 0.3) {
          const savings = Math.round(smFeatures.curvedCutLength / 100);
          checks.push({
            id: "cut-path-optimization-enterprise",
            name: "Cutting Path Complexity",
            description: "High ratio of complex cuts",
            status: "warning",
            details: `${(complexCutRatio * 100).toFixed(0)}% curved cuts (${(smFeatures.curvedCutLength / 1000).toFixed(1)}m)`,
            icon: <Zap className="w-4 h-4" />,
            category: "optimization",
            severity: "medium",
            potentialSavings: savings,
          });
          
          recommendations.push(`✂️ ${(complexCutRatio * 100).toFixed(0)}% curved cuts slow production. Simplify for $${savings} savings.`);
          totalPotentialSavings += savings;
        }
      }
    }

    // SHEET METAL SPECIFIC CHECKS
    
    // SM1: Bend Operations (Sheet Metal only)
    if (isSheetMetal && geometry.sheetMetalFeatures?.bends) {
      const bends = geometry.sheetMetalFeatures.bends;
      const bendCount = bends.count || 0;
      const sharpBends = bends.sharpBends || 0;
      const minRadius = bends.minBendRadius || 0;
      const materialThickness = geometry.boundingBox?.z || 1.0;
      const minRecommendedRadius = materialThickness * 1.5;

      const bendStatus = 
        sharpBends > 0 ? "critical" :
        minRadius < minRecommendedRadius ? "warning" :
        bendCount > 20 ? "warning" : "pass";

      let bendSavings = 0;
      if (sharpBends > 0) bendSavings += sharpBends * 35;
      if (minRadius < minRecommendedRadius) bendSavings += 25;

      checks.push({
        id: "bend-operations",
        name: "Bend Operations",
        description: "Validates bend count, radius, and feasibility",
        status: bendStatus,
        category: "bending",
        icon: <Layers className="w-5 h-5" />,
        details: `${bendCount} bends, R${minRadius.toFixed(1)}mm minimum`,
        severity: sharpBends > 0 ? "critical" : minRadius < minRecommendedRadius ? "high" : "low",
        potentialSavings: bendSavings,
        actionable: bendSavings > 0,
      });

      if (sharpBends > 0) {
        recommendations.push(
          `Critical: ${sharpBends} sharp bends (radius < t) detected. Increase bend radius to ≥${minRecommendedRadius.toFixed(1)}mm. Savings: $${bendSavings}`
        );
      } else if (minRadius < minRecommendedRadius) {
        recommendations.push(
          `Bend radius ${minRadius.toFixed(1)}mm is tight for ${materialThickness}mm material. Recommended: ${minRecommendedRadius.toFixed(1)}mm.`
        );
      }

      totalPotentialSavings += bendSavings;
    }

    // SM2: Flange Features (Sheet Metal only)
    if (isSheetMetal && geometry.sheetMetalFeatures?.flanges) {
      const flanges = geometry.sheetMetalFeatures.flanges;
      const flangeCount = flanges.count || 0;
      const shortFlanges = flanges.shortFlanges || 0;
      const minFlangeLength = flanges.minLength || 0;
      const materialThickness = geometry.boundingBox?.z || 1.0;
      const minRecommendedLength = materialThickness * 3;

      const flangeStatus = 
        shortFlanges > 3 ? "critical" :
        shortFlanges > 0 ? "warning" : "pass";

      const flangeSavings = shortFlanges * 20;

      checks.push({
        id: "flange-features",
        name: "Flange Dimensions",
        description: "Checks flange length and manufacturability",
        status: flangeStatus,
        category: "forming",
        icon: <Maximize2 className="w-5 h-5" />,
        details: `${flangeCount} flanges, ${minFlangeLength.toFixed(1)}mm minimum`,
        severity: shortFlanges > 3 ? "critical" : shortFlanges > 0 ? "medium" : "low",
        potentialSavings: flangeSavings,
        actionable: flangeSavings > 0,
      });

      if (shortFlanges > 0) {
        recommendations.push(
          `${shortFlanges} flanges too short (< ${minRecommendedLength.toFixed(1)}mm). Extend to ≥${minRecommendedLength.toFixed(1)}mm. Savings: $${flangeSavings}`
        );
        totalPotentialSavings += flangeSavings;
      }
    }

    // SM3: Notches & Cutouts (Sheet Metal only)
    if (isSheetMetal && geometry.sheetMetalFeatures?.notches) {
      const notches = geometry.sheetMetalFeatures.notches;
      const notchCount = notches.count || 0;
      const sharpCorners = notches.sharpCorners || 0;
      const minRadius = notches.minRadius || 0;

      const notchStatus = sharpCorners > 5 ? "critical" : sharpCorners > 0 ? "warning" : "pass";
      const notchSavings = sharpCorners * 8;

      checks.push({
        id: "notch-cutouts",
        name: "Notches & Cutouts",
        description: "Validates corner radii and stress relief",
        status: notchStatus,
        category: "forming",
        icon: <Circle className="w-5 h-5" />,
        details: `${notchCount} notches, ${sharpCorners} sharp corners`,
        severity: sharpCorners > 5 ? "high" : sharpCorners > 0 ? "medium" : "low",
        potentialSavings: notchSavings,
        actionable: notchSavings > 0,
      });

      if (sharpCorners > 0) {
        recommendations.push(
          `${sharpCorners} notches have sharp corners. Add R0.5mm corner relief. Savings: $${notchSavings}.`
        );
        totalPotentialSavings += notchSavings;
      }
    }

    // Undercut & multi-axis analysis (CNC only) - ENHANCED
    if (isCNC && features.undercuts.count > 0) {
      checks.push({
        id: "undercuts",
        name: "Undercuts & Accessibility",
        description: "Multi-axis requirement check",
        status: features.undercuts.requires5Axis ? "warning" : "pass",
        details: `${features.undercuts.count} undercuts, ${features.undercuts.severity} severity`,
        icon: <Zap className="w-4 h-4" />,
        category: "manufacturability",
        severity: features.undercuts.requires5Axis ? "high" : "low",
        potentialSavings: features.undercuts.requires5Axis ? 180 : 0,
        actionable: features.undercuts.requires5Axis,
        selectionHint: geometryFeatures && geometryFeatures.undercuts.length > 0 ? {
          type: 'feature',
          featureType: 'undercuts',
          location: geometryFeatures.undercuts[0].centroid,
          triangles: geometryFeatures.undercuts.flatMap(u => u.triangles).slice(0, 120),
          description: `${geometryFeatures.undercuts.length} undercut regions with downward-facing geometry (confidence: ${(geometryFeatures.undercuts[0].confidence * 100).toFixed(0)}%)`
        } : undefined,
      });

      if (features.undercuts.requires5Axis) {
        recommendations.push(`${features.undercuts.count} undercuts require 5-axis machining. Redesign to eliminate undercuts for 28% cost reduction.`);
        totalPotentialSavings += 180;
      }
    }

    // Tool access analysis
    if (features.toolAccess.restrictedAreas > 2) {
      checks.push({
        id: "tool-access",
        name: "Tool Accessibility",
        description: "Setup complexity assessment",
        status: features.toolAccess.requiresMultiAxisMachining ? "warning" : "pass",
        details: `${features.toolAccess.estimatedSetupCount} setups, ${features.toolAccess.restrictedAreas} restricted areas`,
        icon: <LayoutDashboard className="w-4 h-4" />,
        category: "manufacturability",
        severity: features.toolAccess.requiresMultiAxisMachining ? "high" : "medium",
        potentialSavings: features.toolAccess.estimatedSetupCount * 35,
      });

      recommendations.push(`${features.toolAccess.restrictedAreas} restricted tool access areas require ${features.toolAccess.estimatedSetupCount} setups. Simplify geometry to reduce cost by $${features.toolAccess.estimatedSetupCount * 35}.`);
      totalPotentialSavings += features.toolAccess.estimatedSetupCount * 35;
    }

    // Surface finish requirements (CNC only)
    if (isCNC && (features.surfaceFinish.requiresPolishing || features.surfaceFinish.criticalSurfaces > 5)) {
      checks.push({
        id: "surface-finish",
        name: "Surface Finish Requirements",
        description: "Finish achievability check",
        status: features.surfaceFinish.requiresPolishing ? "warning" : "pass",
        details: `Ra ${features.surfaceFinish.estimatedRa}μm, ${features.surfaceFinish.criticalSurfaces} critical surfaces`,
        icon: <Sparkles className="w-4 h-4" />,
        category: "manufacturability",
        severity: "medium",
        potentialSavings: features.surfaceFinish.criticalSurfaces * 8,
      });

      if (features.surfaceFinish.criticalSurfaces > 5) {
        recommendations.push(`${features.surfaceFinish.criticalSurfaces} surfaces require fine finish. Relax to standard finish on non-critical surfaces for $${features.surfaceFinish.criticalSurfaces * 8} savings.`);
        totalPotentialSavings += features.surfaceFinish.criticalSurfaces * 8;
      }
    }

    // ===== TOLERANCE ANALYSIS =====
    if (geometry.toleranceFeasibility) {
      const tol = geometry.toleranceFeasibility;
      const tolStatus = 
        !tol.isAchievable ? "fail" :
        tol.concerns.length > 2 ? "warning" :
        tol.additionalCost > 100 ? "warning" : "pass";

      checks.push({
        id: "tolerance-feasibility",
        name: "Tolerance Feasibility",
        description: "Tolerance achievability analysis",
        status: tolStatus,
        details: `${tol.requiredProcess}, Cpk ${tol.estimatedCapability.toFixed(2)}`,
        icon: <CheckCheck className="w-4 h-4" />,
        category: "tolerances",
        severity: !tol.isAchievable ? "critical" : tol.concerns.length > 2 ? "high" : "medium",
        potentialSavings: tol.additionalCost,
        actionable: tol.concerns.length > 0,
      });

      if (!tol.isAchievable) {
        recommendations.push("Requested tolerances not achievable with current geometry. See concerns for details.");
      }

      tol.concerns.forEach((concern) => {
        if (!recommendations.includes(concern)) {
          recommendations.push(concern);
        }
      });

      tol.recommendations.slice(0, 2).forEach((rec) => {
        if (!recommendations.includes(rec)) {
          recommendations.push(rec);
        }
      });

      if (tol.additionalCost > 50) {
        totalPotentialSavings += Math.min(tol.additionalCost * 0.5, 200);
      }
    }

    // GD&T support
    if (geometry.toleranceFeasibility?.gdtSupport) {
      const gdt = geometry.toleranceFeasibility.gdtSupport;
      const hasGDT = gdt.flatness || gdt.perpendicularity || gdt.position;
      
      if (hasGDT) {
        checks.push({
          id: "gdt-requirements",
          name: "GD&T Requirements",
          description: "Geometric dimensioning & tolerancing",
          status: "info",
          details: `${gdt.flatness ? 'Flatness' : ''}${gdt.perpendicularity ? ', Perpendicularity' : ''}${gdt.position ? ', Position' : ''}`,
          icon: <Ruler className="w-4 h-4" />,
          category: "tolerances",
          severity: "medium",
        });
      }
    }

    // ===== OPTIMIZATION OPPORTUNITIES =====
    const dfmIssues = geometry.dfmIssues || [];
    dfmIssues.forEach((issue, index) => {
      if (issue.severity === "critical" && issue.potentialSavings && issue.potentialSavings > 30) {
        checks.push({
          id: `dfm-optimization-${index}`,
          name: issue.issue.split('.')[0].substring(0, 40),
          description: issue.recommendation.substring(0, 60),
          status: issue.severity === "critical" ? "critical" : "warning",
          details: issue.potentialSavings ? `$${issue.potentialSavings} savings` : undefined,
          icon: <Zap className="w-4 h-4" />,
          category: "optimization",
          severity: issue.severity === "critical" ? "critical" : issue.severity === "warning" ? "medium" : "low",
          potentialSavings: issue.potentialSavings,
          actionable: true,
        });

        if (issue.potentialSavings) {
          totalPotentialSavings += issue.potentialSavings;
        }
      }
    });

    // ===== ADVANCED ENTERPRISE-LEVEL CHECKS =====
    
    // Surface Roughness Analysis
    if (isCNC && features.surfaceFinish) {
      const requiresPolishing = features.surfaceFinish.estimatedRa > 1.6;
      const criticalSurfaces = features.surfaceFinish.criticalSurfaces || 0;
      
      if (requiresPolishing || criticalSurfaces > 0) {
        checks.push({
          id: "surface-finish-requirements",
          name: "Surface Finish Quality",
          description: `Ra ${features.surfaceFinish.estimatedRa.toFixed(2)}μm estimated`,
          status: requiresPolishing ? "warning" : "info",
          details: `${criticalSurfaces} critical surfaces requiring tight finish`,
          icon: <Sparkles className="w-4 h-4" />,
          category: "optimization",
          severity: requiresPolishing ? "medium" : "low",
          potentialSavings: requiresPolishing ? criticalSurfaces * 15 : 0,
          actionable: true,
        });
        
        if (requiresPolishing) {
          recommendations.push(`${criticalSurfaces} surfaces require Ra <1.6μm finish. Consider relaxing to Ra 3.2μm for ${criticalSurfaces * 15}$ savings.`);
          totalPotentialSavings += criticalSurfaces * 15;
        }
      }
    }
    
    // Feature Interaction Analysis
    if (geometryFeatures) {
      const holeCount = geometryFeatures.holes.length;
      const pocketCount = geometryFeatures.pockets.length;
      const threadCount = geometryFeatures.threads.length;
      
      // Check for features that are too close together
      let proximityIssues = 0;
      if (holeCount > 1) {
        for (let i = 0; i < Math.min(holeCount, 50); i++) {
          for (let j = i + 1; j < Math.min(holeCount, 50); j++) {
            const hole1 = geometryFeatures.holes[i];
            const hole2 = geometryFeatures.holes[j];
            const distance = Math.sqrt(
              Math.pow(hole1.centroid.x - hole2.centroid.x, 2) +
              Math.pow(hole1.centroid.y - hole2.centroid.y, 2) +
              Math.pow(hole1.centroid.z - hole2.centroid.z, 2)
            );
            if (distance < 5) proximityIssues++; // Features within 5mm
          }
        }
      }
      
      if (proximityIssues > 0) {
        checks.push({
          id: "feature-proximity-warning",
          name: "Feature Spacing Issues",
          description: `${proximityIssues} features too close together`,
          status: proximityIssues > 5 ? "warning" : "info",
          details: `Minimum 5mm spacing recommended for tool clearance`,
          icon: <Maximize2 className="w-4 h-4" />,
          category: "manufacturability",
          severity: proximityIssues > 5 ? "medium" : "low",
          potentialSavings: proximityIssues > 5 ? 40 : 0,
          actionable: true,
        });
        
        if (proximityIssues > 5) {
          recommendations.push(`${proximityIssues} features have insufficient spacing (<5mm). Increase spacing to avoid tool interference.`);
        }
      }
    }
    
    // Material Utilization Analysis
    if (geometry.volume && geometry.boundingBox) {
      const boxVolume = geometry.boundingBox.x * geometry.boundingBox.y * geometry.boundingBox.z;
      const materialUtilization = (geometry.volume / boxVolume) * 100;
      
      if (materialUtilization < 30) {
        checks.push({
          id: "material-efficiency",
          name: "Material Utilization",
          description: `${materialUtilization.toFixed(1)}% material usage`,
          status: materialUtilization < 20 ? "warning" : "info",
          details: `${(100 - materialUtilization).toFixed(1)}% material will be removed`,
          icon: <TrendingDown className="w-4 h-4" />,
          category: "optimization",
          severity: materialUtilization < 20 ? "medium" : "low",
          potentialSavings: materialUtilization < 20 ? 80 : 0,
          actionable: true,
        });
        
        if (materialUtilization < 20) {
          recommendations.push(`Low material utilization (${materialUtilization.toFixed(1)}%). Consider design optimization or alternative manufacturing process.`);
          totalPotentialSavings += 80;
        }
      }
    }
    
    // Assembly Considerations
    if (geometryFeatures && (geometryFeatures.holes.length > 10 || geometryFeatures.threads.length > 5)) {
      const fastenerCount = geometryFeatures.threads.length + Math.floor(geometryFeatures.holes.length * 0.4);
      
      checks.push({
        id: "assembly-complexity",
        name: "Assembly Features",
        description: `${fastenerCount} estimated fastener locations`,
        status: fastenerCount > 20 ? "info" : "pass",
        details: `May require assembly fixtures and torque specifications`,
        icon: <CheckCheck className="w-4 h-4" />,
        category: "features",
        severity: "low",
      });
    }
    
    // Manufacturability Score (Enterprise KPI)
    const manufacturabilityFactors = {
      simpleGeometry: geometry.complexity === 'simple' ? 25 : geometry.complexity === 'moderate' ? 15 : 5,
      standardFeatures: (features.holes.count < 15 && features.pockets.count < 8) ? 20 : 10,
      noUndercuts: !features.undercuts.requires5Axis ? 20 : 5,
      goodTolerance: part.tolerance === 'standard' ? 15 : part.tolerance === 'precision' ? 10 : 5,
      wallThickness: features.thinWalls.risk === 'low' ? 20 : features.thinWalls.risk === 'medium' ? 10 : 5,
    };
    
    const manufacturabilityScore = Object.values(manufacturabilityFactors).reduce((sum, val) => sum + val, 0);
    
    checks.push({
      id: "manufacturability-index",
      name: "DFM Score",
      description: `${manufacturabilityScore}/100 manufacturability rating`,
      status: manufacturabilityScore >= 80 ? "pass" : manufacturabilityScore >= 60 ? "info" : "warning",
      details: `${manufacturabilityScore >= 80 ? 'Excellent' : manufacturabilityScore >= 60 ? 'Good' : 'Challenging'} design for manufacturing`,
      icon: <Shield className="w-4 h-4" />,
      category: "optimization",
      severity: manufacturabilityScore < 60 ? "medium" : "low",
    });

    // Process complexity
    let complexityScore = 0;
    
    if (isCNC) {
      complexityScore = 
        (features.holes.count > 10 ? 1 : 0) +
        (features.pockets.count > 5 ? 1 : 0) +
        (features.threads.count > 8 ? 1 : 0) +
        (features.undercuts.requires5Axis ? 2 : 0) +
        (features.toolAccess.estimatedSetupCount > 2 ? 1 : 0);
    } else if (isSheetMetal) {
      const bends = geometry.sheetMetalFeatures?.bends?.count || 0;
      const flanges = geometry.sheetMetalFeatures?.flanges?.count || 0;
      const notches = geometry.sheetMetalFeatures?.notches?.count || 0;
      
      complexityScore =
        (bends > 8 ? 1 : 0) +
        (flanges > 6 ? 1 : 0) +
        (notches > 10 ? 1 : 0) +
        (features.holes.count > 20 ? 1 : 0) +
        (bends > 15 ? 1 : 0); // Multiple setups
    }

    checks.push({
      id: "process-complexity",
      name: "Processing Complexity",
      description: "Overall machining difficulty",
      status: geometry.complexity === "complex" ? "warning" : "pass",
      details: `${geometry.complexity} part, ${complexityScore > 3 ? 'high' : complexityScore > 1 ? 'moderate' : 'low'} complexity score`,
      icon: <LayoutDashboard className="w-4 h-4" />,
      category: "optimization",
      severity: geometry.complexity === "complex" ? "medium" : "low",
    });
  }

  // Calculate metrics
  const passCount = checks.filter((c) => c.status === "pass").length;
  const warningCount = checks.filter((c) => c.status === "warning").length;
  const failCount = checks.filter((c) => c.status === "fail").length;
  const criticalCount = checks.filter((c) => c.status === "critical").length;

  const overallScore = Math.max(0, Math.round(
    ((passCount * 100 + warningCount * 60 + failCount * 20 - criticalCount * 50) / (checks.length * 100)) * 100,
  ));

  let manufacturability: DFMAnalysisResult['manufacturability'];
  if (criticalCount > 0) manufacturability = "critical";
  else if (failCount > 0) manufacturability = "poor";
  else if (warningCount > 3) manufacturability = "fair";
  else if (warningCount > 0) manufacturability = "good";
  else manufacturability = "excellent";

  if (criticalCount === 0 && failCount === 0 && warningCount === 0) {
    recommendations.push("Part is optimized for manufacturing. No design changes required.");
  }

  return {
    overallScore,
    manufacturability,
    checks,
    recommendations: recommendations.slice(0, 8), // Limit to top 8
    estimatedIssues: failCount + warningCount + criticalCount,
    criticalIssues: criticalCount,
    potentialSavings: totalPotentialSavings,
    processingComplexity: geometry?.complexity || "moderate",
    processType,
  };
}

// Side Info Tile
const StatTile = ({
  label,
  value,
  color,
}: {
  label: string;
  value: string | number;
  color: string;
}) => (
  <div className="bg-white/50 border border-gray-100 rounded-xl p-3 flex flex-col gap-1">
    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
      {label}
    </span>
    <span className={cn("text-lg font-bold", color)}>{value}</span>
  </div>
);

const DFMAnalysis = ({ 
  part,
}: { 
  part: PartConfig;
}) => {
  const [analysis, setAnalysis] = useState<DFMAnalysisResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(true);
  const [geometryFeatures, setGeometryFeatures] = useState<GeometryFeatureMap | undefined>(undefined);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Load and analyze geometry for accurate feature detection
  useEffect(() => {
    async function loadAndAnalyzeGeometry() {
      if (!part.fileObject && !part.filePath) return;
      
      try {
        // Load the file
        const file = part.fileObject || await fetch(part.filePath!).then(r => r.blob());
        const fileExt = part.fileName.split('.').pop()?.toLowerCase();
        
        // Only analyze STL files for now (STEP files need backend processing)
        if (fileExt === 'stl') {
          // Geometry analysis will be implemented with backend integration
          // For now, we skip the 3D viewer functionality
          setGeometryFeatures(undefined);
        }
      } catch (error) {
        console.warn('Could not analyze geometry features:', error);
      }
    }
    
    loadAndAnalyzeGeometry();
  }, [part.fileObject, part.filePath, part.fileName]);

  useEffect(() => {
    setIsAnalyzing(true);
    const timer = setTimeout(() => {
      setAnalysis(analyzeDFM(part, geometryFeatures));
      setIsAnalyzing(false);
    }, 1200);
    return () => clearTimeout(timer);
  }, [part, geometryFeatures]);

  if (isAnalyzing || !analysis) {
    return (
      <div className="w-full h-full flex items-center justify-center p-12">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
              className="w-16 h-16 border-4 border-blue-500/20 border-t-blue-500 rounded-full"
            />
            <LayoutDashboard className="w-6 h-6 text-blue-500 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
          </div>
          <p className="text-gray-900 font-bold text-lg">Running DFM Engine</p>
          <div className="flex gap-1">
            {[0, 1, 2].map((i) => (
              <motion.div
                key={i}
                animate={{ opacity: [0, 1, 0] }}
                transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }}
                className="w-1.5 h-1.5 bg-blue-400 rounded-full"
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  const mood = {
    excellent: {
      color: "text-emerald-500",
      bg: "bg-emerald-500",
      light: "bg-emerald-50",
      border: "border-emerald-100",
      label: "Optimized",
    },
    good: {
      color: "text-blue-500",
      bg: "bg-blue-500",
      light: "bg-blue-50",
      border: "border-blue-100",
      label: "Standard",
    },
    fair: {
      color: "text-amber-500",
      bg: "bg-amber-500",
      light: "bg-amber-50",
      border: "border-amber-100",
      label: "Complex",
    },
    poor: {
      color: "text-rose-500",
      bg: "bg-rose-500",
      light: "bg-rose-50",
      border: "border-rose-100",
      label: "Issues",
    },
    critical: {
      color: "text-red-600",
      bg: "bg-red-600",
      light: "bg-red-50",
      border: "border-red-200",
      label: "Critical",
    },
  }[analysis.manufacturability];

  return (
    <div className="w-full h-full max-h-screen flex flex-col bg-white overflow-hidden rounded-2xl shadow-sm border">
      {/* Header Sticky */}
      <div className="flex-shrink-0 border-b bg-white p-5 flex items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div
            className={cn(
              "w-14 h-14 rounded-2xl flex items-center justify-center text-white font-black text-xl shadow-lg",
              mood.bg,
            )}
          >
            {analysis.overallScore}
          </div>
          <div>
            <h3 className="font-bold text-gray-900 text-lg">
              Manufacturability Report
            </h3>
            <div className="flex items-center gap-2 mt-0.5">
              <span
                className={cn(
                  "inline-block w-2h w-2 h-2 rounded-full",
                  mood.bg,
                )}
              />
              <span
                className={cn(
                  "text-xs font-bold uppercase tracking-wide",
                  mood.color,
                )}
              >
                {mood.label}
              </span>
              <span className="text-gray-300 mx-1">|</span>
              <span className="text-xs text-gray-500 font-medium">
                10+ Point Inspection
              </span>
            </div>
          </div>
        </div>

        <div className="hidden md:flex items-center gap-3">
          <StatTile
            label="Critical"
            value={analysis.criticalIssues}
            color={analysis.criticalIssues > 0 ? "text-red-600" : "text-gray-400"}
          />
          <StatTile
            label="Issues"
            value={analysis.estimatedIssues}
            color={analysis.estimatedIssues > 0 ? "text-rose-600" : "text-gray-400"}
          />
          <StatTile
            label="Passed"
            value={analysis.checks.filter((c) => c.status === "pass").length}
            color="text-emerald-600"
          />
          {analysis.potentialSavings > 0 && (
            <StatTile
              label="Savings"
              value={`$${analysis.potentialSavings}`}
              color="text-green-600"
            />
          )}
        </div>
      </div>

      {/* Main Content Area - Split View */}
      <div className="flex-1 flex overflow-hidden min-h-0">
        {/* Left Sidebar - Summary & recommendations */}
        <div className="w-72 border-r bg-gray-50/30 p-5 overflow-y-auto hidden lg:block">
          <h4 className="text-[11px] font-black text-gray-400 uppercase tracking-widest mb-4">
            Analysis Summary
          </h4>
          <div className="space-y-3 mb-8">
            {(analysis.processType === "sheet-metal" 
              ? ["geometry", "bending", "forming", "features", "tolerances", "optimization"]
              : ["geometry", "manufacturability", "features", "tolerances", "optimization"]
            ).map((cat) => {
              const catChecks = analysis.checks.filter(
                (c) => c.category === cat,
              );
              if (catChecks.length === 0) return null;
              const pass = catChecks.filter((c) => c.status === "pass").length;
              const critical = catChecks.filter((c) => c.status === "critical").length;
              return (
                <div key={cat} className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between text-xs font-bold px-1">
                    <span className="capitalize">{cat}</span>
                    <span className={critical > 0 ? "text-red-600" : "text-gray-400"}>
                      {pass}/{catChecks.length}
                    </span>
                  </div>
                  <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${(pass / catChecks.length) * 100}%` }}
                      className={cn(
                        "h-full transition-all duration-1000",
                        critical > 0 ? "bg-red-500" : mood.bg,
                      )}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {analysis.potentialSavings > 0 && (
            <div className="bg-gradient-to-br from-green-50 to-emerald-50 border border-green-100 rounded-xl p-4 mb-6">
              <div className="flex items-center gap-2 mb-2">
                <Zap className="w-4 h-4 text-green-600 fill-green-600" />
                <span className="text-xs font-black uppercase tracking-widest text-green-700">
                  Cost Savings
                </span>
              </div>
              <div className="text-2xl font-black text-green-700">
                ${analysis.potentialSavings.toFixed(0)}
              </div>
              <p className="text-[10px] text-green-600 font-medium mt-1">
                Potential savings from design optimization
              </p>
            </div>
          )}

          <AnimatePresence>
            {analysis.recommendations.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-gray-900 rounded-xl p-4 text-white shadow-xl shadow-gray-200/50"
              >
                <div className="flex items-center gap-2 mb-3">
                  <Zap className="w-4 h-4 text-amber-400 fill-amber-400" />
                  <span className="text-xs font-black uppercase tracking-widest">
                    Recommendations
                  </span>
                </div>
                <ul className="space-y-3">
                  {analysis.recommendations.map((rec, i) => (
                    <li
                      key={i}
                      className="text-[11px] leading-relaxed text-gray-300 font-medium border-l border-white/20 pl-3"
                    >
                      {rec}
                    </li>
                  ))}
                </ul>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Right Content - Scrollable Detailed Checklist */}
        <div
          ref={scrollRef}
          className="flex-1 bg-white overflow-y-auto p-6 scroll-smooth"
        >
          <div className="max-w-xl mx-auto space-y-8">
            {/* Category Groups */}
            {(analysis.processType === "sheet-metal"
              ? (["geometry", "bending", "forming", "features", "tolerances", "optimization"] as const)
              : (["geometry", "manufacturability", "features", "tolerances", "optimization"] as const)
            ).map((cat) => {
              const catChecks = analysis.checks.filter((c) => c.category === cat);
              if (catChecks.length === 0) return null;
              
              const categoryLabel = 
                cat === "manufacturability" ? "Assessment" :
                cat === "optimization" ? "Opportunities" :
                cat === "bending" ? "Operations" :
                cat === "forming" ? "Features" :
                "Analysis";
              
              return (
                <div key={cat} className="space-y-4">
                  <div className="flex items-center gap-3">
                    <h5 className="text-xs font-black uppercase tracking-widest text-gray-400">
                      {cat} {categoryLabel}
                    </h5>
                    <div className="flex-1 h-px bg-gray-100" />
                  </div>

                  <div className="grid gap-3">
                    {catChecks.map((check) => (
                      <div
                        key={check.id}
                        className={cn(
                          "group p-4 rounded-xl border flex items-start gap-4 transition-all hover:shadow-md active:scale-[0.99]",
                          check.status === "pass"
                            ? "bg-white border-gray-100 hover:border-gray-200"
                            : check.status === "critical"
                            ? "bg-red-50 border-red-200 hover:border-red-300"
                            : check.status === "fail"
                            ? "bg-rose-50 border-rose-200 hover:border-rose-300"
                            : mood.light + " " + mood.border,
                        )}
                      >
                        <div
                          className={cn(
                            "w-10 h-10 rounded-xl flex items-center justify-center border flex-shrink-0",
                            check.status === "pass"
                              ? "bg-emerald-50 text-emerald-600 border-emerald-100"
                              : check.status === "critical"
                              ? "bg-red-100 text-red-600 border-red-200"
                              : check.status === "fail"
                              ? "bg-rose-100 text-rose-600 border-rose-200"
                              : "bg-white text-gray-500 border-gray-100",
                          )}
                        >
                          {check.icon}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2 mb-1">
                            <span className="font-bold text-gray-900 text-sm leading-tight">
                              {check.name}
                            </span>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              {check.potentialSavings && check.potentialSavings > 0 && (
                                <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-tight bg-green-100 text-green-700">
                                  ${check.potentialSavings}
                                </span>
                              )}
                              <span
                                className={cn(
                                  "px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-tight",
                                  check.status === "pass"
                                    ? "bg-emerald-100 text-emerald-700"
                                    : check.status === "critical"
                                    ? "bg-red-600 text-white animate-pulse"
                                    : check.status === "fail"
                                    ? "bg-rose-600 text-white"
                                    : mood.bg + " text-white",
                                )}
                              >
                                {check.status === "pass" ? "✓ OK" : check.status.toUpperCase()}
                              </span>
                            </div>
                          </div>
                          <p className="text-[11px] text-gray-500 font-medium mb-1.5">
                            {check.description}
                          </p>
                          {check.details && (
                            <div className="flex items-center gap-2 mt-1">
                              <p className="text-xs text-gray-700 font-semibold bg-gray-50 px-2 py-0.5 rounded">
                                {check.details}
                              </p>
                            </div>
                          )}
                          {check.severity && check.status !== "pass" && (
                            <div className="mt-2">
                              <span className={cn(
                                "text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded",
                                check.severity === "critical" && "bg-red-100 text-red-700",
                                check.severity === "high" && "bg-orange-100 text-orange-700",
                                check.severity === "medium" && "bg-amber-100 text-amber-700",
                                check.severity === "low" && "bg-yellow-100 text-yellow-700",
                              )}>
                                {check.severity} priority
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}

            {/* Final Footer Info */}
            <div className="pt-10 pb-6 text-center">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-gray-50 rounded-full border border-gray-100">
                <Shield className="w-3 h-3 text-gray-400" />
                <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">
                  {analysis.checks.length}+ Point Inspection • {analysis.processType === "sheet-metal" ? "Sheet Metal" : "CNC Machining"} • {analysis.processingComplexity} Complexity
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DFMAnalysis;
