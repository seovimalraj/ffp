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
  Eye,
  EyeOff,
} from "lucide-react";
import React, { useEffect, useState, useRef } from "react";
import { cn } from "@/lib/utils";
import { PartConfig } from "@/types/part-config";
import { motion, AnimatePresence } from "framer-motion";

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

function analyzeDFM(part: PartConfig): DFMAnalysisResult {
  const checks: DFMCheck[] = [];
  const recommendations: string[] = [];
  let totalPotentialSavings = 0;

  const geometry = part.geometry;
  const hasGeometry = !!geometry;
  
  // Detect process type - check part config or geometry
  const processType: "cnc" | "sheet-metal" | "unknown" = 
    part.process === "sheet-metal" ? "sheet-metal" :
    part.process === "cnc" || part.process === "cnc-milling" || part.process === "cnc-turning" ? "cnc" :
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
        selectionHint: features.holes.count > 0 ? {
          type: 'feature',
          featureType: 'holes',
          location: { x: 0, y: 0, z: 10 },
          triangles: [10, 11, 12, 13, 14, 15, 16, 17, 18, 19], // Sample triangle indices
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
        selectionHint: features.pockets.count > 0 ? {
          type: 'feature',
          featureType: 'pockets',
          location: { x: 0, y: 0, z: -5 },
          triangles: [20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31], // Sample triangle indices
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
      });

      recommendations.push(`${features.fillets.missingFilletCount} sharp internal corners increase stress concentration (risk: ${features.fillets.stressConcentrationRisk}/10). Add R${features.fillets.minRadius.toFixed(1)}mm fillets to prevent crack initiation.`);
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
        selectionHint: {
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

    // Rib analysis (CNC only)
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
      });

      recommendations.push(`${features.ribs.thinRibCount} ribs below 1.5mm thickness. Increase to 2mm minimum for manufacturability.`);
      totalPotentialSavings += features.ribs.deflectionRisk === "high" ? 55 : 30;
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

    // Undercut & multi-axis analysis (CNC only)
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
  selectedHighlight = null,
  onHighlightChange,
}: { 
  part: PartConfig;
  selectedHighlight?: string | null;
  onHighlightChange?: (checkId: string | null, selectionHint?: {
    type: 'feature' | 'surface' | 'edge' | 'dimension';
    featureType?: string;
    location?: { x: number; y: number; z: number };
    triangles?: number[];
    description?: string;
  }) => void;
}) => {
  const [analysis, setAnalysis] = useState<DFMAnalysisResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setIsAnalyzing(true);
    const timer = setTimeout(() => {
      setAnalysis(analyzeDFM(part));
      setIsAnalyzing(false);
    }, 1200);
    return () => clearTimeout(timer);
  }, [part]);

  const toggleHighlight = (checkId: string, check: DFMCheck) => {
    const newCheckId = selectedHighlight === checkId ? null : checkId;
    if (onHighlightChange) {
      onHighlightChange(newCheckId, newCheckId ? check.selectionHint : undefined);
    }
    console.log('Highlight feature:', newCheckId, check.selectionHint);
  };

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
                              {check.selectionHint && (
                                <button
                                  onClick={() => toggleHighlight(check.id, check)}
                                  className={cn(
                                    "p-1.5 rounded-lg transition-all hover:scale-110 active:scale-95",
                                    selectedHighlight === check.id
                                      ? "bg-blue-500 text-white shadow-md"
                                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                                  )}
                                  title={selectedHighlight === check.id ? "Hide in 3D" : "Show in 3D"}
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                </button>
                              )}
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
