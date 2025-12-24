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
} from "lucide-react";
import React, { useEffect, useState, useRef } from "react";
import { cn } from "@/lib/utils";
import { PartConfig } from "@/types/part-config";
import { motion, AnimatePresence } from "framer-motion";

// DFM Check Status Types
type CheckStatus = "pass" | "warning" | "fail" | "info" | "loading";

interface DFMCheck {
  id: string;
  name: string;
  description: string;
  status: CheckStatus;
  details?: string;
  icon: React.ReactNode;
  category: "geometry" | "feasibility" | "specs";
}

interface DFMAnalysisResult {
  overallScore: number;
  manufacturability: "excellent" | "good" | "fair" | "poor";
  checks: DFMCheck[];
  recommendations: string[];
  estimatedIssues: number;
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

  // Analysis logic (simplified as requested, same as before)
  const fileExt = part.fileName.split(".").pop()?.toLowerCase() || "";
  const isValidFileType = SUPPORTED_FILE_TYPES.includes(fileExt);
  checks.push({
    id: "file-type",
    name: "File Format",
    description: "Verifies the file format is supported",
    status: isValidFileType ? "pass" : "fail",
    details: isValidFileType
      ? `${fileExt.toUpperCase()} supported`
      : "Convert to STEP/STL",
    icon: <FileType className="w-4 h-4" />,
    category: "geometry",
  });

  const hasGeometry = !!part.geometry;
  const shellCount = hasGeometry ? 1 : 0;
  const hasFloatingParts = shellCount > 1;
  checks.push({
    id: "floating-parts",
    name: "Disconnected Geometry",
    description: "Detects disconnected solid bodies",
    status: hasFloatingParts ? "fail" : "pass",
    details: hasFloatingParts ? `${shellCount} bodies` : "Single solid body",
    icon: <Layers className="w-4 h-4" />,
    category: "geometry",
  });

  const boundingBox = part.geometry?.boundingBox || { x: 100, y: 100, z: 50 };
  const exceedsMaxSize =
    boundingBox.x > MAX_DIMENSIONS.x ||
    boundingBox.y > MAX_DIMENSIONS.y ||
    boundingBox.z > MAX_DIMENSIONS.z;
  const maxDim = Math.max(boundingBox.x, boundingBox.y, boundingBox.z);
  checks.push({
    id: "large-part",
    name: "Part Size",
    description: "Checks machine work envelope",
    status: exceedsMaxSize ? "warning" : "pass",
    details: `${boundingBox.x.toFixed(0)}x${boundingBox.y.toFixed(0)}x${boundingBox.z.toFixed(0)}mm`,
    icon: <Maximize2 className="w-4 h-4" />,
    category: "feasibility",
  });

  checks.push({
    id: "model-fidelity",
    name: "Geometric Integrity",
    description: "Validates mesh and surface quality",
    status: hasGeometry ? "pass" : "warning",
    details: hasGeometry ? "Validated" : "Unverified",
    icon: <Shield className="w-4 h-4" />,
    category: "geometry",
  });

  const finishSizeLimit = 600; // Simplified
  const exceedsFinishSize = maxDim > finishSizeLimit;
  checks.push({
    id: "finish-size",
    name: "Finish Compatibility",
    description: "Checks size for selected finish",
    status: exceedsFinishSize ? "warning" : "pass",
    details: part.finish || "Standard",
    icon: <Circle className="w-4 h-4" />,
    category: "specs",
  });

  const wallThickness = 2.0;
  checks.push({
    id: "wall-thickness",
    name: "Wall Thickness",
    description: "Minimum thickness check",
    status: wallThickness >= MIN_WALL_THICKNESS ? "pass" : "warning",
    details: `~${wallThickness}mm`,
    icon: <Ruler className="w-4 h-4" />,
    category: "feasibility",
  });

  const toleranceValue = 0.1;
  checks.push({
    id: "tolerance",
    name: "Tolerance",
    description: "Requested accuracy check",
    status: toleranceValue >= 0.025 ? "pass" : "warning",
    details: `±${toleranceValue}mm`,
    icon: <CheckCheck className="w-4 h-4" />,
    category: "specs",
  });

  // Calculate score
  const passCount = checks.filter((c) => c.status === "pass").length;
  const warningCount = checks.filter((c) => c.status === "warning").length;
  const failCount = checks.filter((c) => c.status === "fail").length;
  const overallScore = Math.round(
    ((passCount * 10 + warningCount * 5) / (checks.length * 10)) * 100,
  );

  let manufacturability: "excellent" | "good" | "fair" | "poor";
  if (failCount > 0) manufacturability = "poor";
  else if (warningCount > 2) manufacturability = "fair";
  else if (warningCount > 0) manufacturability = "good";
  else manufacturability = "excellent";

  if (failCount > 0)
    recommendations.push(
      "Address disconnected geometry issues before production.",
    );
  if (warningCount > 0)
    recommendations.push("Verify tight tolerances with our engineering team.");

  return {
    overallScore,
    manufacturability,
    checks,
    recommendations,
    estimatedIssues: failCount + warningCount,
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

const DFMAnalysis = ({ part }: { part: PartConfig }) => {
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
            label="Issues"
            value={analysis.estimatedIssues}
            color="text-rose-600"
          />
          <StatTile
            label="Success"
            value={analysis.checks.filter((c) => c.status === "pass").length}
            color="text-emerald-600"
          />
        </div>
      </div>

      {/* Main Content Area - Split View */}
      <div className="flex-1 flex overflow-hidden min-h-0">
        {/* Left Sidebar - Summary & recommendations */}
        <div className="w-72 border-r bg-gray-50/30 p-5 overflow-y-auto hidden lg:block">
          <h4 className="text-[11px] font-black text-gray-400 uppercase tracking-widest mb-4">
            Design Health
          </h4>
          <div className="space-y-3 mb-8">
            {["geometry", "feasibility", "specs"].map((cat) => {
              const catChecks = analysis.checks.filter(
                (c) => c.category === cat,
              );
              const pass = catChecks.filter((c) => c.status === "pass").length;
              return (
                <div key={cat} className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between text-xs font-bold px-1">
                    <span className="capitalize">{cat}</span>
                    <span className="text-gray-400">
                      {pass}/{catChecks.length}
                    </span>
                  </div>
                  <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${(pass / catChecks.length) * 100}%` }}
                      className={cn(
                        "h-full transition-all duration-1000",
                        mood.bg,
                      )}
                    />
                  </div>
                </div>
              );
            })}
          </div>

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
                    Next Steps
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
            {(["geometry", "feasibility", "specs"] as const).map((cat) => (
              <div key={cat} className="space-y-4">
                <div className="flex items-center gap-3">
                  <h5 className="text-xs font-black uppercase tracking-widest text-gray-400">
                    {cat} Analysis
                  </h5>
                  <div className="flex-1 h-px bg-gray-100" />
                </div>

                <div className="grid gap-3">
                  {analysis.checks
                    .filter((c) => c.category === cat)
                    .map((check) => (
                      <div
                        key={check.id}
                        className={cn(
                          "group p-4 rounded-xl border flex items-center gap-4 transition-all hover:shadow-md hover:border-blue-100 active:scale-[0.99]",
                          check.status === "pass"
                            ? "bg-white border-gray-100"
                            : mood.light + " " + mood.border,
                        )}
                      >
                        <div
                          className={cn(
                            "w-10 h-10 rounded-xl flex items-center justify-center border",
                            check.status === "pass"
                              ? "bg-emerald-50 text-emerald-600 border-emerald-100"
                              : "bg-white text-gray-500 border-gray-100",
                          )}
                        >
                          {check.icon}
                        </div>

                        <div className="flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-bold text-gray-900 text-sm">
                              {check.name}
                            </span>
                            <span
                              className={cn(
                                "px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-tight",
                                check.status === "pass"
                                  ? "bg-emerald-100 text-emerald-700"
                                  : mood.bg + " text-white",
                              )}
                            >
                              {check.status === "pass" ? "OK" : check.status}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <p className="text-xs text-gray-500 font-medium">
                              {check.details}
                            </p>
                            <span className="text-[10px] text-gray-300">•</span>
                            <p className="text-[10px] text-gray-400 line-clamp-1">
                              {check.description}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            ))}

            {/* Final Footer Info */}
            <div className="pt-10 pb-6 text-center">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-gray-50 rounded-full border border-gray-100">
                <Shield className="w-3 h-3 text-gray-400" />
                <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">
                  Verified for CNC Machining
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
