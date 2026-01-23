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
  Activity,
  Droplet,
} from "lucide-react";
import React, { useEffect, useState, useRef } from "react";
import { cn } from "@/lib/utils";
import { PartConfig } from "@/types/part-config";
import { motion, AnimatePresence } from "framer-motion";
import { GeometryFeatureMap } from "@/lib/geometry-feature-locator";

// DFM Check Status Types
type CheckStatus =
  | "pass"
  | "warning"
  | "fail"
  | "critical"
  | "info"
  | "loading";

interface DFMCheck {
  id: string;
  name: string;
  description: string;
  status: CheckStatus;
  details?: string;
  icon: React.ReactNode;
  category:
    | "geometry"
    | "feasibility"
    | "manufacturability"
    | "tolerances"
    | "features"
    | "optimization"
    | "bending"
    | "forming";
  severity?: "low" | "medium" | "high" | "critical";
  potentialSavings?: number;
  actionable?: boolean;
  selectionHint?: {
    type: "feature" | "surface" | "edge" | "dimension";
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

const SUPPORTED_FILE_TYPES = new Set([
  "stl",
  "step",
  "stp",
  "iges",
  "igs",
  "obj",
  "3mf",
  "x_t",
  "x_b",
]);
const MAX_DIMENSIONS = { x: 1000, y: 500, z: 500 };
const MIN_WALL_THICKNESS = 0.8;

function analyzeDFM(
  part: PartConfig,
  geometryFeatures?: GeometryFeatureMap,
): DFMAnalysisResult {
  const checks: DFMCheck[] = [];
  const recommendations: string[] = [];
  let totalPotentialSavings = 0;

  const geometry = part.geometry;
  const hasGeometry = !!geometry;

  // ENTERPRISE: Process detection with explicit part.process priority
  const processType: "cnc" | "sheet-metal" | "unknown" =
    part.process === "sheet-metal" || part.process?.includes("sheet")
      ? "sheet-metal"
      : part.process === "cnc-milling" ||
          part.process === "cnc-turning" ||
          part.process === "cnc"
        ? "cnc"
        : geometry?.recommendedProcess === "sheet-metal"
          ? "sheet-metal"
          : geometry?.recommendedProcess?.includes("sheet")
            ? "sheet-metal"
            : geometry?.recommendedProcess === "cnc-milling" ||
                geometry?.recommendedProcess === "cnc-turning"
              ? "cnc"
              : geometry?.sheetMetalFeatures
                ? "sheet-metal"
                : "cnc"; // Default to CNC

  const isCNC = processType === "cnc";
  const isSheetMetal = processType === "sheet-metal";

  // Process type indicator
  checks.push({
    id: "process-type",
    name: "Manufacturing Process",
    description: `Detected as ${processType === "sheet-metal" ? "Sheet Metal Fabrication" : "CNC Machining"}`,
    status: "pass",
    details: isSheetMetal
      ? "Laser cutting, bending, forming operations"
      : "Milling, turning, drilling operations",
    icon: isSheetMetal ? (
      <Layers className="w-4 h-4" />
    ) : (
      <Zap className="w-4 h-4" />
    ),
    category: "geometry",
    severity: "low",
  });

  // ===== GEOMETRY VALIDATION =====
  const fileExt = part.fileName.split(".").pop()?.toLowerCase() || "";
  const isValidFileType = SUPPORTED_FILE_TYPES.has(fileExt);
  checks.push({
    id: "file-type",
    name: "File Format",
    description: "CAD file format validation",
    status: isValidFileType ? "pass" : "fail",
    details: isValidFileType
      ? `${fileExt.toUpperCase()} format`
      : "Unsupported format",
    icon: <FileType className="w-4 h-4" />,
    category: "geometry",
    severity: isValidFileType ? "low" : "critical",
    actionable: !isValidFileType,
  });

  if (!isValidFileType) {
    recommendations.push(
      "Convert file to STEP or STL format for accurate analysis.",
    );
  }

  // Model integrity
  checks.push({
    id: "model-integrity",
    name: "Geometric Integrity",
    description: "3D model structure validation",
    status: hasGeometry ? "pass" : "fail",
    details: hasGeometry
      ? `${geometry.complexity} geometry validated`
      : "No geometry data",
    icon: <Shield className="w-4 h-4" />,
    category: "geometry",
    severity: hasGeometry ? "low" : "critical",
  });

  if (hasGeometry) {
    const boundingBox = geometry.boundingBox;
    const maxDim = Math.max(boundingBox.x, boundingBox.y, boundingBox.z);
    const _minDim = Math.min(boundingBox.x, boundingBox.y, boundingBox.z);

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
      recommendations.push(
        `Part exceeds machine capacity. Consider splitting into smaller components or using specialized equipment.`,
      );
    }

    // ===== ADVANCED FEATURE ANALYSIS =====
    const features = geometry.advancedFeatures;

    // Hole analysis
    if (features.holes.count > 0) {
      const holeStatus =
        features.holes.microHoleCount > 0
          ? "critical"
          : features.holes.deepHoleCount > 3
            ? "warning"
            : features.holes.toolAccessIssues > 0
              ? "warning"
              : "pass";

      checks.push({
        id: "hole-features",
        name: "Hole Design Review",
        description: `${features.holes.count} holes detected in your design`,
        status: holeStatus,
        details: `${features.holes.throughHoles} through-holes, ${features.holes.blindHoles} blind holes${features.holes.tappedHoles > 0 ? `, ${features.holes.tappedHoles} threaded` : ""}`,
        icon: <Circle className="w-4 h-4" />,
        category: "features",
        severity: features.holes.microHoleCount > 0 ? "critical" : "medium",
        potentialSavings:
          features.holes.microHoleCount * 50 +
          features.holes.deepHoleCount * 20,
        actionable: holeStatus !== "pass",
        selectionHint:
          geometryFeatures && geometryFeatures.holes.length > 0
            ? {
                type: "feature",
                featureType: "holes",
                location: geometryFeatures.holes[0].centroid,
                triangles: geometryFeatures.holes
                  .flatMap((h) => h.triangles)
                  .slice(0, 100),
                description: `${geometryFeatures.holes.length} hole locations detected with ${(geometryFeatures.holes[0].confidence * 100).toFixed(0)}% accuracy`,
              }
            : features.holes.count > 0
              ? {
                  type: "feature",
                  featureType: "holes",
                  location: { x: 0, y: 0, z: 10 },
                  triangles: [],
                  description: `${features.holes.count} holes in design`,
                }
              : undefined,
      });

      if (features.holes.microHoleCount > 0) {
        recommendations.push(
          `Your design has ${features.holes.microHoleCount} very small holes (under 1mm diameter). These are difficult to manufacture accurately. We recommend increasing hole diameters to at least 1mm where possible.`,
        );
        totalPotentialSavings += features.holes.microHoleCount * 50;
      }
      if (features.holes.deepHoleCount > 0) {
        recommendations.push(
          `${features.holes.deepHoleCount} holes in your design are very deep relative to their diameter. Consider using shorter holes or larger diameters to ensure better quality and accuracy.`,
        );
        totalPotentialSavings += features.holes.deepHoleCount * 20;
      }
      if (
        features.holes.drillingMethod === "gun-drill" ||
        features.holes.drillingMethod === "boring"
      ) {
        recommendations.push(
          `Some holes require specialized manufacturing processes, which may extend delivery time by 1-2 days.`,
        );
      }
    }

    // Pocket & boss analysis (CNC only)
    if (isCNC && features.pockets.count > 0) {
      const pocketStatus =
        features.pockets.sharpCornersCount > 5
          ? "warning"
          : features.pockets.deepPockets > 3
            ? "warning"
            : "pass";

      checks.push({
        id: "pocket-features",
        name: "Pocket & Cavity Design",
        description: `${features.pockets.count} pockets detected in your design`,
        status: pocketStatus,
        details: `${features.pockets.deepPockets > 0 ? `${features.pockets.deepPockets} deep pockets` : "Standard depths"}${features.pockets.sharpCornersCount > 0 ? `, ${features.pockets.sharpCornersCount} sharp corners` : ""}`,
        icon: <Layers className="w-4 h-4" />,
        category: "features",
        severity: pocketStatus === "warning" ? "medium" : "low",
        potentialSavings:
          features.pockets.sharpCornersCount * 8 +
          features.pockets.deepPockets * 25,
        actionable: pocketStatus === "warning",
        selectionHint:
          geometryFeatures && geometryFeatures.pockets.length > 0
            ? {
                type: "feature",
                featureType: "pockets",
                location: geometryFeatures.pockets[0].centroid,
                triangles: geometryFeatures.pockets
                  .flatMap((p) => p.triangles)
                  .slice(0, 150),
                description: `${geometryFeatures.pockets.length} pocket areas identified with ${(geometryFeatures.pockets[0].confidence * 100).toFixed(0)}% confidence`,
              }
            : features.pockets.count > 0
              ? {
                  type: "feature",
                  featureType: "pockets",
                  location: { x: 0, y: 0, z: -5 },
                  triangles: [],
                  description: `${features.pockets.count} pockets in design`,
                }
              : undefined,
      });

      if (features.pockets.sharpCornersCount > 3) {
        recommendations.push(
          `Your design has ${features.pockets.sharpCornersCount} pockets with sharp internal corners. Adding small corner radii (${features.pockets.minCornerRadius.toFixed(1)}mm or larger) will improve part quality and reduce manufacturing time.`,
        );
        totalPotentialSavings += features.pockets.sharpCornersCount * 8;
      }
      if (features.pockets.deepPockets > 2) {
        recommendations.push(
          `${features.pockets.deepPockets} pockets in your design are quite deep. If possible, reducing the depth will improve surface finish quality.`,
        );
        totalPotentialSavings += features.pockets.deepPockets * 25;
      }
    }

    // Thread analysis (CNC only)
    if (isCNC && features.threads.count > 0) {
      checks.push({
        id: "thread-features",
        name: "Threaded Features",
        description: `${features.threads.count} threaded holes/features`,
        status: features.threads.count > 10 ? "warning" : "pass",
        details: `${features.threads.internalThreads} internal threads, ${features.threads.externalThreads} external threads`,
        icon: <Zap className="w-4 h-4" />,
        category: "features",
        severity: features.threads.count > 10 ? "medium" : "low",
        potentialSavings: Math.min(features.threads.count * 3, 80),
      });

      if (features.threads.count > 8) {
        recommendations.push(
          `Your design has ${features.threads.count} threaded features. Consider whether all threads are necessary, or if some could be replaced with clearance holes for through-bolts.`,
        );
      }
    }

    // Fillet analysis (CNC only)
    if (isCNC && features.fillets.missingFilletCount > 2) {
      checks.push({
        id: "fillet-analysis",
        name: "Internal Corner Design",
        description: "Sharp corner stress analysis",
        status:
          features.fillets.stressConcentrationRisk > 6 ? "critical" : "warning",
        details: `${features.fillets.missingFilletCount} sharp internal corners detected`,
        icon: <Shield className="w-4 h-4" />,
        category: "features",
        severity:
          features.fillets.stressConcentrationRisk > 6 ? "critical" : "medium",
        actionable: true,
        selectionHint:
          geometryFeatures && geometryFeatures.fillets.length > 0
            ? {
                type: "feature",
                featureType: "fillets",
                location: geometryFeatures.fillets[0].centroid,
                triangles: geometryFeatures.fillets
                  .flatMap((f) => f.triangles)
                  .slice(0, 80),
                description: `${geometryFeatures.fillets.length} fillet locations detected (avg confidence: ${((geometryFeatures.fillets.reduce((sum, f) => sum + f.confidence, 0) / geometryFeatures.fillets.length) * 100).toFixed(0)}%)`,
              }
            : undefined,
      });

      recommendations.push(
        `Your design has ${features.fillets.missingFilletCount} sharp internal corners. Adding fillets (${features.fillets.minRadius.toFixed(1)}mm radius recommended) will significantly improve part strength and durability under load.`,
      );
    }

    // Chamfer analysis (CNC only) - NEW
    if (isCNC && geometryFeatures && geometryFeatures.chamfers.length > 0) {
      const chamferCount = geometryFeatures.chamfers.length;
      const chamferStatus = chamferCount < 5 ? "info" : "pass";

      checks.push({
        id: "chamfer-features",
        name: "Edge Chamfers",
        description: `${chamferCount} chamfered edges detected`,
        status: chamferStatus,
        details: `Deburring and edge finishing requirements`,
        icon: <Maximize2 className="w-4 h-4" />,
        category: "features",
        severity: "low",
        actionable: false,
        selectionHint: {
          type: "feature",
          featureType: "chamfers",
          location: geometryFeatures.chamfers[0].centroid,
          triangles: geometryFeatures.chamfers
            .flatMap((c) => c.triangles)
            .slice(0, 60),
          description: `${chamferCount} chamfer edges identified (avg confidence: ${((geometryFeatures.chamfers.reduce((sum, c) => sum + c.confidence, 0) / chamferCount) * 100).toFixed(0)}%)`,
        },
      });
    }

    // Thread feature analysis from geometry - ENHANCED
    if (geometryFeatures && geometryFeatures.threads.length > 0) {
      const threadCount = geometryFeatures.threads.length;
      const threadStatus = threadCount > 5 ? "warning" : "info";

      checks.push({
        id: "thread-geometry-features",
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
          type: "feature",
          featureType: "threads",
          location: geometryFeatures.threads[0].centroid,
          triangles: geometryFeatures.threads
            .flatMap((t) => t.triangles)
            .slice(0, 120),
          description: `${threadCount} threaded regions (helical patterns) detected with ${(geometryFeatures.threads[0].confidence * 100).toFixed(0)}% confidence`,
        },
      });

      if (threadCount > 5) {
        recommendations.push(
          `${threadCount} threaded features detected. Consider using press-fit inserts or reducing thread count to lower manufacturing time.`,
        );
        totalPotentialSavings += threadCount * 8;
      }
    }

    // Counterbore/Countersink analysis - NEW
    if (
      geometryFeatures &&
      (geometryFeatures.counterbores.length > 0 ||
        geometryFeatures.countersinks.length > 0)
    ) {
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
        selectionHint:
          cbCount > 0
            ? {
                type: "feature",
                featureType: "counterbores",
                location: geometryFeatures.counterbores[0].centroid,
                triangles: [
                  ...geometryFeatures.counterbores,
                  ...geometryFeatures.countersinks,
                ]
                  .flatMap((f) => f.triangles)
                  .slice(0, 100),
                description: `${total} secondary hole features detected`,
              }
            : undefined,
      });

      if (total > 8) {
        recommendations.push(
          `Your design has ${total} counterbore/countersink holes. If some of these aren't required for flush fasteners, using simple holes would simplify manufacturing.`,
        );
        totalPotentialSavings += total * 4;
      }
    }

    // Slot analysis - NEW
    if (geometryFeatures && geometryFeatures.slots.length > 0) {
      const slotCount = geometryFeatures.slots.length;
      const slotStatus = slotCount > 3 ? "warning" : "info";

      checks.push({
        id: "slot-features",
        name: "Slot Features",
        description: `${slotCount} elongated slot${slotCount !== 1 ? "s" : ""} detected`,
        status: slotStatus,
        details:
          slotCount > 3
            ? `Consider simplifying if possible`
            : `Standard machining required`,
        icon: <Layers className="w-4 h-4" />,
        category: "features",
        severity: slotCount > 3 ? "medium" : "low",
        potentialSavings: slotCount * 15,
        actionable: slotCount > 3,
        selectionHint: {
          type: "feature",
          featureType: "slots",
          location: geometryFeatures.slots[0].centroid,
          triangles: geometryFeatures.slots
            .flatMap((s) => s.triangles)
            .slice(0, 150),
          description: `${slotCount} slot features detected`,
        },
      });

      if (slotCount > 3) {
        recommendations.push(
          `Your design has ${slotCount} slots. Where adjustment isn't needed, using round holes instead would simplify manufacturing.`,
        );
        totalPotentialSavings += slotCount * 15;
      }
    }

    // Tool access restriction analysis - NEW
    if (geometryFeatures && geometryFeatures.toolAccessRestricted.length > 0) {
      const restrictedCount = geometryFeatures.toolAccessRestricted.length;
      const restrictionStatus =
        restrictedCount > 2
          ? "critical"
          : restrictedCount > 0
            ? "warning"
            : "pass";

      checks.push({
        id: "tool-access-restrictions",
        name: "Hard-to-Reach Areas",
        description: `${restrictedCount} area${restrictedCount !== 1 ? "s" : ""} with limited access`,
        status: restrictionStatus,
        details: `May require special handling`,
        icon: <Zap className="w-4 h-4" />,
        category: "manufacturability",
        severity: restrictedCount > 2 ? "high" : "medium",
        potentialSavings: restrictedCount * 45,
        actionable: true,
        selectionHint: {
          type: "feature",
          featureType: "tool-access",
          location: geometryFeatures.toolAccessRestricted[0].centroid,
          triangles: geometryFeatures.toolAccessRestricted
            .flatMap((r) => r.triangles)
            .slice(0, 200),
          description: `${restrictedCount} areas with limited tool access`,
        },
      });

      if (restrictedCount > 0) {
        recommendations.push(
          `${restrictedCount} area${restrictedCount !== 1 ? "s are" : " is"} difficult to access with standard tools. Opening up tight spaces or adding clearance would improve manufacturability.`,
        );
        totalPotentialSavings += restrictedCount * 45;
      }
    }

    // Complex surface analysis - NEW
    if (geometryFeatures && geometryFeatures.complexSurfaces.length > 0) {
      const complexCount = geometryFeatures.complexSurfaces.length;
      const complexStatus = complexCount > 3 ? "warning" : "info";

      checks.push({
        id: "complex-surfaces",
        name: "Curved Surfaces",
        description: `${complexCount} complex curved surface${complexCount !== 1 ? "s" : ""}`,
        status: complexStatus,
        details:
          complexCount > 3
            ? `Consider simplifying if not functionally required`
            : `Curved surfaces will be machined with ball end mills`,
        icon: <Sparkles className="w-4 h-4" />,
        category: "manufacturability",
        severity: complexCount > 3 ? "medium" : "low",
        potentialSavings: complexCount * 35,
        actionable: complexCount > 3,
        selectionHint: {
          type: "surface",
          featureType: "complex-surface",
          location: geometryFeatures.complexSurfaces[0].centroid,
          triangles: geometryFeatures.complexSurfaces
            .flatMap((cs) => cs.triangles)
            .slice(0, 200),
          description: `${complexCount} curved surface regions detected`,
        },
      });

      if (complexCount > 3) {
        recommendations.push(
          `Your design has ${complexCount} complex curved surfaces. Where aesthetics or function don't require curves, using flat or simple angled surfaces would simplify manufacturing.`,
        );
        totalPotentialSavings += complexCount * 35;
      }
    }

    // ===== MANUFACTURABILITY CHECKS =====

    // Thin wall analysis (Both CNC and Sheet Metal)
    if (features.thinWalls.count > 0) {
      const wallStatus =
        features.thinWalls.risk === "high"
          ? "critical"
          : features.thinWalls.risk === "medium"
            ? "warning"
            : "pass";

      checks.push({
        id: "thin-walls",
        name: "Wall Thickness",
        description: "Checking minimum wall thickness",
        status: wallStatus,
        details: `Minimum wall thickness: ${features.thinWalls.minThickness.toFixed(1)}mm`,
        icon: <Ruler className="w-4 h-4" />,
        category: "manufacturability",
        severity:
          features.thinWalls.risk === "high"
            ? "critical"
            : features.thinWalls.risk === "medium"
              ? "medium"
              : "low",
        potentialSavings: features.thinWalls.risk === "high" ? 120 : 45,
        actionable: wallStatus !== "pass",
        selectionHint:
          geometryFeatures && geometryFeatures.thinWalls.length > 0
            ? {
                type: "surface",
                featureType: "thin-wall",
                location: geometryFeatures.thinWalls[0].centroid,
                triangles: geometryFeatures.thinWalls
                  .flatMap((w) => w.triangles)
                  .slice(0, 200),
                description: `${geometryFeatures.thinWalls.length} thin wall regions detected`,
              }
            : {
                type: "surface",
                featureType: "thin-wall",
                description: `Thin walls ${features.thinWalls.minThickness.toFixed(1)}mm detected`,
              },
      });

      if (features.thinWalls.risk === "high") {
        recommendations.push(
          `Some walls in your design are very thin (${features.thinWalls.minThickness.toFixed(1)}mm). We recommend increasing to at least 2.5mm for reliable manufacturing and better part durability.`,
        );
        totalPotentialSavings += 120;
      } else if (features.thinWalls.risk === "medium") {
        recommendations.push(
          `Your design has some thin walls (${features.thinWalls.minThickness.toFixed(1)}mm). For improved structural strength, consider increasing to 2.5mm or more.`,
        );
        totalPotentialSavings += 45;
      }

      if (features.thinWalls.requiresSupportFixture) {
        recommendations.push(
          "Due to thin wall sections, your part may require additional support during manufacturing to maintain dimensional accuracy.",
        );
      }
    }

    // Rib analysis (CNC only) - ENHANCED
    if (isCNC && features.ribs.thinRibCount > 2) {
      checks.push({
        id: "rib-thickness",
        name: "Rib Design Review",
        description: "Structural rib assessment",
        status:
          features.ribs.deflectionRisk === "high" ? "critical" : "warning",
        details: `${features.ribs.thinRibCount} thin ribs detected (minimum: ${features.ribs.minThickness.toFixed(1)}mm)`,
        icon: <Layers className="w-4 h-4" />,
        category: "manufacturability",
        severity:
          features.ribs.deflectionRisk === "high" ? "critical" : "medium",
        potentialSavings: features.ribs.deflectionRisk === "high" ? 55 : 30,
        actionable: true,
        selectionHint:
          geometryFeatures && geometryFeatures.ribs.length > 0
            ? {
                type: "feature",
                featureType: "ribs",
                location: geometryFeatures.ribs[0].centroid,
                triangles: geometryFeatures.ribs
                  .flatMap((r) => r.triangles)
                  .slice(0, 100),
                description: `${geometryFeatures.ribs.length} rib features detected (confidence: ${(geometryFeatures.ribs[0].confidence * 100).toFixed(0)}%)`,
              }
            : undefined,
      });

      recommendations.push(
        `Your design has ${features.ribs.thinRibCount} ribs that are thinner than 1.5mm. For better structural integrity, we recommend increasing rib thickness to at least 2mm.`,
      );
      totalPotentialSavings +=
        features.ribs.deflectionRisk === "high" ? 55 : 30;
    }

    // Boss analysis (CNC only) - NEW
    if (geometryFeatures && geometryFeatures.bosses.length > 0) {
      const bossCount = geometryFeatures.bosses.length;
      const bossStatus = bossCount > 5 ? "info" : "pass";

      checks.push({
        id: "boss-features",
        name: "Boss Features",
        description: `${bossCount} mounting bosses detected`,
        status: bossStatus,
        details: `Cylindrical mounting features for fasteners`,
        icon: <Circle className="w-4 h-4" />,
        category: "features",
        severity: "low",
        actionable: false,
        selectionHint: {
          type: "feature",
          featureType: "bosses",
          location: geometryFeatures.bosses[0].centroid,
          triangles: geometryFeatures.bosses
            .flatMap((b) => b.triangles)
            .slice(0, 80),
          description: `${bossCount} mounting features identified`,
        },
      });
    }

    // Sharp corner analysis - NEW
    if (geometryFeatures && geometryFeatures.sharpCorners.length > 5) {
      const cornerCount = geometryFeatures.sharpCorners.length;
      const cornerStatus = cornerCount > 15 ? "warning" : "info";

      checks.push({
        id: "sharp-corner-analysis",
        name: "Sharp Corners",
        description: `${cornerCount} sharp corner${cornerCount !== 1 ? "s" : ""} in your design`,
        status: cornerStatus,
        details:
          cornerCount > 15
            ? `Consider adding small radii for durability`
            : `Sharp corners noted`,
        icon: <Maximize2 className="w-4 h-4" />,
        category: "features",
        severity: cornerCount > 15 ? "medium" : "low",
        potentialSavings: cornerCount > 15 ? Math.min(cornerCount * 2, 50) : 0,
        actionable: cornerCount > 15,
        selectionHint: {
          type: "feature",
          featureType: "sharp-corners",
          location: geometryFeatures.sharpCorners[0].centroid,
          triangles: geometryFeatures.sharpCorners
            .flatMap((c) => c.triangles)
            .slice(0, 60),
          description: `${cornerCount} sharp corners detected`,
        },
      });

      if (cornerCount > 15) {
        recommendations.push(
          `Your design has ${cornerCount} sharp corners. Adding small fillets (0.5mm or larger) would improve part durability and reduce stress concentrations.`,
        );
        totalPotentialSavings += Math.min(cornerCount * 2, 50);
      }
    }

    // ===== ENTERPRISE-LEVEL SHEET METAL CHECKS =====
    if (isSheetMetal && geometry.sheetMetalFeatures) {
      const smFeatures = geometry.sheetMetalFeatures;

      // SM-ENT-1: Bend Allowance & K-Factor Analysis
      if (smFeatures.bendCount > 0) {
        const _kFactor = 0.4; // Standard for mild steel
        const hasBendAllowanceIssues =
          smFeatures.minBendRadius < smFeatures.thickness * 0.8;

        checks.push({
          id: "bend-allowance-enterprise",
          name: "Bend Design Analysis",
          description: "Evaluating bend geometry for manufacturing",
          status: hasBendAllowanceIssues ? "warning" : "pass",
          details: `${smFeatures.bendCount} bends detected in your design`,
          icon: <Ruler className="w-4 h-4" />,
          category: "bending",
          severity: hasBendAllowanceIssues ? "medium" : "low",
          potentialSavings: hasBendAllowanceIssues ? 30 : 0,
        });

        if (hasBendAllowanceIssues) {
          recommendations.push(
            `Some bends in your design have very tight radii. This may affect dimensional accuracy. Consider using a minimum bend radius of ${(smFeatures.thickness * 1).toFixed(1)}mm (equal to material thickness) for best results.`,
          );
          totalPotentialSavings += 30;
        }
      }

      // SM-ENT-2: Springback Compensation
      if (smFeatures.bendCount > 5 || smFeatures.thickness < 1) {
        checks.push({
          id: "springback-analysis",
          name: "Material Springback",
          description: "Bend angle accuracy consideration",
          status: "warning",
          details: `${smFeatures.thickness}mm material may spring back 2-4° after bending`,
          icon: <Activity className="w-4 h-4" />,
          category: "forming",
          severity: "medium",
          potentialSavings: 25,
        });

        recommendations.push(
          `With ${smFeatures.thickness}mm material, expect slight springback (2-4°) on bends. Our tooling automatically compensates for this, but please verify critical angles in your design.`,
        );
        totalPotentialSavings += 25;
      }

      // SM-ENT-3: Edge Distance to Bend Line
      if (smFeatures.bendCount > 0 && smFeatures.hasSmallFeatures) {
        const minEdgeDistance = smFeatures.thickness * 2.5;
        checks.push({
          id: "edge-distance-check",
          name: "Feature Placement Near Bends",
          description: "Checking hole and feature positions",
          status: "warning",
          details: `Features should be at least ${minEdgeDistance.toFixed(1)}mm from bend lines`,
          icon: <Ruler className="w-4 h-4" />,
          category: "bending",
          severity: "high",
          potentialSavings: 40,
        });

        recommendations.push(
          `Some holes or cutouts appear close to bend lines. For best quality, keep features at least ${minEdgeDistance.toFixed(1)}mm away from any bend to prevent distortion.`,
        );
        totalPotentialSavings += 40;
      }

      // SM-ENT-4: Relief Notches & Corners
      if (smFeatures.bendCount > 2) {
        checks.push({
          id: "relief-notches",
          name: "Corner Relief Design",
          description: "Preventing material tearing at bend intersections",
          status: "info",
          details: "Relief notches recommended where bends meet",
          icon: <Maximize2 className="w-4 h-4" />,
          category: "bending",
          severity: "medium",
          potentialSavings: 15,
        });

        recommendations.push(
          `Where two bends meet in your design, adding corner relief notches (${(smFeatures.thickness * 1.5).toFixed(1)}mm radius) will prevent material tearing and improve part quality.`,
        );
        totalPotentialSavings += 15;
      }

      // SM-ENT-5: Hemming Operations
      if (
        smFeatures.complexity === "complex" ||
        smFeatures.complexity === "very-complex"
      ) {
        const hasHemmingOps = smFeatures.bendCount > 8;
        if (hasHemmingOps) {
          checks.push({
            id: "hemming-operations",
            name: "Complex Edge Finishing",
            description: "Your design includes complex edge treatments",
            status: "warning",
            details: "Hemmed or folded edges detected",
            icon: <Layers className="w-4 h-4" />,
            category: "forming",
            severity: "medium",
            potentialSavings: 50,
          });

          recommendations.push(
            `Your design includes complex edge folding (hemming). If safety edges aren't required, using a simpler edge treatment could reduce manufacturing complexity.`,
          );
          totalPotentialSavings += 50;
        }
      }

      // SM-ENT-6: Material Grain Direction
      if (smFeatures.bendCount > 0) {
        checks.push({
          id: "grain-direction",
          name: "Material Orientation",
          description: "Optimal bend direction relative to material grain",
          status: "info",
          details: "Bending perpendicular to grain improves strength",
          icon: <LayoutDashboard className="w-4 h-4" />,
          category: "bending",
          severity: "low",
        });

        recommendations.push(
          `For best results, major bends should be perpendicular to the material grain direction. This reduces the risk of cracking and improves bend quality.`,
        );
      }

      // SM-ENT-7: Hole-to-Edge Distance
      if (smFeatures.holeCount > 5) {
        const minHoleEdgeDistance = smFeatures.thickness * 2;
        checks.push({
          id: "hole-edge-distance",
          name: "Hole Positioning",
          description: "Verifying hole distances from edges",
          status: "warning",
          details: `${smFeatures.holeCount} holes should be at least ${minHoleEdgeDistance.toFixed(1)}mm from edges`,
          icon: <Circle className="w-4 h-4" />,
          category: "manufacturability",
          severity: "medium",
          potentialSavings: 20,
        });

        recommendations.push(
          `Ensure all holes are at least ${minHoleEdgeDistance.toFixed(1)}mm from part edges. Holes too close to edges may deform during cutting.`,
        );
        totalPotentialSavings += 20;
      }

      // SM-ENT-8: Minimum Hole Size
      if (smFeatures.holeCount > 0) {
        const minHoleDiameter = smFeatures.thickness * 1.5;
        checks.push({
          id: "min-hole-size-sheet",
          name: "Minimum Hole Size",
          description: "Verifying hole diameters",
          status: "info",
          details: `Recommended minimum hole diameter: ${minHoleDiameter.toFixed(1)}mm for ${smFeatures.thickness}mm material`,
          icon: <Circle className="w-4 h-4" />,
          category: "manufacturability",
          severity: "low",
        });
      }

      // SM-ENT-9: Laser Cutting Kerf Width
      if (smFeatures.recommendedCuttingMethod === "laser") {
        const kerfWidth = smFeatures.thickness <= 3 ? 0.2 : 0.3;
        checks.push({
          id: "laser-kerf-width",
          name: "Cutting Precision",
          description: "Laser cutting accuracy information",
          status: "pass",
          details: `Cutting tolerance: ±${kerfWidth}mm for ${smFeatures.thickness}mm material`,
          icon: <Zap className="w-4 h-4" />,
          category: "geometry",
          severity: "low",
        });
      }

      // SM-ENT-10: Weldment Preparation
      if (smFeatures.complexity === "very-complex") {
        checks.push({
          id: "weldment-prep",
          name: "Assembly Requirement",
          description: "Complex geometry may require welded assembly",
          status: "warning",
          details: "Design may need to be manufactured in multiple pieces",
          icon: <Layers className="w-4 h-4" />,
          category: "feasibility",
          severity: "high",
          potentialSavings: 80,
        });

        recommendations.push(
          `This design may be too complex to manufacture as a single piece. Consider simplifying the geometry or allow for welded assembly if structural requirements permit.`,
        );
        totalPotentialSavings += 80;
      }

      // SM-ENT-11: Powder Coating Considerations
      if (
        part.finish === "powder-coated" ||
        part.finish === "powder-coated-custom"
      ) {
        checks.push({
          id: "powder-coating-prep",
          name: "Powder Coating Preparation",
          description: "Design considerations for powder coating",
          status: "info",
          details:
            "Coating adds approximately 0.08-0.12mm thickness per surface",
          icon: <Droplet className="w-4 h-4" />,
          category: "manufacturability",
          severity: "low",
        });

        recommendations.push(
          `For powder coating: Enclosed areas need drainage holes to allow proper coating flow and prevent pooling.`,
        );
      }

      // SM-ENT-12: Tab & Breakout Features
      if (smFeatures.flatArea > 10000) {
        // Large parts
        checks.push({
          id: "micro-joints",
          name: "Part Support During Cutting",
          description: "Automatic support features added during production",
          status: "info",
          details: "Large parts receive automatic support tabs during cutting",
          icon: <Layers className="w-4 h-4" />,
          category: "manufacturability",
          severity: "low",
        });
      }

      // SM-ENT-13: Bend Sequence Optimization
      if (smFeatures.bendCount > 4) {
        const requiresSpecialFixturing =
          smFeatures.requiresMultipleSetups || smFeatures.bendCount > 8;
        checks.push({
          id: "bend-sequence",
          name: "Bend Complexity",
          description: "Evaluating bend order and tooling requirements",
          status: requiresSpecialFixturing ? "warning" : "pass",
          details: `${smFeatures.bendCount} bends in your design${requiresSpecialFixturing ? " - complex sequence" : ""}`,
          icon: <Activity className="w-4 h-4" />,
          category: "bending",
          severity: requiresSpecialFixturing ? "medium" : "low",
          potentialSavings: requiresSpecialFixturing ? 35 : 0,
        });

        if (requiresSpecialFixturing) {
          recommendations.push(
            `Your design has many bends that require careful sequencing. If possible, reducing the number of bends or simplifying the geometry would improve manufacturability.`,
          );
          totalPotentialSavings += 35;
        }
      }

      // SM-ENT-14: Countersinking for Sheet Metal
      if (smFeatures.holeCount > 10) {
        checks.push({
          id: "countersink-sheet",
          name: "Flush Fastener Holes",
          description: "Countersink requirements for flat-head fasteners",
          status: "info",
          details: `${smFeatures.holeCount} holes - specify if countersinks are needed for flush fasteners`,
          icon: <Circle className="w-4 h-4" />,
          category: "features",
          severity: "low",
          potentialSavings: smFeatures.holeCount * 0.5,
        });
      }

      // SM-ENT-15: Notch & Cutout Design
      if (smFeatures.complexity !== "simple") {
        checks.push({
          id: "notch-design",
          name: "Internal Cutout Corners",
          description: "Corner radius recommendations",
          status: "info",
          details: "Rounded internal corners improve durability",
          icon: <Maximize2 className="w-4 h-4" />,
          category: "manufacturability",
          severity: "low",
        });

        recommendations.push(
          `For best results, internal cutout corners should have rounded corners of at least ${smFeatures.thickness.toFixed(1)}mm radius. This improves part strength and appearance.`,
        );
      }

      // Material Thickness Validation
      checks.push({
        id: "sheet-thickness-enterprise",
        name: "Material Thickness",
        description: "Verifying material thickness is within range",
        status:
          smFeatures.thickness >= 0.5 && smFeatures.thickness <= 25
            ? "pass"
            : "warning",
        details: `${smFeatures.thickness.toFixed(2)}mm thickness${smFeatures.partType ? ` • ${smFeatures.partType.replaceAll("-", " ")}` : ""}`,
        icon: <Layers className="w-4 h-4" />,
        category: "geometry",
        severity:
          smFeatures.thickness < 0.5 || smFeatures.thickness > 25
            ? "high"
            : "low",
      });

      // Bend Radius Check (Enhanced)
      if (smFeatures.bendCount > 0 && smFeatures.thickness > 0) {
        const idealMinRadius = smFeatures.thickness * 1;
        const isBendRadiusOk = smFeatures.minBendRadius >= idealMinRadius;

        checks.push({
          id: "bend-radius-enterprise",
          name: "Bend Radius",
          description: "Checking minimum bend radius for material",
          status: isBendRadiusOk
            ? "pass"
            : smFeatures.hasSharptBends
              ? "critical"
              : "warning",
          details: `${smFeatures.minBendRadius.toFixed(2)}mm bend radius (${(smFeatures.minBendRadius / smFeatures.thickness).toFixed(1)}× material thickness)`,
          icon: <Activity className="w-4 h-4" />,
          category: "feasibility",
          severity: smFeatures.hasSharptBends
            ? "critical"
            : isBendRadiusOk
              ? "low"
              : "medium",
          potentialSavings: !isBendRadiusOk ? 40 : 0,
        });

        if (!isBendRadiusOk) {
          recommendations.push(
            `The bend radius is tighter than recommended for this material. Increasing to at least ${idealMinRadius.toFixed(1)}mm will prevent cracking and improve part quality.`,
          );
          totalPotentialSavings += 40;
        }
      }

      // Cutting Method & Efficiency
      if (smFeatures.recommendedCuttingMethod) {
        checks.push({
          id: "cutting-method-enterprise",
          name: "Cutting Method",
          description: "Recommended cutting process for your part",
          status: "pass",
          details: `${smFeatures.recommendedCuttingMethod.replace("-", " ")} cutting • Estimated time: ${smFeatures.estimatedCuttingTime?.toFixed(1)} min`,
          icon: <Zap className="w-4 h-4" />,
          category: "optimization",
          severity: "low",
        });
      }

      // Nesting Efficiency
      if (smFeatures.nestingEfficiency) {
        const isEfficient = smFeatures.nestingEfficiency > 0.75;
        const wasteSavings = !isEfficient
          ? Math.round(
              (((1 - smFeatures.nestingEfficiency) * smFeatures.flatArea) /
                1000) *
                0.5,
            )
          : 0;

        checks.push({
          id: "nesting-efficiency-enterprise",
          name: "Material Efficiency",
          description: "How efficiently your part uses material",
          status: isEfficient ? "pass" : "warning",
          details: `${(smFeatures.nestingEfficiency * 100).toFixed(0)}% material utilization`,
          icon: <TrendingDown className="w-4 h-4" />,
          category: "optimization",
          severity: isEfficient ? "low" : "medium",
          potentialSavings: wasteSavings,
        });

        if (!isEfficient && wasteSavings > 10) {
          recommendations.push(
            `Your part's shape results in ${((1 - smFeatures.nestingEfficiency) * 100).toFixed(0)}% material waste. Adjusting the overall dimensions or profile could improve material efficiency.`,
          );
          totalPotentialSavings += wasteSavings;
        }
      }

      // Complexity & Setup Analysis
      const complexity = smFeatures.complexity || "moderate";
      const requiresMultipleSetups = smFeatures.requiresMultipleSetups || false;

      if (
        complexity === "complex" ||
        complexity === "very-complex" ||
        requiresMultipleSetups
      ) {
        const setupCost = requiresMultipleSetups ? 45 : 0;
        checks.push({
          id: "manufacturing-complexity-enterprise",
          name: "Design Complexity",
          description: `${complexity.charAt(0).toUpperCase() + complexity.slice(1).replace("-", " ")} design${requiresMultipleSetups ? " requiring multiple operations" : ""}`,
          status:
            complexity === "very-complex" || requiresMultipleSetups
              ? "warning"
              : "info",
          details: `${smFeatures.bendCount} bends • ${smFeatures.holeCount} holes • Estimated ${(smFeatures.estimatedCuttingTime || 0 + (smFeatures.estimatedFormingTime || 0)).toFixed(0)} min production time`,
          icon: <LayoutDashboard className="w-4 h-4" />,
          category: "feasibility",
          severity: requiresMultipleSetups
            ? "high"
            : complexity === "very-complex"
              ? "medium"
              : "low",
          potentialSavings: setupCost,
        });

        if (requiresMultipleSetups) {
          recommendations.push(
            `This design requires multiple manufacturing operations. Simplifying the geometry could reduce lead time and improve consistency.`,
          );
          totalPotentialSavings += setupCost;
        }
      }

      // Small Features Warning
      if (smFeatures.hasSmallFeatures) {
        checks.push({
          id: "small-features-enterprise",
          name: "Small Features Detected",
          description: "Some features are smaller than recommended",
          status: "warning",
          details: "Very small features may affect dimensional accuracy",
          icon: <Ruler className="w-4 h-4" />,
          category: "manufacturability",
          severity: "medium",
          potentialSavings: 20,
        });

        recommendations.push(
          `Some features in your design are very small (less than 2mm). For best dimensional accuracy and quality, consider increasing these to at least 2mm.`,
        );
        totalPotentialSavings += 20;
      }

      // Tolerance Feasibility
      if (smFeatures.hasTightTolerance) {
        checks.push({
          id: "tolerance-feasibility-enterprise",
          name: "Precision Requirements",
          description: "Very tight tolerances specified",
          status: "warning",
          details:
            "Tolerances tighter than ±0.1mm require additional precision operations",
          icon: <Ruler className="w-4 h-4" />,
          category: "tolerances",
          severity: "medium",
          potentialSavings: 35,
        });

        recommendations.push(
          `Your design requires very tight tolerances (±0.1mm or less). If ±0.2mm is acceptable for your application, this would simplify manufacturing.`,
        );
        totalPotentialSavings += 35;
      }

      // Cut Path Optimization
      if (smFeatures.straightCutLength && smFeatures.curvedCutLength) {
        const totalCutLength =
          smFeatures.straightCutLength + smFeatures.curvedCutLength;
        const complexCutRatio = smFeatures.curvedCutLength / totalCutLength;

        if (complexCutRatio > 0.3) {
          const savings = Math.round(smFeatures.curvedCutLength / 100);
          checks.push({
            id: "cut-path-optimization-enterprise",
            name: "Profile Complexity",
            description: "Complex cutting paths in your design",
            status: "warning",
            details: `${(complexCutRatio * 100).toFixed(0)}% of cuts are curved or complex`,
            icon: <Zap className="w-4 h-4" />,
            category: "optimization",
            severity: "medium",
            potentialSavings: savings,
          });

          recommendations.push(
            `Your design has many curved profiles (${(complexCutRatio * 100).toFixed(0)}%). Where precision isn't critical, using straight edges can simplify manufacturing.`,
          );
          totalPotentialSavings += savings;
        }
      }
    }

    // SHEET METAL SPECIFIC CHECKS

    // SM1: Bend Operations (Sheet Metal only)
    if (isSheetMetal && geometry.sheetMetalFeatures?.bends) {
      const bends = geometry.sheetMetalFeatures.bends ?? {};
      const bendCount = bends.count || 0;
      const sharpBends = bends.sharpBends || 0;
      const minRadius = bends.minBendRadius || 0;
      const materialThickness = geometry.boundingBox?.z || 1;
      const minRecommendedRadius = materialThickness * 1.5;

      const bendStatus =
        sharpBends > 0
          ? "critical"
          : minRadius < minRecommendedRadius
            ? "warning"
            : bendCount > 20
              ? "warning"
              : "pass";

      let bendSavings = 0;
      if (sharpBends > 0) bendSavings += sharpBends * 35;
      if (minRadius < minRecommendedRadius) bendSavings += 25;

      checks.push({
        id: "bend-operations",
        name: "Bend Operations",
        description: "Checking bend count and bend radius",
        status: bendStatus,
        category: "bending",
        icon: <Layers className="w-5 h-5" />,
        details: `${bendCount} bends with minimum radius of ${minRadius.toFixed(1)}mm`,
        severity:
          sharpBends > 0
            ? "critical"
            : minRadius < minRecommendedRadius
              ? "high"
              : "low",
        potentialSavings: bendSavings,
        actionable: bendSavings > 0,
      });

      if (sharpBends > 0) {
        recommendations.push(
          `Your design has ${sharpBends} very sharp bends that risk material cracking. Increase bend radius to at least ${minRecommendedRadius.toFixed(1)}mm for better results.`,
        );
      } else if (minRadius < minRecommendedRadius) {
        recommendations.push(
          `The minimum bend radius of ${minRadius.toFixed(1)}mm is tight for ${materialThickness}mm material. For best results, use at least ${minRecommendedRadius.toFixed(1)}mm.`,
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
      const materialThickness = geometry.boundingBox?.z || 1;
      const minRecommendedLength = materialThickness * 3;

      const flangeStatus =
        shortFlanges > 3 ? "critical" : shortFlanges > 0 ? "warning" : "pass";

      const flangeSavings = shortFlanges * 20;

      checks.push({
        id: "flange-features",
        name: "Flange Dimensions",
        description: "Checking flange length for bending",
        status: flangeStatus,
        category: "forming",
        icon: <Maximize2 className="w-5 h-5" />,
        details: `${flangeCount} flanges, minimum length ${minFlangeLength.toFixed(1)}mm`,
        severity:
          shortFlanges > 3 ? "critical" : shortFlanges > 0 ? "medium" : "low",
        potentialSavings: flangeSavings,
        actionable: flangeSavings > 0,
      });

      if (shortFlanges > 0) {
        recommendations.push(
          `${shortFlanges} flanges are shorter than recommended (minimum ${minRecommendedLength.toFixed(1)}mm needed for reliable bending). Extending these flanges will improve part quality.`,
        );
        totalPotentialSavings += flangeSavings;
      }
    }

    // SM3: Notches & Cutouts (Sheet Metal only)
    if (isSheetMetal && geometry.sheetMetalFeatures?.notches) {
      const notches = geometry.sheetMetalFeatures.notches;
      const notchCount = notches.count || 0;
      const sharpCorners = notches.sharpCorners || 0;
      const _minRadius = notches.minRadius || 0;

      const notchStatus =
        sharpCorners > 5 ? "critical" : sharpCorners > 0 ? "warning" : "pass";
      const notchSavings = sharpCorners * 8;

      checks.push({
        id: "notch-cutouts",
        name: "Internal Cutouts",
        description: "Checking corner radii for cutouts",
        status: notchStatus,
        category: "forming",
        icon: <Circle className="w-5 h-5" />,
        details: `${notchCount} cutouts, ${sharpCorners} with sharp corners`,
        severity:
          sharpCorners > 5 ? "high" : sharpCorners > 0 ? "medium" : "low",
        potentialSavings: notchSavings,
        actionable: notchSavings > 0,
      });

      if (sharpCorners > 0) {
        recommendations.push(
          `${sharpCorners} cutouts have sharp internal corners. Adding small corner radii (0.5mm or more) will improve part durability and reduce stress concentrations.`,
        );
        totalPotentialSavings += notchSavings;
      }
    }

    // Undercut & multi-axis analysis (CNC only) - ENHANCED
    if (isCNC && features.undercuts.count > 0) {
      checks.push({
        id: "undercuts",
        name: "Undercut Features",
        description:
          "Features that are difficult to access with standard tools",
        status: features.undercuts.requires5Axis ? "warning" : "pass",
        details: `${features.undercuts.count} undercut${features.undercuts.count !== 1 ? "s" : ""} detected`,
        icon: <Zap className="w-4 h-4" />,
        category: "manufacturability",
        severity: features.undercuts.requires5Axis ? "high" : "low",
        potentialSavings: features.undercuts.requires5Axis ? 180 : 0,
        actionable: features.undercuts.requires5Axis,
        selectionHint:
          geometryFeatures && geometryFeatures.undercuts.length > 0
            ? {
                type: "feature",
                featureType: "undercuts",
                location: geometryFeatures.undercuts[0].centroid,
                triangles: geometryFeatures.undercuts
                  .flatMap((u) => u.triangles)
                  .slice(0, 120),
                description: `${geometryFeatures.undercuts.length} undercut regions detected`,
              }
            : undefined,
      });

      if (features.undercuts.requires5Axis) {
        recommendations.push(
          `Your design has ${features.undercuts.count} undercut${features.undercuts.count !== 1 ? "s" : ""} (recessed areas that are difficult to reach with cutting tools). Redesigning to eliminate undercuts would simplify manufacturing.`,
        );
        totalPotentialSavings += 180;
      }
    }

    // Tool access analysis
    if (
      (features?.toolAccess?.restrictedAreas ?? 0) > 2 &&
      features?.toolAccess?.estimatedSetupCount
    ) {
      checks.push({
        id: "tool-access",
        name: "Tool Access",
        description: "Areas that may be difficult for tools to reach",
        status: features.toolAccess.requiresMultiAxisMachining
          ? "warning"
          : "pass",
        details: `${features.toolAccess.restrictedAreas} areas with limited access`,
        icon: <LayoutDashboard className="w-4 h-4" />,
        category: "manufacturability",
        severity: features.toolAccess.requiresMultiAxisMachining
          ? "high"
          : "medium",
        potentialSavings: features.toolAccess.estimatedSetupCount * 35,
      });

      recommendations.push(
        `Some areas of your design are difficult for tools to reach. Consider opening up tight spaces or removing deep narrow pockets to improve manufacturability.`,
      );
      totalPotentialSavings += features.toolAccess.estimatedSetupCount * 35;
    }

    // Surface finish requirements (CNC only)
    if (
      isCNC &&
      (features?.surfaceFinish?.requiresPolishing ||
        features?.surfaceFinish?.criticalSurfaces > 5)
    ) {
      checks.push({
        id: "surface-finish",
        name: "Surface Finish",
        description: "Surface quality requirements",
        status: features.surfaceFinish.requiresPolishing ? "warning" : "pass",
        details: `${features.surfaceFinish.criticalSurfaces} surfaces require fine finish`,
        icon: <Sparkles className="w-4 h-4" />,
        category: "manufacturability",
        severity: "medium",
        potentialSavings: features.surfaceFinish.criticalSurfaces * 8,
      });

      if (features.surfaceFinish.criticalSurfaces > 5) {
        recommendations.push(
          `Your design has ${features.surfaceFinish.criticalSurfaces} surfaces requiring fine finish. If standard finish is acceptable on some surfaces, this could simplify manufacturing.`,
        );
        totalPotentialSavings += features.surfaceFinish.criticalSurfaces * 8;
      }
    }

    // ===== TOLERANCE ANALYSIS =====
    if (geometry.toleranceFeasibility) {
      const tol = geometry.toleranceFeasibility;
      const tolStatus = !tol.isAchievable
        ? "fail"
        : tol.concerns.length > 2
          ? "warning"
          : tol.additionalCost > 100
            ? "warning"
            : "pass";

      checks.push({
        id: "tolerance-feasibility",
        name: "Tolerance Requirements",
        description: "Checking if specified tolerances can be achieved",
        status: tolStatus,
        details: tol.isAchievable
          ? "Tolerances achievable"
          : "Tolerance review needed",
        icon: <CheckCheck className="w-4 h-4" />,
        category: "tolerances",
        severity: !tol.isAchievable
          ? "critical"
          : tol.concerns.length > 2
            ? "high"
            : "medium",
        potentialSavings: tol.additionalCost,
        actionable: tol.concerns.length > 0,
      });

      if (!tol.isAchievable) {
        recommendations.push(
          "Some tolerances may be difficult to achieve with this geometry. Please review the specific concerns below.",
        );
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
          name: "Precision Requirements",
          description: "Geometric tolerancing detected",
          status: "info",
          details: `${gdt.flatness ? "Flatness" : ""}${gdt.perpendicularity ? ", Perpendicularity" : ""}${gdt.position ? ", Position" : ""} requirements`,
          icon: <Ruler className="w-4 h-4" />,
          category: "tolerances",
          severity: "medium",
        });
      }
    }

    // ===== OPTIMIZATION OPPORTUNITIES =====
    const dfmIssues = geometry.dfmIssues || [];
    dfmIssues.forEach((issue, index) => {
      if (
        issue.severity === "critical" &&
        issue.potentialSavings &&
        issue.potentialSavings > 30
      ) {
        checks.push({
          id: `dfm-optimization-${index}`,
          name: issue.issue.split(".")[0].substring(0, 40),
          description: issue.recommendation.substring(0, 60),
          status: issue.severity === "critical" ? "critical" : "warning",
          details: issue.potentialSavings
            ? `Optimization opportunity`
            : undefined,
          icon: <Zap className="w-4 h-4" />,
          category: "optimization",
          severity:
            issue.severity === "critical"
              ? "critical"
              : issue.severity === "warning"
                ? "medium"
                : "low",
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
          name: "Surface Quality",
          description: `Surface finish analysis`,
          status: requiresPolishing ? "warning" : "info",
          details: `${criticalSurfaces} surface${criticalSurfaces !== 1 ? "s" : ""} requiring fine finish`,
          icon: <Sparkles className="w-4 h-4" />,
          category: "optimization",
          severity: requiresPolishing ? "medium" : "low",
          potentialSavings: requiresPolishing ? criticalSurfaces * 15 : 0,
          actionable: true,
        });

        if (requiresPolishing) {
          recommendations.push(
            `${criticalSurfaces} surface${criticalSurfaces !== 1 ? "s" : ""} require very smooth finish. If a standard machined finish is acceptable on some surfaces, this could simplify production.`,
          );
          totalPotentialSavings += criticalSurfaces * 15;
        }
      }
    }

    // Feature Interaction Analysis
    if (geometryFeatures) {
      const holeCount = geometryFeatures.holes.length;

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
                Math.pow(hole1.centroid.z - hole2.centroid.z, 2),
            );
            if (distance < 5) proximityIssues++; // Features within 5mm
          }
        }
      }

      if (proximityIssues > 0) {
        checks.push({
          id: "feature-proximity-warning",
          name: "Feature Spacing",
          description: `Some features are close together`,
          status: proximityIssues > 5 ? "warning" : "info",
          details: `${proximityIssues} feature${proximityIssues !== 1 ? "s" : ""} within 5mm of each other`,
          icon: <Maximize2 className="w-4 h-4" />,
          category: "manufacturability",
          severity: proximityIssues > 5 ? "medium" : "low",
          potentialSavings: proximityIssues > 5 ? 40 : 0,
          actionable: true,
        });

        if (proximityIssues > 5) {
          recommendations.push(
            `Some features in your design are very close together (less than 5mm). Consider increasing spacing between holes and other features for better accuracy.`,
          );
        }
      }
    }

    // Material Utilization Analysis
    if (geometry.volume && geometry.boundingBox) {
      const boxVolume =
        geometry.boundingBox.x *
        geometry.boundingBox.y *
        geometry.boundingBox.z;
      const materialUtilization = (geometry.volume / boxVolume) * 100;

      if (materialUtilization < 30) {
        checks.push({
          id: "material-efficiency",
          name: "Material Efficiency",
          description: `Your part uses ${materialUtilization.toFixed(1)}% of the raw material`,
          status: materialUtilization < 20 ? "warning" : "info",
          details:
            materialUtilization < 20
              ? "Consider design optimization"
              : "Typical for complex parts",
          icon: <TrendingDown className="w-4 h-4" />,
          category: "optimization",
          severity: materialUtilization < 20 ? "medium" : "low",
          potentialSavings: materialUtilization < 20 ? 80 : 0,
          actionable: true,
        });

        if (materialUtilization < 20) {
          recommendations.push(
            `Your design uses only ${materialUtilization.toFixed(1)}% of the raw material block. If feasible, adjusting the overall shape or dimensions could improve material efficiency.`,
          );
          totalPotentialSavings += 80;
        }
      }
    }

    // Assembly Considerations
    if (
      geometryFeatures &&
      (geometryFeatures.holes.length > 10 ||
        geometryFeatures.threads.length > 5)
    ) {
      const fastenerCount =
        geometryFeatures.threads.length +
        Math.floor(geometryFeatures.holes.length * 0.4);

      checks.push({
        id: "assembly-complexity",
        name: "Assembly Features",
        description: `Multiple mounting features detected`,
        status: fastenerCount > 20 ? "info" : "pass",
        details: `${fastenerCount} potential fastener locations identified`,
        icon: <CheckCheck className="w-4 h-4" />,
        category: "features",
        severity: "low",
      });
    }

    // Manufacturability Score (Enterprise KPI)
    const manufacturabilityFactors = {
      simpleGeometry:
        geometry.complexity === "simple"
          ? 25
          : geometry.complexity === "moderate"
            ? 15
            : 5,
      standardFeatures:
        features.holes.count < 15 && features.pockets.count < 8 ? 20 : 10,
      noUndercuts: !features.undercuts.requires5Axis ? 20 : 5,
      goodTolerance:
        part.tolerance === "standard"
          ? 15
          : part.tolerance === "precision"
            ? 10
            : 5,
      wallThickness:
        features.thinWalls.risk === "low"
          ? 20
          : features.thinWalls.risk === "medium"
            ? 10
            : 5,
    };

    const manufacturabilityScore = Object.values(
      manufacturabilityFactors,
    ).reduce((sum, val) => sum + val, 0);

    checks.push({
      id: "manufacturability-index",
      name: "Design Score",
      description: `Overall design manufacturability rating`,
      status:
        manufacturabilityScore >= 80
          ? "pass"
          : manufacturabilityScore >= 60
            ? "info"
            : "warning",
      details: `${manufacturabilityScore}/100 - ${manufacturabilityScore >= 80 ? "Excellent design" : manufacturabilityScore >= 60 ? "Good design" : "Design could be improved"}`,
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
        (features?.toolAccess?.estimatedSetupCount > 2 ? 1 : 0);
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
      name: "Design Complexity",
      description: "Overall part complexity assessment",
      status: geometry.complexity === "complex" ? "warning" : "pass",
      details: `${geometry.complexity.charAt(0).toUpperCase() + geometry.complexity.slice(1)} design - ${complexityScore > 3 ? "may require extra attention" : complexityScore > 1 ? "standard complexity" : "straightforward"}`,
      icon: <LayoutDashboard className="w-4 h-4" />,
      category: "optimization",
      severity: geometry.complexity === "complex" ? "medium" : "low",
    });

    // ===== ADDITIONAL ENTERPRISE CHECKS =====

    // Aspect Ratio Check - Important for both CNC and Sheet Metal
    if (geometry.boundingBox) {
      const dims = [
        geometry.boundingBox.x,
        geometry.boundingBox.y,
        geometry.boundingBox.z,
      ].sort((a, b) => a - b);
      const aspectRatio = dims[2] / Math.max(dims[0], 0.1);
      const hasExtremeAspectRatio = aspectRatio > 10;

      if (hasExtremeAspectRatio) {
        checks.push({
          id: "aspect-ratio-check",
          name: "Part Proportions",
          description: "Evaluating length-to-width ratio",
          status: aspectRatio > 15 ? "warning" : "info",
          details: `Your part is ${aspectRatio.toFixed(1)}x longer than its narrowest dimension`,
          icon: <Ruler className="w-4 h-4" />,
          category: "manufacturability",
          severity: aspectRatio > 15 ? "medium" : "low",
          potentialSavings: aspectRatio > 15 ? 25 : 0,
        });

        if (aspectRatio > 15) {
          recommendations.push(
            `Your part has a high aspect ratio (${aspectRatio.toFixed(1)}:1). Long, thin parts may require additional support during manufacturing and can be prone to warping.`,
          );
          totalPotentialSavings += 25;
        }
      }
    }

    // Volume-to-Surface Area Ratio Check - Indicates complexity
    if (geometry.volume && geometry.surfaceArea) {
      const volSurfRatio = geometry.volume / geometry.surfaceArea;
      const isHighlyDetailed = volSurfRatio < 1.5; // Low ratio = lots of surface detail

      if (isHighlyDetailed && geometry.complexity !== "simple") {
        checks.push({
          id: "detail-density",
          name: "Surface Detail",
          description: "Checking surface complexity level",
          status: "info",
          details: `High surface detail detected - your design has intricate features`,
          icon: <Sparkles className="w-4 h-4" />,
          category: "features",
          severity: "low",
        });
      }
    }

    // Part Weight Estimation for Handling
    if (geometry.materialWeight) {
      const weightKg = geometry.materialWeight / 1000;
      const isHeavy = weightKg > 25; // Over 25kg may need special handling

      if (isHeavy) {
        checks.push({
          id: "part-weight",
          name: "Part Weight",
          description: "Weight considerations for handling",
          status: "info",
          details: `Estimated weight: ${weightKg.toFixed(1)}kg - may require special handling`,
          icon: <Shield className="w-4 h-4" />,
          category: "manufacturability",
          severity: "low",
        });

        recommendations.push(
          `Your part weighs approximately ${weightKg.toFixed(1)}kg. Heavy parts may require special handling and fixturing during manufacturing.`,
        );
      }
    }

    // Symmetry Check - Can simplify manufacturing
    if (geometry.partCharacteristics?.isRotationalSymmetric) {
      checks.push({
        id: "rotational-symmetry",
        name: "Part Symmetry",
        description: "Rotationally symmetric design detected",
        status: "pass",
        details: "Symmetric parts are often easier to manufacture and inspect",
        icon: <CheckCheck className="w-4 h-4" />,
        category: "optimization",
        severity: "low",
      });
    }

    // Secondary Operations Check
    if (
      geometry.recommendedSecondaryOps &&
      geometry.recommendedSecondaryOps.length > 0
    ) {
      const secondaryOps = geometry.recommendedSecondaryOps;
      const _totalSecondaryTime = secondaryOps.reduce(
        (sum, op) => sum + (op.leadTimeAddition || 0),
        0,
      );

      checks.push({
        id: "secondary-operations",
        name: "Additional Processing",
        description: `${secondaryOps.length} secondary operation${secondaryOps.length !== 1 ? "s" : ""} recommended`,
        status: secondaryOps.length > 2 ? "warning" : "info",
        details: secondaryOps
          .map((op) => op.type.replaceAll("-", " "))
          .join(", "),
        icon: <Layers className="w-4 h-4" />,
        category: "features",
        severity: secondaryOps.length > 2 ? "medium" : "low",
      });

      if (secondaryOps.length > 2) {
        recommendations.push(
          `Your design requires ${secondaryOps.length} secondary operations (${secondaryOps.map((op) => op.type.replaceAll("-", " ")).join(", ")}). Consider if all are necessary for your application.`,
        );
      }
    }

    // Material Selection Guidance (if finish specified)
    if (
      part.finish &&
      part.finish !== "as-machined" &&
      part.finish !== "none"
    ) {
      checks.push({
        id: "finish-compatibility",
        name: "Surface Finish",
        description: `${part.finish.replaceAll("-", " ")} finish selected`,
        status: "pass",
        details: "Surface treatment will be applied after manufacturing",
        icon: <Droplet className="w-4 h-4" />,
        category: "features",
        severity: "low",
      });
    }

    // Minimum Order Quantity Consideration for Complex Parts
    if (
      geometry.complexity === "complex" &&
      part.quantity &&
      part.quantity < 5
    ) {
      checks.push({
        id: "quantity-efficiency",
        name: "Quantity Consideration",
        description: "Low quantity for complex design",
        status: "info",
        details: `Complex parts become more cost-effective at higher quantities`,
        icon: <TrendingDown className="w-4 h-4" />,
        category: "optimization",
        severity: "low",
      });

      recommendations.push(
        `For complex parts like yours, ordering 5+ units typically reduces per-unit cost by 15-25% due to setup efficiency.`,
      );
    }

    // Internal Corner Radius Check for CNC
    if (
      isCNC &&
      features.pockets.count > 0 &&
      features.pockets.minCornerRadius < 1.5
    ) {
      checks.push({
        id: "internal-corners",
        name: "Internal Corner Radii",
        description: "Checking minimum corner radius in pockets",
        status: features.pockets.minCornerRadius < 1 ? "warning" : "info",
        details: `Minimum corner radius: ${features.pockets.minCornerRadius.toFixed(1)}mm`,
        icon: <Circle className="w-4 h-4" />,
        category: "features",
        severity: features.pockets.minCornerRadius < 1 ? "medium" : "low",
        potentialSavings: features.pockets.minCornerRadius < 1 ? 20 : 0,
      });

      if (features.pockets.minCornerRadius < 1) {
        recommendations.push(
          `Some internal corners have very small radii (${features.pockets.minCornerRadius.toFixed(1)}mm). Increasing to 2mm or larger allows use of standard tooling and improves manufacturability.`,
        );
        totalPotentialSavings += 20;
      }
    }

    // Draft Angle Check (mainly for injection molding reference)
    if (geometry.partCharacteristics?.hasCurvedSurfaces && !isSheetMetal) {
      checks.push({
        id: "curved-surfaces-note",
        name: "Contoured Surfaces",
        description: "Complex surface geometry detected",
        status: "info",
        details: "3D curved surfaces will require ball-end mill finishing",
        icon: <Activity className="w-4 h-4" />,
        category: "manufacturability",
        severity: "low",
      });
    }

    // Lead Time Estimation Based on Complexity
    const estimatedLeadTime =
      geometry.complexity === "simple"
        ? 3
        : geometry.complexity === "moderate"
          ? 5
          : 7;

    // checks.push({
    //   id: "estimated-lead-time",
    //   name: "Estimated Lead Time",
    //   description: "Production timeline estimate",
    //   status: "pass",
    //   details: `Approximately ${estimatedLeadTime}-${estimatedLeadTime + 2} business days for standard delivery`,
    //   icon: <Activity className="w-4 h-4" />,
    //   category: "optimization",
    //   severity: "low",
    // });
  }

  // Calculate metrics
  const passCount = checks.filter((c) => c.status === "pass").length;
  const warningCount = checks.filter((c) => c.status === "warning").length;
  const failCount = checks.filter((c) => c.status === "fail").length;
  const criticalCount = checks.filter((c) => c.status === "critical").length;

  const overallScore = Math.max(
    0,
    Math.round(
      ((passCount * 100 +
        warningCount * 60 +
        failCount * 20 -
        criticalCount * 50) /
        (checks.length * 100)) *
        100,
    ),
  );

  let manufacturability: DFMAnalysisResult["manufacturability"];
  if (criticalCount > 0) manufacturability = "critical";
  else if (failCount > 0) manufacturability = "poor";
  else if (warningCount > 3) manufacturability = "fair";
  else if (warningCount > 0) manufacturability = "good";
  else manufacturability = "excellent";

  if (criticalCount === 0 && failCount === 0 && warningCount === 0) {
    recommendations.push(
      "Your design is well-optimized for manufacturing. No changes needed!",
    );
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
  selectedHighlight,
  onHighlightChange,
}: {
  part: PartConfig;
  selectedHighlight?: string | null;
  onHighlightChange?: (checkId: string | null, selectionHint?: any) => void;
}) => {
  const [analysis, setAnalysis] = useState<DFMAnalysisResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(true);
  const [geometryFeatures, setGeometryFeatures] = useState<
    GeometryFeatureMap | undefined
  >(undefined);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Load and analyze geometry for accurate feature detection
  useEffect(() => {
    async function loadAndAnalyzeGeometry() {
      if (!part.fileObject && !part.filePath) return;

      try {
        // Load the file
        const _file =
          part.fileObject ||
          (await fetch(part.filePath!).then((r) => r.blob()));
        const fileExt = part.fileName.split(".").pop()?.toLowerCase();

        // Only analyze STL files for now (STEP files need backend processing)
        if (fileExt === "stl") {
          // Geometry analysis will be implemented with backend integration
          // For now, we skip the 3D viewer functionality
          setGeometryFeatures(undefined);
        }
      } catch (error) {
        console.warn("Could not analyze geometry features:", error);
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
            color={
              analysis.criticalIssues > 0 ? "text-red-600" : "text-gray-400"
            }
          />
          <StatTile
            label="Issues"
            value={analysis.estimatedIssues}
            color={
              analysis.estimatedIssues > 0 ? "text-rose-600" : "text-gray-400"
            }
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
              ? [
                  "geometry",
                  "bending",
                  "forming",
                  "features",
                  "tolerances",
                  "optimization",
                ]
              : [
                  "geometry",
                  "manufacturability",
                  "features",
                  "tolerances",
                  "optimization",
                ]
            ).map((cat) => {
              const catChecks = analysis.checks.filter(
                (c) => c.category === cat,
              );
              if (catChecks.length === 0) return null;
              const pass = catChecks.filter((c) => c.status === "pass").length;
              const critical = catChecks.filter(
                (c) => c.status === "critical",
              ).length;
              return (
                <div key={cat} className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between text-xs font-bold px-1">
                    <span className="capitalize">{cat}</span>
                    <span
                      className={
                        critical > 0 ? "text-red-600" : "text-gray-400"
                      }
                    >
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
              ? ([
                  "geometry",
                  "bending",
                  "forming",
                  "features",
                  "tolerances",
                  "optimization",
                ] as const)
              : ([
                  "geometry",
                  "manufacturability",
                  "features",
                  "tolerances",
                  "optimization",
                ] as const)
            ).map((cat) => {
              const catChecks = analysis.checks.filter(
                (c) => c.category === cat,
              );
              if (catChecks.length === 0) return null;

              const categoryLabel =
                cat === "manufacturability"
                  ? "Assessment"
                  : cat === "optimization"
                    ? "Opportunities"
                    : cat === "bending"
                      ? "Operations"
                      : cat === "forming"
                        ? "Features"
                        : "Analysis";

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
                          "group p-4 rounded-xl border flex items-start gap-4 transition-all hover:shadow-md cursor-pointer active:scale-[0.99]",
                          selectedHighlight === check.id
                            ? "ring-2 ring-blue-500 border-blue-500 shadow-md transform scale-[1.01]"
                            : "",
                          check.status === "pass"
                            ? "bg-white border-gray-100 hover:border-gray-200"
                            : check.status === "critical"
                              ? "bg-red-50 border-red-200 hover:border-red-300"
                              : check.status === "fail"
                                ? "bg-rose-50 border-rose-200 hover:border-rose-300"
                                : mood.light + " " + mood.border,
                        )}
                        onClick={() => {
                          if (onHighlightChange) {
                            if (selectedHighlight === check.id) {
                              onHighlightChange(null);
                            } else {
                              onHighlightChange(check.id, check.selectionHint);
                            }
                          }
                        }}
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
                              {check.potentialSavings &&
                                check.potentialSavings > 0 && (
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
                                {check.status === "pass"
                                  ? "✓ OK"
                                  : check.status.toUpperCase()}
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
                              <span
                                className={cn(
                                  "text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded",
                                  check.severity === "critical" &&
                                    "bg-red-100 text-red-700",
                                  check.severity === "high" &&
                                    "bg-orange-100 text-orange-700",
                                  check.severity === "medium" &&
                                    "bg-amber-100 text-amber-700",
                                  check.severity === "low" &&
                                    "bg-yellow-100 text-yellow-700",
                                )}
                              >
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
                  {analysis.checks.length}+ Point Inspection •{" "}
                  {analysis.processType === "sheet-metal"
                    ? "Sheet Metal"
                    : "CNC Machining"}{" "}
                  • {analysis.processingComplexity} Complexity
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
