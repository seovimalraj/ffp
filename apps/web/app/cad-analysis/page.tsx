"use client";

import { useState, useCallback, useMemo } from "react";
import {
  Upload,
  FileText,
  Activity,
  Ruler,
  Zap,
  Layers,
  Droplet,
  Box,
  Maximize2,
  CircleAlert,
  CheckCircle2,
  ChevronRight,
  ChevronDown,
  Trash2,
  Loader2,
  Cpu,
  Scissors,
  Hammer,
  Database,
  ArrowRight,
  Info,
} from "lucide-react";
import { useDropzone } from "react-dropzone";
import { motion, AnimatePresence } from "framer-motion";
import { CadViewer } from "@/components/cad/cad-viewer";
import { analyzeCADFile } from "@/lib/cad-analysis";
import { notify } from "@/lib/toast";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tool-tip";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { GeometryData } from "@/lib/cad-analysis";

interface AnalyzedFile {
  id: string;
  name: string;
  file: File | string;
  geometry: GeometryData;
  timestamp: number;
}

export default function CadAnalysisPage() {
  const [files, setFiles] = useState<AnalyzedFile[]>([]);
  const [selectedIndex, setSelectedIndex] = useState<number>(-1);
  const [isUploading, setIsUploading] = useState(false);

  const selectedFile = useMemo(
    () => (selectedIndex >= 0 ? files[selectedIndex] : null),
    [files, selectedIndex],
  );

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      if (acceptedFiles.length === 0) return;

      setIsUploading(true);
      const newAnalyzedFiles: AnalyzedFile[] = [];

      for (const file of acceptedFiles) {
        try {
          const geometry = await analyzeCADFile(file);
          newAnalyzedFiles.push({
            id: Math.random().toString(36).substring(7),
            name: file.name,
            file: file,
            geometry,
            timestamp: Date.now(),
          });
        } catch (error) {
          console.error(`Failed to analyze ${file.name}:`, error);
          notify.error(`Failed to analyze ${file.name}`);
        }
      }

      if (newAnalyzedFiles.length > 0) {
        setFiles((prev) => {
          const updated = [...prev, ...newAnalyzedFiles];
          if (selectedIndex === -1) setSelectedIndex(0);
          return updated;
        });
        notify.success(`Analyzed ${newAnalyzedFiles.length} file(s)`);
      }
      setIsUploading(false);
    },
    [selectedIndex],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "model/stl": [".stl"],
      "model/step": [".step", ".stp"],
      "application/octet-stream": [".stl", ".step", ".stp"],
      "application/iges": [".iges", ".igs"],
      "model/obj": [".obj"],
    },
    multiple: true,
  });

  const removeFile = (index: number) => {
    setFiles((prev) => {
      const updated = prev.filter((_, i) => i !== index);
      if (updated.length === 0) setSelectedIndex(-1);
      else if (selectedIndex >= updated.length)
        setSelectedIndex(updated.length - 1);
      return updated;
    });
  };

  return (
    <div className="flex h-screen w-full bg-[#f8fafc] overflow-hidden">
      {/* Sidebar - Left */}
      <div className="w-[400px] border-r border-slate-200 bg-white flex flex-col shadow-xl z-10 transition-all duration-500">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-200 ring-4 ring-blue-50">
              <Activity className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-black text-slate-900 leading-tight tracking-tight">
                CAD Analysis
              </h1>
              <p className="text-[10px] uppercase tracking-widest font-bold text-slate-400">
                Geometry Engine 2.0
              </p>
            </div>
          </div>
          {files.length > 0 && (
            <Badge
              variant="outline"
              className="bg-blue-50 text-blue-700 border-blue-100 px-2 py-0.5 rounded-full font-bold"
            >
              {files.length} Parts
            </Badge>
          )}
        </div>

        {/* Upload Area */}
        <div className="p-6">
          <div
            {...getRootProps()}
            className={cn(
              "relative group border-2 border-dashed rounded-2xl p-6 transition-all duration-300 cursor-pointer text-center",
              isDragActive
                ? "border-blue-500 bg-blue-50/50 scale-[0.98]"
                : "border-slate-200 hover:border-blue-400 hover:bg-slate-50/50",
            )}
          >
            <input {...getInputProps()} />
            <div className="flex flex-col items-center gap-3">
              <div
                className={cn(
                  "p-3 rounded-2xl transition-all duration-500",
                  isDragActive
                    ? "bg-blue-100 scale-110"
                    : "bg-slate-100 group-hover:bg-blue-50 group-hover:scale-110",
                )}
              >
                {isUploading ? (
                  <Loader2 className="h-6 w-6 text-blue-600 animate-spin" />
                ) : (
                  <Upload
                    className={cn(
                      "h-6 w-6 transition-colors",
                      isDragActive
                        ? "text-blue-600"
                        : "text-slate-400 group-hover:text-blue-500",
                    )}
                  />
                )}
              </div>
              <div>
                <p className="text-sm font-bold text-slate-900">
                  {isUploading ? "Analyzing..." : "Drop CAD files here"}
                </p>
                <p className="text-[11px] text-slate-400 font-medium mt-1">
                  STEP, STP, STL, IGES up to 50MB
                </p>
              </div>
            </div>

            {/* Animated particles background on hover - simplified CSS only */}
            <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none rounded-2xl overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_50%_50%,rgba(59,130,246,0.05)_0%,transparent_100%)]"></div>
            </div>
          </div>
        </div>

        <Separator className="bg-slate-50" />

        {/* File List */}
        <ScrollArea className="flex-1 px-4 py-4">
          <div className="space-y-3">
            <AnimatePresence initial={false}>
              {files.length === 0 ? (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex flex-col items-center justify-center py-12 px-6 text-center"
                >
                  <div className="h-16 w-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                    <Database className="h-8 w-8 text-slate-200" />
                  </div>
                  <p className="text-sm font-bold text-slate-400">
                    No files uploaded yet
                  </p>
                  <p className="text-xs text-slate-300 mt-1 italic">
                    Upload a file to start the geometry analysis workflow
                  </p>
                </motion.div>
              ) : (
                files.map((item, index) => (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.2 }}
                  >
                    <button
                      onClick={() => setSelectedIndex(index)}
                      className={cn(
                        "w-full text-left p-4 rounded-xl border transition-all duration-300 relative group overflow-hidden",
                        selectedIndex === index
                          ? "bg-slate-900 border-slate-900 shadow-lg shadow-slate-200 ring-4 ring-slate-50"
                          : "bg-white border-slate-100 hover:border-blue-200 hover:bg-slate-50/50",
                      )}
                    >
                      <div className="flex items-start gap-3 relative z-10">
                        <div
                          className={cn(
                            "h-10 w-10 rounded-lg flex items-center justify-center shrink-0 shadow-sm",
                            selectedIndex === index
                              ? "bg-white/10"
                              : "bg-slate-100",
                          )}
                        >
                          <Box
                            className={cn(
                              "h-5 w-5",
                              selectedIndex === index
                                ? "text-white"
                                : "text-slate-500",
                            )}
                          />
                        </div>
                        <div className="min-w-0 flex-1">
                          <h4
                            className={cn(
                              "text-sm font-bold truncate transition-colors",
                              selectedIndex === index
                                ? "text-white"
                                : "text-slate-900",
                            )}
                          >
                            {item.name}
                          </h4>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge
                              className={cn(
                                "text-[9px] font-black uppercase tracking-widest px-1.5 py-0 h-4 rounded",
                                selectedIndex === index
                                  ? "bg-blue-500/20 text-blue-200 border-none"
                                  : "bg-slate-100 text-slate-500 border-none",
                              )}
                            >
                              {item.geometry.recommendedProcess}
                            </Badge>
                            <span
                              className={cn(
                                "text-[10px] font-bold",
                                selectedIndex === index
                                  ? "text-white/40"
                                  : "text-slate-400",
                              )}
                            >
                              {item.geometry.volume.toFixed(0)} mm³
                            </span>
                          </div>
                        </div>
                        <div
                          onClick={(e) => {
                            e.stopPropagation();
                            removeFile(index);
                          }}
                          className={cn(
                            "opacity-0 group-hover:opacity-100 p-2 rounded-lg transition-all",
                            selectedIndex === index
                              ? "hover:bg-white/10 text-white"
                              : "hover:bg-red-50 text-slate-400 hover:text-red-500",
                          )}
                        >
                          <Trash2 className="h-4 w-4" />
                        </div>
                      </div>

                      {/* Active Indicator Bar */}
                      {selectedIndex === index && (
                        <motion.div
                          layoutId="active-bar"
                          className="absolute left-0 top-0 bottom-0 w-1 bg-blue-500"
                        />
                      )}
                    </button>
                  </motion.div>
                ))
              )}
            </AnimatePresence>
          </div>
        </ScrollArea>

        {/* Footer info */}
        <div className="p-6 bg-slate-50 border-t border-slate-100">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600">
              <CheckCircle2 className="h-4 w-4" />
            </div>
            <p className="text-[11px] font-medium text-slate-600 leading-tight">
              Verified Analysis Engine <br />
              <span className="text-slate-400 font-normal">
                Security End-to-End Encryption Enabled
              </span>
            </p>
          </div>
        </div>
      </div>

      {/* Main Content - Right */}
      <div className="flex-1 bg-white flex flex-col relative overflow-hidden">
        <AnimatePresence mode="wait">
          {selectedFile ? (
            <motion.div
              key={selectedFile.id}
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.02 }}
              transition={{ duration: 0.4, ease: [0.19, 1, 0.22, 1] }}
              className="flex flex-col h-full"
            >
              <div className="flex h-full">
                {/* 3D Viewport Column */}
                <div className="flex-1 relative bg-[#fcfdfe] flex flex-col border-r border-slate-100">
                  <div className="absolute top-6 left-6 z-10 flex flex-col gap-2">
                    <Badge
                      variant="secondary"
                      className="bg-white/80 backdrop-blur-md border border-slate-200/50 text-slate-900 font-black px-3 py-1.5 shadow-sm text-xs rounded-xl flex items-center gap-2"
                    >
                      <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                      Live Preview
                    </Badge>
                  </div>

                  <div className="absolute top-6 right-6 z-10">
                    <div className="flex items-center gap-2 bg-white/80 backdrop-blur-md border border-slate-200/50 p-1.5 rounded-2xl shadow-sm">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-9 w-9 rounded-xl hover:bg-slate-100 transition-colors"
                            >
                              <Maximize2 className="h-4 w-4 text-slate-600" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Fullscreen</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                      <Separator orientation="vertical" className="h-4" />
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-9 w-9 rounded-xl hover:bg-slate-100"
                            >
                              <Box className="h-4 w-4 text-slate-600" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>View Isometric</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                  </div>

                  {/* The 3D Component */}
                  <div className="flex-1 w-full bg-[#f8fafc]/50">
                    <CadViewer
                      file={selectedFile.file}
                      className="h-full w-full"
                      showControls={true}
                      zoom={0.9}
                      showViewCube={true}
                    />
                  </div>

                  {/* Quick Metrics Bar Under 3D */}
                  <div className="h-20 bg-white border-t border-slate-100 px-8 flex items-center justify-between">
                    <div className="flex items-center gap-10">
                      <MetricItem
                        icon={<Activity className="h-4 w-4 text-blue-500" />}
                        label="Complexity"
                        value={selectedFile.geometry.complexity}
                        status="info"
                      />
                      <MetricItem
                        icon={<Hammer className="h-4 w-4 text-amber-500" />}
                        label="Process"
                        value={selectedFile.geometry.recommendedProcess}
                        status="warning"
                      />
                      <MetricItem
                        icon={<Layers className="h-4 w-4 text-emerald-500" />}
                        label="Material Vol."
                        value={`${selectedFile.geometry.volume.toFixed(0)} mm³`}
                      />
                    </div>
                    <Button
                      variant="outline"
                      className="rounded-xl border-slate-200 font-bold gap-2"
                    >
                      <FileText className="h-4 w-4" />
                      Export Data
                    </Button>
                  </div>
                </div>

                {/* Analysis Details Panel */}
                <div className="w-[500px] border-l border-slate-100 bg-white flex flex-col shadow-[-20px_0_40px_rgba(0,0,0,0.02)]">
                  <div className="p-8 border-b border-slate-50">
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="text-2xl font-black text-slate-900 tracking-tight">
                        Geometry Details
                      </h2>
                      <Badge className="bg-emerald-50 text-emerald-700 border-emerald-100 font-black uppercase text-[10px]">
                        Analyzing{" "}
                        {selectedFile.name
                          .substring(selectedFile.name.lastIndexOf(".") + 1)
                          .toUpperCase()}
                      </Badge>
                    </div>
                    <p className="text-sm text-slate-500 leading-relaxed">
                      AI-driven geometry analysis results for the selected part.
                      Verified with our multi-tier processing cascade.
                    </p>
                  </div>

                  <Tabs
                    defaultValue="overview"
                    className="flex-1 flex flex-col"
                  >
                    <div className="px-8 bg-slate-50/50 border-b border-slate-100">
                      <TabsList className="bg-transparent h-14 w-full justify-start gap-6 p-0">
                        <TabsTrigger
                          value="overview"
                          className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-blue-600 data-[state=active]:border-b-2 data-[state=active]:border-blue-600 rounded-none h-full px-0 font-bold text-xs uppercase tracking-widest text-slate-400"
                        >
                          Overview
                        </TabsTrigger>
                        <TabsTrigger
                          value="features"
                          className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-blue-600 data-[state=active]:border-b-2 data-[state=active]:border-blue-600 rounded-none h-full px-0 font-bold text-xs uppercase tracking-widest text-slate-400"
                        >
                          Features
                        </TabsTrigger>
                        <TabsTrigger
                          value="dfm"
                          className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-blue-600 data-[state=active]:border-b-2 data-[state=active]:border-blue-600 rounded-none h-full px-0 font-bold text-xs uppercase tracking-widest text-slate-400"
                        >
                          DFM Review
                        </TabsTrigger>
                      </TabsList>
                    </div>

                    <ScrollArea className="flex-1">
                      <div className="p-8 pb-12">
                        <TabsContent
                          value="overview"
                          className="mt-0 space-y-8"
                        >
                          {/* Recommended Process Section */}
                          <section>
                            <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400 mb-4 flex items-center gap-2">
                              <Cpu className="h-3.5 w-3.5" />
                              Manufacturing Strategy
                            </h3>
                            <Card className="border-slate-100 overflow-hidden shadow-sm">
                              <div className="bg-gradient-to-r from-blue-600 to-blue-700 p-6 flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                  <div className="h-12 w-12 rounded-2xl bg-white/10 flex items-center justify-center backdrop-blur-md">
                                    <Zap className="h-6 w-6 text-white" />
                                  </div>
                                  <div>
                                    <h4 className="text-white font-black text-lg">
                                      {getProcessLabel(
                                        selectedFile.geometry
                                          .recommendedProcess,
                                      )}
                                    </h4>
                                    <p className="text-blue-100 text-xs font-bold uppercase tracking-wider">
                                      Recommended Process
                                    </p>
                                  </div>
                                </div>
                                <div className="text-right">
                                  <div className="text-white font-black text-xl">
                                    {(
                                      selectedFile.geometry.processConfidence *
                                      100
                                    ).toFixed(0)}
                                    %
                                  </div>
                                  <p className="text-blue-100 text-[10px] uppercase font-black">
                                    Confidence
                                  </p>
                                </div>
                              </div>
                              <div className="p-5 bg-white space-y-3">
                                <div className="flex items-start gap-3">
                                  <div className="mt-1 h-5 w-5 rounded-full bg-blue-50 flex items-center justify-center shrink-0">
                                    <Info className="h-3 w-3 text-blue-500" />
                                  </div>
                                  <p className="text-sm text-slate-700 font-medium leading-relaxed">
                                    {selectedFile.geometry.processReasoning ||
                                      "Based on the geometry profile, this part is optimized for CNC machining processes."}
                                  </p>
                                </div>
                              </div>
                            </Card>
                          </section>

                          {/* Dimensions Section */}
                          <section>
                            <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400 mb-4 flex items-center gap-2">
                              <Ruler className="h-3.5 w-3.5" />
                              Geometric Constraints
                            </h3>
                            <div className="grid grid-cols-2 gap-4">
                              <DataCard
                                label="Bounding Box (X,Y,Z)"
                                value={`${selectedFile.geometry.boundingBox.x.toFixed(1)} × ${selectedFile.geometry.boundingBox.y.toFixed(1)} × ${selectedFile.geometry.boundingBox.z.toFixed(1)}`}
                                subValue="Millimeters"
                              />
                              <DataCard
                                label="Surface Area"
                                value={`${selectedFile.geometry.surfaceArea.toFixed(0)}`}
                                subValue="Square Millimeters (mm²)"
                              />
                              <DataCard
                                label="Volume"
                                value={`${selectedFile.geometry.volume.toFixed(0)}`}
                                subValue="Cubic Millimeters (mm³)"
                              />
                              <DataCard
                                label="Material Weight"
                                value={`${selectedFile.geometry.materialWeight.toFixed(2)}`}
                                subValue="Grams (Base Material)"
                              />
                            </div>
                          </section>

                          {/* Part Characteristics */}
                          <section>
                            <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400 mb-4">
                              Core Characteristics
                            </h3>
                            <div className="flex flex-wrap gap-2">
                              {selectedFile.geometry.partCharacteristics
                                .isThinWalled && (
                                <CharBadge label="Thin Walled" />
                              )}
                              {selectedFile.geometry.partCharacteristics
                                .isRotationalSymmetric && (
                                <CharBadge label="Rotational Symmetric" />
                              )}
                              {selectedFile.geometry.partCharacteristics
                                .hasCurvedSurfaces && (
                                <CharBadge label="Curved Surfaces" />
                              )}
                              {selectedFile.geometry.partCharacteristics
                                .hasComplexFeatures && (
                                <CharBadge label="High Complexity" />
                              )}
                            </div>
                          </section>
                        </TabsContent>

                        <TabsContent
                          value="features"
                          className="mt-0 space-y-8"
                        >
                          {/* Holes & Pockets */}
                          <section>
                            <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400 mb-4">
                              Detected Features
                            </h3>
                            <div className="space-y-3">
                              <FeatureItem
                                icon={<CircleAlert className="h-4 w-4" />}
                                label="Holes Count"
                                value={
                                  selectedFile.geometry.advancedFeatures.holes
                                    .count
                                }
                                details={`${selectedFile.geometry.advancedFeatures.holes.throughHoles} Through, ${selectedFile.geometry.advancedFeatures.holes.blindHoles} Blind`}
                              />
                              <FeatureItem
                                icon={<Box className="h-4 w-4" />}
                                label="Pockets"
                                value={
                                  selectedFile.geometry.advancedFeatures.pockets
                                    .count
                                }
                                details={`Max aspect ratio: ${selectedFile.geometry.advancedFeatures.pockets.maxAspectRatio.toFixed(1)}`}
                              />
                              <FeatureItem
                                icon={<Scissors className="h-4 w-4" />}
                                label="Threads"
                                value={
                                  selectedFile.geometry.advancedFeatures.threads
                                    .count
                                }
                                details={`${selectedFile.geometry.advancedFeatures.threads.internalThreads} Internal, ${selectedFile.geometry.advancedFeatures.threads.externalThreads} External`}
                              />
                              <FeatureItem
                                icon={<Droplet className="h-4 w-4" />}
                                label="Fillets & Chamfers"
                                value={
                                  selectedFile.geometry.advancedFeatures.fillets
                                    .count +
                                  selectedFile.geometry.advancedFeatures
                                    .chamfers.count
                                }
                                details={`Avg Radius: ${selectedFile.geometry.advancedFeatures.fillets.avgRadius.toFixed(2)}mm`}
                              />
                            </div>
                          </section>

                          {/* Machine Requirements */}
                          <section>
                            <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400 mb-4">
                              Tooling Insights
                            </h3>
                            <Card className="border-slate-100 shadow-sm p-6 space-y-6">
                              <div className="flex items-center justify-between">
                                <span className="text-sm font-bold text-slate-600">
                                  Setup Efficiency
                                </span>
                                <span className="text-sm font-black text-slate-900">
                                  {
                                    selectedFile.geometry.advancedFeatures
                                      .toolAccess.estimatedSetupCount
                                  }{" "}
                                  Estimated Setups
                                </span>
                              </div>
                              <Separator className="bg-slate-50" />
                              <div className="grid grid-cols-3 gap-2">
                                <SetupBox
                                  label="3-Axis"
                                  value={
                                    selectedFile.geometry.advancedFeatures
                                      .toolAccess.axisCounts["3-axis"]
                                  }
                                  active={
                                    selectedFile.geometry.advancedFeatures
                                      .toolAccess.axisCounts["3-axis"] > 0
                                  }
                                />
                                <SetupBox
                                  label="4-Axis"
                                  value={
                                    selectedFile.geometry.advancedFeatures
                                      .toolAccess.axisCounts["4-axis"]
                                  }
                                  active={
                                    selectedFile.geometry.advancedFeatures
                                      .toolAccess.axisCounts["4-axis"] > 0
                                  }
                                />
                                <SetupBox
                                  label="5-Axis"
                                  value={
                                    selectedFile.geometry.advancedFeatures
                                      .toolAccess.axisCounts["5-axis"]
                                  }
                                  active={
                                    selectedFile.geometry.advancedFeatures
                                      .toolAccess.axisCounts["5-axis"] > 0
                                  }
                                />
                              </div>
                              <div className="bg-slate-50 rounded-xl p-4 mt-4">
                                <p className="text-[10px] text-slate-500 italic leading-relaxed">
                                  Note: Setup counts are estimates based on tool
                                  access geometry. Final setup strategy may vary
                                  by machine configuration.
                                </p>
                              </div>
                            </Card>
                          </section>
                        </TabsContent>

                        <TabsContent value="dfm" className="mt-0 space-y-6">
                          <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400 mb-4">
                            Design For Manufacturing
                          </h3>

                          {selectedFile.geometry.dfmIssues.length > 0 ? (
                            <div className="space-y-4">
                              {selectedFile.geometry.dfmIssues.map(
                                (issue, i) => (
                                  <motion.div
                                    key={i}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: i * 0.1 }}
                                  >
                                    <Card
                                      className={cn(
                                        "overflow-hidden border shadow-sm",
                                        issue.severity === "critical"
                                          ? "border-red-100"
                                          : issue.severity === "warning"
                                            ? "border-amber-100"
                                            : "border-blue-100",
                                      )}
                                    >
                                      <div
                                        className={cn(
                                          "px-4 py-2 flex items-center justify-between",
                                          issue.severity === "critical"
                                            ? "bg-red-50"
                                            : issue.severity === "warning"
                                              ? "bg-amber-50"
                                              : "bg-blue-50",
                                        )}
                                      >
                                        <div className="flex items-center gap-2">
                                          {issue.severity === "critical" ? (
                                            <CircleAlert className="h-4 w-4 text-red-600" />
                                          ) : (
                                            <Info className="h-4 w-4 text-amber-600" />
                                          )}
                                          <span
                                            className={cn(
                                              "text-[10px] font-black uppercase tracking-widest",
                                              issue.severity === "critical"
                                                ? "text-red-700"
                                                : issue.severity === "warning"
                                                  ? "text-amber-700"
                                                  : "text-blue-700",
                                            )}
                                          >
                                            {issue.severity} Issue
                                          </span>
                                        </div>
                                      </div>
                                      <div className="p-4">
                                        <h4 className="text-sm font-black text-slate-900 mb-1">
                                          {issue.issue}
                                        </h4>
                                        <p className="text-xs text-slate-600 mb-3">
                                          {issue.recommendation}
                                        </p>
                                        {issue.potentialSavings && (
                                          <Badge
                                            variant="outline"
                                            className="bg-emerald-50 border-emerald-200 text-emerald-700 font-bold"
                                          >
                                            Potential Save: $
                                            {issue.potentialSavings}
                                          </Badge>
                                        )}
                                      </div>
                                    </Card>
                                  </motion.div>
                                ),
                              )}
                            </div>
                          ) : (
                            <div className="flex flex-col items-center justify-center py-12 px-8 bg-emerald-50 rounded-3xl border border-emerald-100 text-center">
                              <div className="h-12 w-12 rounded-full bg-white flex items-center justify-center mb-4 shadow-sm">
                                <CheckCircle2 className="h-6 w-6 text-emerald-500" />
                              </div>
                              <h4 className="text-emerald-900 font-black mb-1">
                                Perfect Score!
                              </h4>
                              <p className="text-emerald-700 text-sm font-medium">
                                No major DFM issues detected. Part is optimized
                                for production.
                              </p>
                            </div>
                          )}
                        </TabsContent>
                      </div>
                    </ScrollArea>
                  </Tabs>
                </div>
              </div>
            </motion.div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center bg-[#fcfdfe] p-12 text-center">
              <div className="max-w-md w-full relative">
                {/* Decorative background elements */}
                <div className="absolute -top-24 -left-24 w-64 h-64 bg-blue-100/50 rounded-full blur-3xl opacity-50" />
                <div className="absolute -bottom-24 -right-24 w-64 h-64 bg-purple-100/50 rounded-full blur-3xl opacity-50" />

                <div className="relative z-10 space-y-8">
                  <div className="h-24 w-24 bg-white rounded-3xl shadow-2xl flex items-center justify-center mx-auto ring-1 ring-slate-100">
                    <motion.div
                      animate={{
                        rotateY: [0, 180, 360],
                        scale: [1, 1.1, 1],
                      }}
                      transition={{
                        duration: 4,
                        repeat: Infinity,
                        ease: "easeInOut",
                      }}
                    >
                      <Box className="h-12 w-12 text-blue-600" />
                    </motion.div>
                  </div>

                  <div>
                    <h2 className="text-3xl font-black text-slate-900 tracking-tight mb-4">
                      Select a Part to Analyze
                    </h2>
                    <p className="text-slate-500 font-medium leading-relaxed">
                      Upload your CAD files to our advanced geometry engine.
                      We'll automatically extract features, detect DFM issues,
                      and recommend the best manufacturing process.
                    </p>
                  </div>

                  <div className="flex flex-col gap-4 mt-8">
                    <Button
                      {...getRootProps()}
                      className="h-14 rounded-2xl bg-slate-900 text-white hover:bg-slate-800 shadow-xl shadow-slate-200 transition-all font-black gap-3 text-lg"
                    >
                      <Upload className="h-5 w-5" />
                      Upload Your First File
                    </Button>
                    <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest">
                      Supports STEP • STP • STL • IGES
                    </p>
                  </div>

                  <div className="grid grid-cols-3 gap-6 pt-12">
                    <FeatureHighlight
                      icon={<Activity />}
                      label="Geometric Insight"
                    />
                    <FeatureHighlight icon={<Cpu />} label="AI Processing" />
                    <FeatureHighlight
                      icon={<Maximize2 />}
                      label="3D Evaluation"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// Helper Components
function MetricItem({ icon, label, value, status = "default" }: any) {
  return (
    <div className="flex items-center gap-3">
      <div
        className={cn(
          "h-9 w-9 rounded-xl flex items-center justify-center",
          status === "info"
            ? "bg-blue-50"
            : status === "warning"
              ? "bg-amber-50"
              : "bg-slate-50",
        )}
      >
        {icon}
      </div>
      <div>
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">
          {label}
        </p>
        <p className="text-sm font-black text-slate-900 leading-none capitalize">
          {value}
        </p>
      </div>
    </div>
  );
}

function DataCard({ label, value, subValue }: any) {
  return (
    <div className="p-5 rounded-2xl border border-slate-100 bg-white shadow-sm hover:shadow-md transition-shadow group">
      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 group-hover:text-blue-500 transition-colors">
        {label}
      </p>
      <p className="text-lg font-black text-slate-900">{value}</p>
      <p className="text-[10px] font-bold text-slate-400 mt-1">{subValue}</p>
    </div>
  );
}

function FeatureItem({ icon, label, value, details }: any) {
  return (
    <div className="flex items-center gap-4 p-4 rounded-2xl bg-white border border-slate-100 shadow-sm group hover:border-blue-200 transition-all">
      <div className="h-10 w-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-blue-50 group-hover:text-blue-600 transition-colors">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-0.5">
          <p className="text-xs font-black text-slate-900 uppercase tracking-wide">
            {label}
          </p>
          <span className="text-sm font-black text-blue-600">{value}</span>
        </div>
        <p className="text-[10px] font-bold text-slate-500 truncate">
          {details}
        </p>
      </div>
    </div>
  );
}

function CharBadge({ label }: any) {
  return (
    <Badge className="bg-slate-50 text-slate-600 border-slate-100 hover:bg-slate-100 px-3 py-1 font-bold text-[10px] rounded-lg tracking-wide">
      {label}
    </Badge>
  );
}

function SetupBox({ label, value, active }: any) {
  return (
    <div
      className={cn(
        "p-3 rounded-xl border text-center transition-all",
        active
          ? "bg-blue-50 border-blue-200"
          : "bg-slate-50/50 border-slate-100 opacity-40",
      )}
    >
      <p
        className={cn(
          "text-[9px] font-black uppercase mb-1",
          active ? "text-blue-700" : "text-slate-400",
        )}
      >
        {label}
      </p>
      <p
        className={cn(
          "text-lg font-black",
          active ? "text-blue-900" : "text-slate-500",
        )}
      >
        {value}
      </p>
    </div>
  );
}

function FeatureHighlight({ icon, label }: any) {
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="h-10 w-10 rounded-2xl bg-white shadow-lg flex items-center justify-center text-slate-400 border border-slate-100 mb-1">
        {icon}
      </div>
      <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">
        {label}
      </span>
    </div>
  );
}

function getProcessLabel(process: string) {
  const map: Record<string, string> = {
    "cnc-milling": "CNC Milling",
    "cnc-turning": "CNC Turning",
    "sheet-metal": "Sheet Metal",
    "injection-molding": "Injection Molding",
    "manual-quote": "Manual Review Required",
  };
  return map[process] || process;
}
