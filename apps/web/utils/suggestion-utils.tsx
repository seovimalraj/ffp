import type { PartConfig } from "@/types/part-config";
import {
  Package,
  TrendingUp,
  Clock,
  Sparkles,
  AlertTriangle,
  Zap,
  Layers,
  Wrench,
} from "lucide-react";
import React from "react";

export interface Suggestion {
  id: string;
  type:
    | "quantity"
    | "material"
    | "finish"
    | "leadtime"
    | "dfm"
    | "tolerance"
    | "secondary-ops"
    | "volume-discount"
    | "premium-upgrade"
    | "bundle"
    | "express-shipping";
  title: string;
  description: string;
  partId: string;
  partName: string;
  currentValue: string | number;
  suggestedValue: string | number;
  preview: string | undefined;
  impact: {
    savings?: number;
    savingsPercentage?: number;
    leadTimeReduction?: number;
    revenueIncrease?: number; // For upsell opportunities
    lifetimeSavings?: number; // Long-term cost benefits
  };
  icon: React.ReactNode;
  color:
    | "blue"
    | "purple"
    | "green"
    | "amber"
    | "red"
    | "orange"
    | "indigo"
    | "teal";
  category?:
    | "cost-saving"
    | "performance-upgrade"
    | "volume-discount"
    | "premium-service"
    | "quality-improvement";
  priority?: "critical" | "high" | "medium" | "low";
  action?: any; // Action data for applying suggestion
}

/**
 * Generate comprehensive suggestions including DFM, material alternatives, and marketing intelligence
 */
export function generateSuggestions(parts: PartConfig[]): Suggestion[] {
  const suggestions: Suggestion[] = [];

  parts.forEach((part) => {
    // Generate DFM recommendations
    suggestions.push(...generateDFMSuggestions(part));

    // Generate alternative material suggestions
    suggestions.push(...generateAlternativeMaterialSuggestions(part));

    // Generate marketing-focused suggestions
    suggestions.push(...generateMarketingSuggestions(part));

    // Generate existing suggestions
    suggestions.push(...generateLegacySuggestions(part));
  });

  // Generate multi-part bundle suggestions
  if (parts.length > 1) {
    suggestions.push(...generateBundleSuggestions(parts));
  }

  return suggestions;
}

/**
 * Generate DFM (Design for Manufacturing) cost-reduction recommendations
 * Analyzes geometry features and suggests design improvements
 */
function generateDFMSuggestions(part: PartConfig): Suggestion[] {
  const suggestions: Suggestion[] = [];
  const geometry = part.geometry;

  if (!geometry) return suggestions;

  const {
    dfmIssues,
    advancedFeatures,
    sheetMetalFeatures,
    recommendedProcess,
  } = geometry;

  // Process DFM issues from CAD analysis
  if (dfmIssues && dfmIssues.length > 0) {
    dfmIssues.forEach((issue, index) => {
      // Only show warnings and critical issues as suggestions
      if (
        issue.severity !== "info" &&
        issue.potentialSavings &&
        issue.potentialSavings > 20
      ) {
        suggestions.push({
          id: `dfm-issue-${part.id}-${index}`,
          type: "dfm",
          title: issue.issue,
          description: issue.recommendation,
          partId: part.id,
          partName: part.fileName,
          currentValue: "Current Design",
          suggestedValue: "Optimized Design",
          preview: part.snapshot_2d_url,
          impact: {
            savings: issue.potentialSavings,
            savingsPercentage: Math.round(
              (issue.potentialSavings / (part.final_price || 200)) * 100,
            ),
          },
          icon: React.createElement(AlertTriangle, { className: "w-5 h-5" }),
          color: issue.severity === "critical" ? "red" : "amber",
          action: { type: "dfm-redesign", issueType: issue.issue },
        });
      }
    });
  }

  // CNC-specific DFM suggestions
  if (
    recommendedProcess === "cnc-milling" ||
    recommendedProcess === "cnc-turning"
  ) {
    // Undercut suggestions
    if (advancedFeatures.undercuts.requires5Axis) {
      suggestions.push({
        id: `dfm-undercut-${part.id}`,
        type: "dfm",
        title: "Enhance Part Reliability",
        description: `Part has ${advancedFeatures.undercuts.count} undercuts that create stress concentration points and potential weak spots. Redesigning to eliminate these features improves structural integrity and part longevity under load.`,
        partId: part.id,
        partName: part.fileName,
        currentValue: "Complex Geometry",
        suggestedValue: "Simplified Design",
        preview: part.snapshot_2d_url,
        impact: {
          savings: 180,
          savingsPercentage: 28,
        },
        icon: React.createElement(Wrench, { className: "w-5 h-5" }),
        color: "orange",
        action: { type: "remove-undercuts" },
      });
    }

    // Deep hole machining optimization
    if (advancedFeatures.holes.deepHoleCount > 2) {
      suggestions.push({
        id: `dfm-deepholes-${part.id}`,
        type: "dfm",
        title: "Improve Hole Precision & Longevity",
        description: `${advancedFeatures.holes.deepHoleCount} deep holes (L/D > 5:1) may experience wear issues and thread degradation over time. Optimizing hole depth or increasing diameter improves thread engagement and long-term reliability.`,
        partId: part.id,
        partName: part.fileName,
        currentValue: `${advancedFeatures.holes.deepHoleCount} deep holes`,
        suggestedValue: "Optimized for durability",
        preview: part.snapshot_2d_url,
        impact: {
          savings: 65,
          savingsPercentage: 16,
        },
        icon: React.createElement(Zap, { className: "w-5 h-5" }),
        color: "orange",
        action: { type: "optimize-holes", feature: "deep-holes" },
      });
    }

    // Micro hole warnings
    if (advancedFeatures.holes.microHoleCount > 0) {
      suggestions.push({
        id: `dfm-microholes-${part.id}`,
        type: "dfm",
        title: "Critical: Prevent Thread Stripping",
        description: `${advancedFeatures.holes.microHoleCount} micro holes (<1mm) are prone to cross-threading and stripped threads during assembly. Increasing to ≥1mm diameter improves fastener reliability and reduces risk of field failures during installation or maintenance.`,
        partId: part.id,
        partName: part.fileName,
        currentValue: `${advancedFeatures.holes.microHoleCount} micro holes`,
        suggestedValue: "≥1mm diameter",
        preview: part.snapshot_2d_url,
        impact: {
          savings: 50 * advancedFeatures.holes.microHoleCount,
          savingsPercentage: Math.round(
            ((50 * advancedFeatures.holes.microHoleCount) /
              (part.final_price || 200)) *
              100,
          ),
        },
        icon: React.createElement(AlertTriangle, { className: "w-5 h-5" }),
        color: "red",
        action: { type: "increase-hole-diameter", minDiameter: 1.0 },
      });
    }

    // Sharp corner optimization for pockets
    if (advancedFeatures.pockets.sharpCornersCount > 3) {
      suggestions.push({
        id: `dfm-sharp-corners-${part.id}`,
        type: "dfm",
        title: "Reduce Stress Concentrations",
        description: `${advancedFeatures.pockets.sharpCornersCount} sharp pocket corners act as stress risers that can initiate cracks under cyclic loading. Adding ${advancedFeatures.pockets.minCornerRadius.toFixed(1)}mm radii distributes stress evenly, extending part service life and preventing fatigue failures.`,
        partId: part.id,
        partName: part.fileName,
        currentValue: "Sharp corners",
        suggestedValue: `R${advancedFeatures.pockets.minCornerRadius.toFixed(1)} radii`,
        preview: part.snapshot_2d_url,

        impact: {
          savings: 40,
          savingsPercentage: 12,
        },
        icon: React.createElement(Layers, { className: "w-5 h-5" }),
        color: "amber",
        action: {
          type: "add-corner-radii",
          minRadius: advancedFeatures.pockets.minCornerRadius,
        },
      });
    }

    // Deep pocket suggestions
    if (advancedFeatures.pockets.deepPockets > 2) {
      suggestions.push({
        id: `dfm-pocket-${part.id}`,
        type: "dfm",
        title: "Enhance Structural Integrity",
        description: `${advancedFeatures.pockets.deepPockets} deep pockets detected with aspect ratio > 3:1. Deep cavities can reduce part stiffness and create weak points. Reducing pocket depth by 30% improves overall structural rigidity and resistance to bending loads.`,
        partId: part.id,
        partName: part.fileName,
        currentValue: `${advancedFeatures.pockets.avgDepth.toFixed(1)}mm depth`,
        suggestedValue: `${(advancedFeatures.pockets.avgDepth * 0.7).toFixed(1)}mm depth`,
        preview: part.snapshot_2d_url,

        impact: {
          savings: 75,
          savingsPercentage: 18,
        },
        icon: React.createElement(Layers, { className: "w-5 h-5" }),
        color: "amber",
        action: { type: "reduce-pocket-depth", reduction: 0.3 },
      });
    }

    // Missing fillet recommendations
    if (advancedFeatures.fillets.missingFilletCount > 2) {
      suggestions.push({
        id: `dfm-missing-fillets-${part.id}`,
        type: "dfm",
        title: "Prevent Crack Initiation",
        description: `${advancedFeatures.fillets.missingFilletCount} sharp internal corners detected (stress risk: ${advancedFeatures.fillets.stressConcentrationRisk}/10). Sharp corners are prime locations for fatigue cracks to start. Adding R${advancedFeatures.fillets.minRadius.toFixed(1)}mm fillets significantly improves part longevity under repeated loading and prevents premature failures.`,
        partId: part.id,
        partName: part.fileName,
        currentValue: "Sharp corners",
        suggestedValue: `R${advancedFeatures.fillets.minRadius.toFixed(1)} fillets`,
        preview: part.snapshot_2d_url,

        impact: {
          savings: 0,
          savingsPercentage: 0,
        },
        icon: React.createElement(AlertTriangle, { className: "w-5 h-5" }),
        color:
          advancedFeatures.fillets.stressConcentrationRisk > 6
            ? "red"
            : "orange",
        action: {
          type: "add-fillets",
          minRadius: advancedFeatures.fillets.minRadius,
        },
      });
    }

    // Thread optimization
    if (advancedFeatures.threads.count > 8) {
      const internalCost = advancedFeatures.threads.internalThreads * 3;
      const externalCost = advancedFeatures.threads.externalThreads * 2;
      suggestions.push({
        id: `dfm-threads-${part.id}`,
        type: "secondary-ops",
        title: "Simplify Assembly Process",
        description: `Part requires ${advancedFeatures.threads.count} fastening points (${advancedFeatures.threads.internalThreads} internal, ${advancedFeatures.threads.externalThreads} external). Excessive fasteners increase assembly time and potential for cross-threading errors. Consolidating to fewer, larger fasteners improves installation reliability and serviceability.`,
        partId: part.id,
        partName: part.fileName,
        currentValue: `${advancedFeatures.threads.count} threads`,
        suggestedValue: "Streamlined fastening",
        preview: part.snapshot_2d_url,

        impact: {
          savings: Math.min(internalCost + externalCost, 80),
          savingsPercentage: Math.round(
            (Math.min(internalCost + externalCost, 80) /
              (part.final_price || 200)) *
              100,
          ),
        },
        icon: React.createElement(Wrench, { className: "w-5 h-5" }),
        color: "amber",
        action: { type: "optimize-threads" },
      });
    }

    // Boss/protrusion optimization
    if (
      advancedFeatures.bosses.count > 3 &&
      advancedFeatures.bosses.maxAspectRatio > 4
    ) {
      suggestions.push({
        id: `dfm-bosses-${part.id}`,
        type: "dfm",
        title: "Improve Mounting Stability",
        description: `${advancedFeatures.bosses.count} tall bosses detected (height/diameter > 4:1). Tall, slender mounting features can bend or break during assembly torque application. Reducing height by 25% or adding gussets improves mounting robustness and prevents assembly damage.`,
        partId: part.id,
        partName: part.fileName,
        currentValue: `${advancedFeatures.bosses.avgHeight.toFixed(1)}mm height`,
        suggestedValue: `${(advancedFeatures.bosses.avgHeight * 0.75).toFixed(1)}mm height`,
        preview: part.snapshot_2d_url,

        impact: {
          savings: 30,
          savingsPercentage: 10,
        },
        icon: React.createElement(Layers, { className: "w-5 h-5" }),
        color: "amber",
        action: { type: "reduce-boss-height", reduction: 0.25 },
      });
    }

    // Rib thickness optimization
    if (advancedFeatures.ribs.thinRibCount > 2) {
      suggestions.push({
        id: `dfm-ribs-${part.id}`,
        type: "dfm",
        title: `${advancedFeatures.ribs.deflectionRisk === "high" ? "Critical: " : ""}Strengthen Load-Bearing Ribs`,
        description: `${advancedFeatures.ribs.thinRibCount} thin ribs detected (${advancedFeatures.ribs.minThickness.toFixed(1)}mm). Ribs thinner than 1.5mm may deflect or crack under load, compromising structural support. Increasing to 2mm minimum prevents warping and ensures consistent part performance over time.`,
        partId: part.id,
        partName: part.fileName,
        currentValue: `${advancedFeatures.ribs.minThickness.toFixed(1)}mm`,
        suggestedValue: "2mm minimum",
        preview: part.snapshot_2d_url,

        impact: {
          savings: advancedFeatures.ribs.deflectionRisk === "high" ? 55 : 30,
          savingsPercentage:
            advancedFeatures.ribs.deflectionRisk === "high" ? 15 : 10,
        },
        icon: React.createElement(AlertTriangle, { className: "w-5 h-5" }),
        color:
          advancedFeatures.ribs.deflectionRisk === "high" ? "red" : "orange",
        action: { type: "increase-rib-thickness", minThickness: 2.0 },
      });
    }

    // Tool access and multi-axis warnings
    if (advancedFeatures.toolAccess?.restrictedAreas && advancedFeatures.toolAccess.restrictedAreas > 3) {
      suggestions.push({
        id: `dfm-tool-access-${part.id}`,
        type: "dfm",
        title: "Ensure Feature Consistency",
        description: `${advancedFeatures.toolAccess.restrictedAreas} restricted access areas require multiple setups${advancedFeatures.toolAccess.requiresMultiAxisMachining ? " and complex fixturing" : ""}. Multiple setups increase variation risk between features. Simplifying geometry ensures tighter dimensional consistency and better part-to-part repeatability.`,
        partId: part.id,
        partName: part.fileName,
        currentValue: `${advancedFeatures.toolAccess.estimatedSetupCount} setups`,
        suggestedValue: "Simplified geometry",
        preview: part.snapshot_2d_url,

        impact: {
          savings: advancedFeatures.toolAccess.estimatedSetupCount * 35,
          savingsPercentage: Math.round(
            ((advancedFeatures.toolAccess.estimatedSetupCount * 35) /
              (part.final_price || 200)) *
              100,
          ),
        },
        icon: React.createElement(Wrench, { className: "w-5 h-5" }),
        color: "orange",
        action: { type: "improve-tool-access" },
      });
    }

    // Surface finish requirements
    if (
      advancedFeatures.surfaceFinish?.requiresPolishing ||
      (advancedFeatures.surfaceFinish?.criticalSurfaces || 0) > 5
    ) {
      suggestions.push({
        id: `dfm-surface-finish-${part.id}`,
        type: "secondary-ops",
        title: "Relax Surface Finish Requirements",
        description: `${advancedFeatures.surfaceFinish.criticalSurfaces} surfaces require fine finish (Ra < 1.6μm). Accepting standard finish (Ra 3.2μm) on non-critical surfaces saves polishing/honing operations.`,
        partId: part.id,
        partName: part.fileName,
        currentValue: `Ra ${advancedFeatures.surfaceFinish.estimatedRa}μm`,
        suggestedValue: "Standard finish on non-critical",
        preview: part.snapshot_2d_url,

        impact: {
          savings: advancedFeatures.surfaceFinish.criticalSurfaces * 8,
          savingsPercentage: Math.round(
            ((advancedFeatures.surfaceFinish.criticalSurfaces * 8) /
              (part.final_price || 200)) *
              100,
          ),
        },
        icon: React.createElement(Sparkles, { className: "w-5 h-5" }),
        color: "amber",
        action: { type: "relax-surface-finish" },
      });
    }

    // Thin wall warnings
    if (advancedFeatures.thinWalls.risk === "high") {
      suggestions.push({
        id: `dfm-thinwall-${part.id}`,
        type: "dfm",
        title: "Critical: Increase Wall Thickness",
        description: `Thin walls (${advancedFeatures.thinWalls.minThickness.toFixed(1)}mm) pose high deflection risk. Increasing to 2.5mm minimum would dramatically reduce scrap rate and improve manufacturability.`,
        partId: part.id,
        partName: part.fileName,
        currentValue: `${advancedFeatures.thinWalls.minThickness.toFixed(1)}mm`,
        suggestedValue: "2.5mm minimum",
        preview: part.snapshot_2d_url,

        impact: {
          savings: 120,
          savingsPercentage: 22,
        },
        icon: React.createElement(AlertTriangle, { className: "w-5 h-5" }),
        color: "red",
        action: { type: "increase-wall-thickness", minThickness: 2.5 },
      });
    } else if (advancedFeatures.thinWalls.risk === "medium") {
      suggestions.push({
        id: `dfm-thinwall-medium-${part.id}`,
        type: "dfm",
        title: "Improve Wall Thickness",
        description: `Moderate thin walls (${advancedFeatures.thinWalls.minThickness.toFixed(1)}mm). Increasing to 2.5mm would improve rigidity and reduce cycle time.`,
        partId: part.id,
        partName: part.fileName,
        currentValue: `${advancedFeatures.thinWalls.minThickness.toFixed(1)}mm`,
        suggestedValue: "2.5mm",
        preview: part.snapshot_2d_url,

        impact: {
          savings: 45,
          savingsPercentage: 12,
        },
        icon: React.createElement(Zap, { className: "w-5 h-5" }),
        color: "amber",
        action: { type: "increase-wall-thickness", minThickness: 2.5 },
      });
    }
  }

  // Sheet metal DFM suggestions
  if (recommendedProcess === "sheet-metal" && sheetMetalFeatures) {
    // High bend count
    if (sheetMetalFeatures.bendCount > 12) {
      suggestions.push({
        id: `dfm-bends-${part.id}`,
        type: "dfm",
        title: "Reduce Bend Count",
        description: `Part has ${sheetMetalFeatures.bendCount} bends. Simplifying design to reduce bends by 30% would significantly decrease forming time and cost.`,
        partId: part.id,
        partName: part.fileName,
        currentValue: `${sheetMetalFeatures.bendCount} bends`,
        suggestedValue: `${Math.ceil(sheetMetalFeatures.bendCount * 0.7)} bends`,
        preview: part.snapshot_2d_url,

        impact: {
          savings: 60,
          savingsPercentage: 15,
        },
        icon: React.createElement(Layers, { className: "w-5 h-5" }),
        color: "amber",
        action: { type: "reduce-bends", targetReduction: 0.3 },
      });
    }

    // Bend radius too small
    if (sheetMetalFeatures.minBendRadius < sheetMetalFeatures.thickness) {
      suggestions.push({
        id: `dfm-bendradius-${part.id}`,
        type: "dfm",
        title: "Critical: Increase Bend Radius",
        description: `Bend radius (${sheetMetalFeatures.minBendRadius.toFixed(1)}mm) is less than material thickness. This will crack during forming. Increase to minimum ${(sheetMetalFeatures.thickness * 1.5).toFixed(1)}mm.`,
        partId: part.id,
        partName: part.fileName,
        currentValue: `${sheetMetalFeatures.minBendRadius.toFixed(1)}mm radius`,
        suggestedValue: `${(sheetMetalFeatures.thickness * 1.5).toFixed(1)}mm radius`,
        preview: part.snapshot_2d_url,

        impact: {
          savings: 0,
          savingsPercentage: 0,
        },
        icon: React.createElement(AlertTriangle, { className: "w-5 h-5" }),
        color: "red",
        action: {
          type: "increase-bend-radius",
          minRadius: sheetMetalFeatures.thickness * 1.5,
        },
      });
    }

    // Small features warning
    if (sheetMetalFeatures.hasSmallFeatures) {
      suggestions.push({
        id: `dfm-small-features-${part.id}`,
        type: "dfm",
        title: "Enlarge Small Features",
        description:
          "Features smaller than 2x material thickness detected. These may be difficult or impossible to form reliably. Consider increasing feature size.",
        partId: part.id,
        partName: part.fileName,
        currentValue: "< 2x thickness",
        suggestedValue: "≥ 2x thickness",
        preview: part.snapshot_2d_url,

        impact: {
          savings: 35,
          savingsPercentage: 10,
        },
        icon: React.createElement(Zap, { className: "w-5 h-5" }),
        color: "amber",
        action: {
          type: "enlarge-features",
          minSize: sheetMetalFeatures.thickness * 2,
        },
      });
    }
  }

  // Tolerance optimization
  if (part.tolerance === "tight" || part.tolerance === "Tight") {
    const geometry = part.geometry;
    if (geometry && geometry.complexity === "complex") {
      suggestions.push({
        id: `dfm-tolerance-${part.id}`,
        type: "tolerance",
        title: "Relax Non-Critical Tolerances",
        description:
          "Tight tolerances (±0.025mm) on complex geometry significantly increase cost. Consider specifying tight tolerances only on critical dimensions and standard tolerances elsewhere.",
        partId: part.id,
        partName: part.fileName,
        currentValue: "Tight (±0.025mm)",
        suggestedValue: "Mixed (Precision on critical dims)",
        preview: part.snapshot_2d_url,

        impact: {
          savings: 200,
          savingsPercentage: 35,
        },
        icon: React.createElement(AlertTriangle, { className: "w-5 h-5" }),
        color: "orange",
        action: { type: "relax-tolerances", newTolerance: "precision" },
      });
    }
  }

  return suggestions;
}

/**
 * Generate alternative material suggestions for cost savings or performance improvement
 */
function generateAlternativeMaterialSuggestions(
  part: PartConfig,
): Suggestion[] {
  const suggestions: Suggestion[] = [];
  const currentMaterial = part.material;
  const geometry = part.geometry;

  if (!geometry) return suggestions;

  const isSheetMetal = geometry.recommendedProcess === "sheet-metal";
  const isCNC =
    geometry.recommendedProcess === "cnc-milling" ||
    geometry.recommendedProcess === "cnc-turning";

  // CNC Material Alternatives
  if (isCNC) {
    // Aluminum 6061 alternatives
    if (currentMaterial.includes("6061")) {
      // Cheaper alternative: Aluminum 6063
      suggestions.push({
        id: `mat-cheaper-${part.id}`,
        type: "material",
        title: "Cost-Saving Material Option",
        description:
          "Aluminum 6063 offers similar properties to 6061 with 8% lower material cost. Suitable for non-structural applications with moderate strength requirements.",
        partId: part.id,
        partName: part.fileName,
        currentValue: "Aluminum 6061",
        suggestedValue: "Aluminum 6063",
        preview: part.snapshot_2d_url,

        impact: {
          savings: 15,
          savingsPercentage: 8,
        },
        icon: React.createElement(TrendingUp, { className: "w-5 h-5" }),
        color: "green",
        action: { type: "change-material", material: "Aluminum 6063" },
      });

      // Performance upgrade: Aluminum 7075
      if (
        geometry.complexity === "complex" ||
        geometry.advancedFeatures.thinWalls.count > 0
      ) {
        suggestions.push({
          id: `mat-upgrade-${part.id}`,
          type: "material",
          title: "Performance Material Upgrade",
          description:
            "Aluminum 7075 offers 40% higher tensile strength than 6061. Recommended for thin-walled or high-stress applications. Worth the 15% cost increase for critical parts.",
          partId: part.id,
          partName: part.fileName,
          currentValue: "Aluminum 6061",
          suggestedValue: "Aluminum 7075",
          preview: part.snapshot_2d_url,
          impact: {
            savings: -25,
            savingsPercentage: -8,
          },
          icon: React.createElement(TrendingUp, { className: "w-5 h-5" }),
          color: "purple",
          action: { type: "change-material", material: "Aluminum 7075" },
        });
      }
    }

    // Steel 1018 alternatives
    if (currentMaterial.includes("1018")) {
      // Cheaper option: A36
      suggestions.push({
        id: `mat-steel-cheaper-${part.id}`,
        type: "material",
        title: "Lower-Cost Steel Option",
        description:
          "Steel A36 is 10% cheaper than 1018 and suitable for most general-purpose applications. Similar strength and machinability.",
        partId: part.id,
        partName: part.fileName,
        currentValue: "Steel 1018",
        suggestedValue: "Steel A36",
        preview: part.snapshot_2d_url,

        impact: {
          savings: 12,
          savingsPercentage: 10,
        },
        icon: React.createElement(TrendingUp, { className: "w-5 h-5" }),
        color: "green",
        action: { type: "change-material", material: "Steel A36" },
      });

      // Stronger option: 4140
      if (geometry.complexity !== "simple") {
        suggestions.push({
          id: `mat-steel-upgrade-${part.id}`,
          type: "material",
          title: "High-Strength Steel Upgrade",
          description:
            "Steel 4140 offers significantly higher strength and wear resistance. Recommended for high-stress or precision applications.",
          partId: part.id,
          partName: part.fileName,
          currentValue: "Steel 1018",
          suggestedValue: "Steel 4140",
          preview: part.snapshot_2d_url,

          impact: {
            savings: -35,
            savingsPercentage: -12,
          },
          icon: React.createElement(TrendingUp, { className: "w-5 h-5" }),
          color: "purple",
          action: { type: "change-material", material: "Steel 4140" },
        });
      }
    }

    // Stainless alternatives
    if (
      currentMaterial.includes("304") &&
      !currentMaterial.includes("Brushed") &&
      !currentMaterial.includes("Mirror")
    ) {
      // 303 for better machinability
      suggestions.push({
        id: `mat-ss-machining-${part.id}`,
        type: "material",
        title: "Better Machinability Option",
        description:
          "Stainless 303 is specifically designed for CNC machining with 20% better machinability than 304. 8% cost savings due to reduced machining time.",
        partId: part.id,
        partName: part.fileName,
        currentValue: "Stainless 304",
        suggestedValue: "Stainless 303",
        preview: part.snapshot_2d_url,

        impact: {
          savings: 45,
          savingsPercentage: 12,
        },
        icon: React.createElement(Zap, { className: "w-5 h-5" }),
        color: "green",
        action: { type: "change-material", material: "Stainless 303" },
      });
    }
  }

  // Sheet Metal Material Alternatives
  if (isSheetMetal && geometry.sheetMetalFeatures) {
    const thickness = geometry.sheetMetalFeatures.thickness;

    // Stainless alternatives for sheet metal
    if (
      currentMaterial.includes("Stainless") &&
      currentMaterial.includes("304")
    ) {
      // Check for decorative vs functional
      if (
        !currentMaterial.includes("Brushed") &&
        !currentMaterial.includes("Mirror")
      ) {
        suggestions.push({
          id: `mat-sheet-301-${part.id}`,
          type: "material",
          title: "Cost-Effective Stainless Option",
          description:
            "Stainless 301 offers excellent formability for sheet metal work with 5-8% lower cost than 304. Ideal for parts with multiple bends.",
          partId: part.id,
          partName: part.fileName,
          currentValue: "Stainless 304",
          suggestedValue: "Stainless 301",
          preview: part.snapshot_2d_url,

          impact: {
            savings: 18,
            savingsPercentage: 7,
          },
          icon: React.createElement(TrendingUp, { className: "w-5 h-5" }),
          color: "green",
          action: { type: "change-material", material: "Stainless 301" },
        });
      }
    }

    // Aluminum alternatives for sheet metal
    if (currentMaterial.includes("6061") && isSheetMetal) {
      suggestions.push({
        id: `mat-sheet-5052-${part.id}`,
        type: "material",
        title: "Better Forming Characteristics",
        description:
          "Aluminum 5052 has superior formability for sheet metal and excellent corrosion resistance. 5% cost savings with better bend performance.",
        partId: part.id,
        partName: part.fileName,
        currentValue: "Aluminum 6061",
        suggestedValue: "Aluminum 5052-H32",
        preview: part.snapshot_2d_url,

        impact: {
          savings: 22,
          savingsPercentage: 9,
        },
        icon: React.createElement(Layers, { className: "w-5 h-5" }),
        color: "green",
        action: { type: "change-material", material: "Aluminum 5052-H32" },
      });
    }

    // Steel alternatives for sheet metal
    if (
      currentMaterial.includes("Steel") &&
      !currentMaterial.includes("Stainless") &&
      !currentMaterial.includes("Galvanized")
    ) {
      suggestions.push({
        id: `mat-sheet-galv-${part.id}`,
        type: "material",
        title: "Add Corrosion Protection",
        description:
          "Galvanized steel provides rust protection at only 15% higher cost. Recommended for outdoor or humid environments.",
        partId: part.id,
        partName: part.fileName,
        currentValue: "Steel A36",
        suggestedValue: "Galvanized Steel A653",
        preview: part.snapshot_2d_url,

        impact: {
          savings: -12,
          savingsPercentage: -6,
        },
        icon: React.createElement(TrendingUp, { className: "w-5 h-5" }),
        color: "purple",
        action: { type: "change-material", material: "Galvanized Steel A653" },
      });
    }
  }

  // Brass/Copper alternatives
  if (currentMaterial.includes("Copper") || currentMaterial.includes("Brass")) {
    // Check if decorative or functional
    if (
      !currentMaterial.includes("Mirror") &&
      !currentMaterial.includes("Polished")
    ) {
      suggestions.push({
        id: `mat-brass-alternative-${part.id}`,
        type: "material",
        title: "Consider Bronze Alternative",
        description:
          "Bronze alloys offer similar properties to brass/copper with better wear resistance and 12% lower cost for non-electrical applications.",
        partId: part.id,
        partName: part.fileName,
        currentValue: currentMaterial,
        suggestedValue: "Bronze C932",
        preview: part.snapshot_2d_url,

        impact: {
          savings: 28,
          savingsPercentage: 12,
        },
        icon: React.createElement(TrendingUp, { className: "w-5 h-5" }),
        color: "green",
        action: { type: "change-material", material: "Bronze C932" },
      });
    }
  }

  return suggestions;
}

/**
 * Generate original suggestions (quantity, finish, lead time)
 */
function generateLegacySuggestions(part: PartConfig): Suggestion[] {
  const suggestions: Suggestion[] = [];

  // Quantity optimization suggestion
  if (part.quantity >= 8 && part.quantity <= 12) {
    const suggestedQty = 15;
    const currentPrice = part.final_price || 200;
    const savings = currentPrice * 0.12;

    suggestions.push({
      id: `qty-${part.id}`,
      type: "quantity",
      title: "Volume Pricing Unlock",
      description: `Boosting to ${suggestedQty} units triggers a 12% price break on this specific geometry.`,
      partId: part.id,
      partName: part.fileName,
      currentValue: part.quantity,
      suggestedValue: suggestedQty,
      preview: part.snapshot_2d_url,

      impact: {
        savings,
        savingsPercentage: 12,
      },
      icon: React.createElement(Package, { className: "w-5 h-5" }),
      color: "blue",
      action: { type: "change-quantity", quantity: suggestedQty },
    });
  }

  // Lead time optimization
  if (part.leadTimeType === "expedited") {
    const currentPrice = part.final_price || 200;
    const savings = currentPrice * 0.35;

    suggestions.push({
      id: `lead-${part.id}`,
      type: "leadtime",
      title: "Consider Standard Lead Time",
      description: `Switching to standard lead time can save 35% on this part`,
      partId: part.id,
      partName: part.fileName,
      currentValue: "Expedited",
      suggestedValue: "Standard",
      preview: part.snapshot_2d_url,

      impact: {
        savings,
        savingsPercentage: 35,
        leadTimeReduction: -5,
      },
      icon: React.createElement(Clock, { className: "w-5 h-5" }),
      color: "green",
      action: { type: "change-lead-time", leadTime: "standard" },
    });
  }

  // Finish optimization
  if (
    part.finish &&
    (part.finish.includes("Anodiz") || part.finish === "Anodizing")
  ) {
    suggestions.push({
      id: `finish-${part.id}`,
      type: "finish",
      title: "Cost-Effective Finish Option",
      description: `Powder coating provides similar protection at 20% lower cost`,
      partId: part.id,
      partName: part.fileName,
      currentValue: part.finish,
      suggestedValue: "Powder Coating",
      preview: part.snapshot_2d_url,

      impact: {
        savings: 35.0,
        savingsPercentage: 20,
      },
      icon: React.createElement(Sparkles, { className: "w-5 h-5" }),
      color: "amber",
      action: { type: "change-finish", finish: "Powder Coating" },
    });
  }

  return suggestions;
}

/**
 * Generate marketing-focused suggestions for volume discounts, performance upgrades, and premium services
 */
function generateMarketingSuggestions(part: PartConfig): Suggestion[] {
  const suggestions: Suggestion[] = [];
  const geometry = part.geometry;
  const currentQty = part.quantity || 1;
  const unitPrice = part.final_price || 0;

  if (!geometry || unitPrice === 0) return suggestions;

  const isPerformancePart =
    geometry.complexity === "complex" ||
    geometry.advancedFeatures?.thinWalls.risk === "high" ||
    geometry.advancedFeatures?.undercuts.requires5Axis ||
    (part.tolerance &&
      (part.tolerance === "tight" || part.tolerance === "Tight"));

  const isProductionRun = currentQty >= 5;
  const material = part.material || "";

  // VOLUME DISCOUNT OPPORTUNITIES
  // Tiered volume suggestions for cost optimization
  if (currentQty < 10) {
    const nextTierQty = currentQty < 5 ? 10 : currentQty < 10 ? 25 : 50;
    const discountRate =
      nextTierQty >= 50
        ? 0.32
        : nextTierQty >= 25
          ? 0.25
          : nextTierQty >= 10
            ? 0.18
            : 0.12;
    const newUnitPrice = unitPrice * (1 - discountRate);
    const totalCurrentCost = unitPrice * currentQty;
    const totalNewCost = newUnitPrice * nextTierQty;
    const extraParts = nextTierQty - currentQty;
    const effectiveSavings =
      totalCurrentCost - (totalNewCost / nextTierQty) * currentQty;

    suggestions.push({
      id: `volume-${part.id}`,
      type: "volume-discount",
      title: `🎯 Buy ${nextTierQty} Parts, Save ${Math.round(discountRate * 100)}% Per Unit`,
      description: `Manufacturing ${nextTierQty} parts unlocks bulk pricing: $${newUnitPrice.toFixed(2)}/unit (down from $${unitPrice.toFixed(2)}). Get ${extraParts} extra parts for just $${(totalNewCost - totalCurrentCost).toFixed(2)} more - that's $${(effectiveSavings / currentQty).toFixed(2)} savings per part you need now, plus ${extraParts} spares for future.`,
      partId: part.id,
      partName: part.fileName,
      currentValue: `${currentQty} parts @ $${unitPrice.toFixed(2)}`,
      suggestedValue: `${nextTierQty} parts @ $${newUnitPrice.toFixed(2)}`,
      preview: part.snapshot_2d_url,

      impact: {
        savings: effectiveSavings,
        savingsPercentage: Math.round(
          (effectiveSavings / totalCurrentCost) * 100,
        ),
        lifetimeSavings: effectiveSavings * 3, // Assuming 3 reorders over lifetime
      },
      icon: React.createElement(Package, { className: "w-5 h-5" }),
      color: "teal",
      category: "volume-discount",
      priority: effectiveSavings > 100 ? "high" : "medium",
      action: { type: "increase-quantity", quantity: nextTierQty },
    });
  }

  // PERFORMANCE MATERIAL UPGRADES
  // Suggest premium materials for performance-critical parts
  if (isPerformancePart) {
    const upgradeSuggestions = [];

    // High-performance aluminum upgrade
    if (material.includes("6061") && !material.includes("7075")) {
      upgradeSuggestions.push({
        material: "Aluminum 7075-T6",
        benefit: "2.4x tensile strength (572 MPa vs 240 MPa)",
        costIncrease: unitPrice * 0.15,
        reason:
          geometry.advancedFeatures?.thinWalls.risk === "high"
            ? "Critical for thin-wall strength and rigidity"
            : geometry.complexity === "complex"
              ? "Enhanced strength for complex geometry under stress"
              : "Premium strength for tight-tolerance precision parts",
      });
    }

    // Aerospace-grade titanium upgrade
    if (
      material.includes("6061") &&
      (geometry.advancedFeatures?.thinWalls.count > 0 ||
        part.tolerance === "tight")
    ) {
      upgradeSuggestions.push({
        material: "Titanium Ti-6Al-4V",
        benefit: "Aerospace-grade: 40% lighter, 4x fatigue resistance",
        costIncrease: unitPrice * 0.85,
        reason:
          "Best strength-to-weight ratio for mission-critical applications",
      });
    }

    // High-strength steel upgrade
    if (material.includes("1018") || material.includes("A36")) {
      upgradeSuggestions.push({
        material: "Steel 4140 (Heat Treated)",
        benefit: "2x yield strength (655 MPa), superior wear resistance",
        costIncrease: unitPrice * 0.22,
        reason: "Essential for high-stress, high-wear applications",
      });
    }

    // Stainless upgrade for corrosion resistance
    if (
      !material.toLowerCase().includes("stainless") &&
      !material.toLowerCase().includes("titanium")
    ) {
      upgradeSuggestions.push({
        material: "Stainless Steel 17-4 PH",
        benefit: "Precipitation hardened: corrosion resistant + high strength",
        costIncrease: unitPrice * 0.35,
        reason: "Premium corrosion protection with strength of hardened steel",
      });
    }

    upgradeSuggestions.forEach((upgrade, index) => {
      const newPrice = unitPrice + upgrade.costIncrease;
      const lifetimeValue = upgrade.costIncrease * currentQty * 3; // 3x reorders

      suggestions.push({
        id: `perf-upgrade-${part.id}-${index}`,
        type: "premium-upgrade",
        title: `⚡ Performance Upgrade: ${upgrade.material}`,
        description: `${upgrade.benefit}. ${upgrade.reason}. Investment: +$${upgrade.costIncrease.toFixed(2)}/part. For ${currentQty} parts: $${(upgrade.costIncrease * currentQty).toFixed(2)} total. Prevents field failures and warranty claims worth thousands.`,
        partId: part.id,
        partName: part.fileName,
        currentValue: material,
        suggestedValue: upgrade.material,
        preview: part.snapshot_2d_url,

        impact: {
          savings: -upgrade.costIncrease * currentQty,
          savingsPercentage: -Math.round(
            (upgrade.costIncrease / unitPrice) * 100,
          ),
          revenueIncrease: upgrade.costIncrease * currentQty,
          lifetimeSavings: -lifetimeValue,
        },
        icon: React.createElement(Zap, { className: "w-5 h-5" }),
        color: "indigo",
        category: "performance-upgrade",
        priority:
          geometry.advancedFeatures?.thinWalls.risk === "high"
            ? "critical"
            : "high",
        action: { type: "upgrade-material", material: upgrade.material },
      });
    });
  }

  // PREMIUM FINISH UPGRADES
  // Suggest premium finishes for professional applications
  if (!part.finish || part.finish === "None" || part.finish === "As Machined") {
    const finishUpgrades = [];

    if (material.includes("6061") || material.includes("7075")) {
      finishUpgrades.push({
        finish: "Type II Anodizing (Colored)",
        benefit:
          "Professional appearance, corrosion protection, wear resistance",
        cost: 25,
        colors: ["Black", "Clear", "Blue", "Red", "Gold"],
      });
    }

    if (
      material.toLowerCase().includes("steel") &&
      !material.toLowerCase().includes("stainless")
    ) {
      finishUpgrades.push({
        finish: "Black Oxide Coating",
        benefit:
          "Corrosion resistance, professional black finish, minimal dimension change",
        cost: 18,
        colors: ["Black"],
      });
    }

    finishUpgrades.forEach((finishUp, index) => {
      const totalCost = finishUp.cost * currentQty;

      suggestions.push({
        id: `finish-upgrade-${part.id}-${index}`,
        type: "premium-upgrade",
        title: `✨ Premium Finish: ${finishUp.finish}`,
        description: `${finishUp.benefit}. Available in ${finishUp.colors.join(", ")}. Only $${finishUp.cost}/part (+$${totalCost} for ${currentQty} parts). Professional appearance for customer-facing applications.`,
        partId: part.id,
        partName: part.fileName,
        currentValue: part.finish || "As Machined",
        suggestedValue: finishUp.finish,
        preview: part.snapshot_2d_url,

        impact: {
          savings: -totalCost,
          savingsPercentage: -Math.round((finishUp.cost / unitPrice) * 100),
          revenueIncrease: totalCost,
        },
        icon: React.createElement(Sparkles, { className: "w-5 h-5" }),
        color: "purple",
        category: "premium-service",
        priority: "medium",
        action: { type: "upgrade-finish", finish: finishUp.finish },
      });
    });
  }

  // EXPEDITED SHIPPING OPPORTUNITIES
  // Suggest faster shipping for time-sensitive projects
  if ((!part.leadTime || part.leadTimeType == "standard") && currentQty <= 20) {
    const expediteCost = unitPrice * 0.28; // 28% for expedited
    const totalExpedite = expediteCost * currentQty;

    suggestions.push({
      id: `expedite-${part.id}`,
      type: "express-shipping",
      title: `🚀 Rush Production: 3-Day Turnaround`,
      description: `Need these parts urgently? Expedited production delivers in 3 business days (vs 10-14 days standard). Perfect for prototypes, emergency repairs, or tight project deadlines. Cost: +$${expediteCost.toFixed(2)}/part.`,
      partId: part.id,
      partName: part.fileName,
      currentValue: "10-14 days",
      suggestedValue: "3 days",
      preview: part.snapshot_2d_url,

      impact: {
        savings: -totalExpedite,
        savingsPercentage: -28,
        leadTimeReduction: 9,
        revenueIncrease: totalExpedite,
      },
      icon: React.createElement(Clock, { className: "w-5 h-5" }),
      color: "orange",
      category: "premium-service",
      priority: "medium",
      action: { type: "expedite-production", leadTime: "expedited" },
    });
  }

  // QUALITY TIER UPGRADES
  // First Article Inspection for production runs
  if (isProductionRun && currentQty >= 10) {
    const faiCost = 150;
    const scrapPrevention = unitPrice * currentQty * 0.15; // Prevents 15% scrap rate

    suggestions.push({
      id: `fai-${part.id}`,
      type: "premium-upgrade",
      title: `🎯 Add First Article Inspection (FAI)`,
      description: `Professional dimensional inspection with CMM measurement report before production run. Verifies all ${geometry.advancedFeatures?.holes.count || "critical"} features meet spec. Prevents costly production scrap. Investment: $${faiCost}. Potential scrap prevention: $${scrapPrevention.toFixed(2)}.`,
      partId: part.id,
      partName: part.fileName,
      currentValue: "Standard QC",
      suggestedValue: "FAI + Full Production",
      preview: part.snapshot_2d_url,

      impact: {
        savings: scrapPrevention - faiCost,
        savingsPercentage: Math.round(
          ((scrapPrevention - faiCost) / (unitPrice * currentQty)) * 100,
        ),
        lifetimeSavings: scrapPrevention * 2,
      },
      icon: React.createElement(Sparkles, { className: "w-5 h-5" }),
      color: "blue",
      category: "quality-improvement",
      priority: part.tolerance === "tight" ? "critical" : "high",
      action: { type: "add-fai", service: "first-article-inspection" },
    });
  }

  // CMM INSPECTION for tight tolerance parts
  if (part.tolerance === "tight" || part.tolerance === "Tight") {
    const cmmCost = 85 * currentQty;

    suggestions.push({
      id: `cmm-${part.id}`,
      type: "premium-upgrade",
      title: `📐 CMM Inspection Report`,
      description: `Full dimensional report with Coordinate Measuring Machine for all ${geometry.advancedFeatures?.holes.count || 0}+ features. Essential for tight tolerance (±0.025mm) verification. Certificate of conformance included. Industry standard for aerospace/medical applications.`,
      partId: part.id,
      partName: part.fileName,
      currentValue: "Visual Inspection",
      suggestedValue: "CMM Full Report",
      preview: part.snapshot_2d_url,

      impact: {
        savings: -cmmCost,
        savingsPercentage: -Math.round(
          (cmmCost / (unitPrice * currentQty)) * 100,
        ),
        revenueIncrease: cmmCost,
      },
      icon: React.createElement(Sparkles, { className: "w-5 h-5" }),
      color: "indigo",
      category: "quality-improvement",
      priority: "high",
      action: { type: "add-cmm", service: "cmm-inspection" },
    });
  }

  return suggestions;
}

/**
 * Generate bundle suggestions for multi-part quotes
 */
function generateBundleSuggestions(parts: PartConfig[]): Suggestion[] {
  const suggestions: Suggestion[] = [];

  const totalValue = parts.reduce(
    (sum, p) => sum + (p.final_price || 0) * (p.quantity || 1),
    0,
  );
  const totalParts = parts.reduce((sum, p) => sum + (p.quantity || 1), 0);

  // Assembly service bundle
  if (parts.length >= 3 && totalParts >= 10) {
    const assemblyCost = totalValue * 0.12;
    const assemblyTime = parts.length * 15; // minutes

    suggestions.push({
      id: "bundle-assembly",
      type: "bundle",
      title: `🔧 Add Assembly Service - Save Time`,
      description: `We can assemble all ${parts.length} components into final product. Includes: cleaning, deburring, fastener installation, and functional testing. Estimated ${assemblyTime} minutes assembly time @ $60/hr = $${assemblyCost.toFixed(2)}. Ships ready to use.`,
      partId: "multi",
      partName: "Complete Assembly",
      currentValue: `${parts.length} separate parts`,
      suggestedValue: "Assembled product",
      preview: parts[0].snapshot_2d_url,

      impact: {
        savings: -assemblyCost,
        savingsPercentage: -Math.round((assemblyCost / totalValue) * 100),
        revenueIncrease: assemblyCost,
        leadTimeReduction: -2,
      },
      icon: React.createElement(Package, { className: "w-5 h-5" }),
      color: "indigo",
      category: "premium-service",
      priority: "medium",
      action: { type: "add-assembly", service: "full-assembly" },
    });
  }

  // Kitting service
  if (parts.length >= 2) {
    const kittingCost = parts.length * 8;

    suggestions.push({
      id: "bundle-kitting",
      type: "bundle",
      title: `📦 Kitting Service - Organized Delivery`,
      description: `Custom kitting: each part set individually bagged, labeled, and packaged with assembly instructions. Perfect for production lines or multiple installations. Only $${kittingCost.toFixed(2)} for ${parts.length} part types.`,
      partId: "multi",
      partName: "Kitted Parts",
      currentValue: "Bulk packaging",
      suggestedValue: "Individual kits",
      preview: parts[0].snapshot_2d_url,

      impact: {
        savings: -kittingCost,
        savingsPercentage: -Math.round((kittingCost / totalValue) * 100),
        revenueIncrease: kittingCost,
      },
      icon: React.createElement(Package, { className: "w-5 h-5" }),
      color: "teal",
      category: "premium-service",
      priority: "low",
      action: { type: "add-kitting", service: "custom-kitting" },
    });
  }

  // Bulk order discount for similar parts
  const similarMaterials = parts.filter(
    (p) => p.material === parts[0].material,
  );
  if (similarMaterials.length >= 2 && totalParts < 50) {
    const bulkQty = 50;
    const potentialSavings = totalValue * 0.22;

    suggestions.push({
      id: "bundle-bulk",
      type: "volume-discount",
      title: `💎 Bulk Order Bonus: Order 50+ Total Parts`,
      description: `You have ${parts.length} different parts in ${parts[0].material}. Combining into a 50+ piece order unlocks 22% volume discount across all parts. Current total: ${totalParts} parts. Add ${bulkQty - totalParts} more to unlock savings of $${potentialSavings.toFixed(2)}.`,
      partId: "multi",
      partName: "Bulk Order",
      currentValue: `${totalParts} parts`,
      suggestedValue: `${bulkQty}+ parts`,
      preview: parts[0].snapshot_2d_url,
      impact: {
        savings: potentialSavings,
        savingsPercentage: 22,
        lifetimeSavings: potentialSavings * 4,
      },
      icon: React.createElement(TrendingUp, { className: "w-5 h-5" }),
      color: "green",
      category: "volume-discount",
      priority: "high",
      action: { type: "increase-total-quantity", target: bulkQty },
    });
  }

  return suggestions;
}
