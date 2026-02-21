"use client";

import { useState, useCallback, useMemo } from "react";
import { useFileUpload } from "@/lib/hooks/use-file-upload";
import {
  Upload,
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
  Trash2,
  Loader2,
  Cpu,
  Scissors,
  Hammer,
  Database,
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
  const [analysisStage, setAnalysisStage] = useState<string>("");
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isDetailsOpen, setIsDetailsOpen] = useState(true);

  const { upload } = useFileUpload();

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
          // Step 1: Upload the file to get a stable URL for backend analysis
          let uploadedPath = `temp/${file.name}`;
          setAnalysisStage(`Uploading ${file.name}…`);
          try {
            const { url } = await upload(file);
            uploadedPath = url;
          } catch (uploadError) {
            console.error("File upload failed:", uploadError);
            notify.error(`Failed to upload ${file.name}`);
          }

          // Step 2: Choose analysis — backend for STEP/IGES/DXF, client-side otherwise
          const extension = file.name.toLowerCase().split(".").pop();
          const useBackendAnalysis = ["step", "stp", "iges", "igs", "dxf", "stl"].includes(
            extension || "",
          );

          let geometry: GeometryData | undefined;

          if (useBackendAnalysis && uploadedPath) {
            setAnalysisStage(`Analyzing ${file.name} (backend)…`);
            try {
              const analysisResponse = await fetch(
                "/api/cad/analyze-geometry",
                {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    fileUrl: uploadedPath,
                    fileName: file.name,
                  }),
                },
              );

              if (analysisResponse.ok) {
                geometry = await analysisResponse.json();
              } else {
                setAnalysisStage(`Analyzing ${file.name} (client fallback)…`);
                geometry = await analyzeCADFile(file);
              }
            } catch {
              setAnalysisStage(`Analyzing ${file.name} (client fallback)…`);
              geometry = await analyzeCADFile(file);
            }
          } else {
            setAnalysisStage(`Analyzing ${file.name}…`);
            geometry = await analyzeCADFile(file);
          }

          if (!geometry) {
            notify.error(`Analysis failed for ${file.name}`);
            continue;
          }

          // Propagate assembly detection
          if (
            geometry.isAssembly &&
            geometry.recommendedProcess !== "manual-quote"
          ) {
            geometry.recommendedProcess = "manual-quote";
            geometry.requiresManualQuote = true;
            geometry.manualQuoteReason =
              geometry.manualQuoteReason ||
              "Assembly detected — multiple bodies require manual review";
          }

          newAnalyzedFiles.push({
            id: Math.random().toString(36).substring(7),
            name: file.name,
            file: uploadedPath,
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
      setAnalysisStage("");
    },
    [selectedIndex, upload],
  );

  const removeFile = (index: number) => {
    setFiles((prev) => {
      const updated = prev.filter((_, i) => i !== index);
      if (selectedIndex === index)
        setSelectedIndex(updated.length > 0 ? 0 : -1);
      else if (selectedIndex > index) setSelectedIndex(selectedIndex - 1);
      else if (selectedIndex >= updated.length)
        setSelectedIndex(updated.length - 1);
      return updated;
    });
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "model/stl": [".stl"],
      "model/step": [".step", ".stp"],
      "application/octet-stream": [".stl", ".step", ".stp"],
      "application/sla": [".stl"],
      "application/iges": [".iges", ".igs"],
      "image/vnd.dxf": [".dxf"],
      "model/obj": [".obj"],
    },
    multiple: true,
  });

  return (
    <div className="flex h-screen w-full bg-[#f8fafc] overflow-hidden">
      {/* ── Collapsible Left Sidebar ── */}
      <motion.div
        initial={false}
        animate={{
          width: isSidebarOpen ? 320 : 0,
          opacity: isSidebarOpen ? 1 : 0,
        }}
        transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
        className="border-r border-slate-200 bg-white flex flex-col shadow-xl z-20 overflow-hidden shrink-0"
      >
        {/* Header */}
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-200 ring-4 ring-blue-50">
              <Activity className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-black text-slate-900 leading-tight tracking-tight">
                CAD Analysis
              </h1>
              <p className="text-[10px] uppercase tracking-widest font-bold text-slate-400">
                Geometry Engine 2.0
              </p>
            </div>
          </div>
          {files.length > 0 && (
            <Badge className="bg-blue-50 text-blue-700 border-blue-100 px-2 py-0.5 rounded-full font-bold text-xs">
              {files.length}
            </Badge>
          )}
        </div>

        {/* Upload dropzone */}
        <div className="p-4">
          <div
            {...getRootProps()}
            className={cn(
              "group border-2 border-dashed rounded-2xl p-5 cursor-pointer text-center transition-all duration-300",
              isDragActive
                ? "border-blue-500 bg-blue-50/50 scale-[0.98]"
                : "border-slate-200 hover:border-blue-300 hover:bg-slate-50/50",
            )}
          >
            <input {...getInputProps()} />
            <div className="flex flex-col items-center gap-2">
              <div
                className={cn(
                  "p-2.5 rounded-xl transition-all duration-300",
                  isDragActive
                    ? "bg-blue-100 scale-110"
                    : "bg-slate-100 group-hover:bg-blue-50 group-hover:scale-110",
                )}
              >
                {isUploading ? (
                  <Loader2 className="h-5 w-5 text-blue-600 animate-spin" />
                ) : (
                  <Upload
                    className={cn(
                      "h-5 w-5 transition-colors",
                      isDragActive
                        ? "text-blue-600"
                        : "text-slate-400 group-hover:text-blue-500",
                    )}
                  />
                )}
              </div>
              <div>
                <p className="text-sm font-bold text-slate-800">
                  {isUploading ? "Processing…" : "Drop CAD files here"}
                </p>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  STEP · STL · IGES · DXF
                </p>
              </div>
            </div>
          </div>
        </div>

        <Separator className="bg-slate-50" />

        {/* File list */}
        <ScrollArea className="flex-1 px-3 py-3">
          <div className="space-y-2">
            <AnimatePresence initial={false}>
              {files.length === 0 ? (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex flex-col items-center justify-center py-12 px-4 text-center"
                >
                  <div className="h-14 w-14 bg-slate-50 rounded-full flex items-center justify-center mb-3">
                    <Database className="h-7 w-7 text-slate-200" />
                  </div>
                  <p className="text-sm font-bold text-slate-300">
                    No files yet
                  </p>
                  <p className="text-xs text-slate-300 mt-1 italic">
                    Upload a file to begin analysis
                  </p>
                </motion.div>
              ) : (
                files.map((item, index) => (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, x: -16 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.2 }}
                  >
                    <button
                      onClick={() => setSelectedIndex(index)}
                      className={cn(
                        "w-full text-left p-3 rounded-xl border transition-all duration-200 relative group overflow-hidden",
                        selectedIndex === index
                          ? "bg-slate-900 border-slate-900 shadow-lg ring-4 ring-slate-50"
                          : "bg-white border-slate-100 hover:border-blue-200 hover:bg-slate-50/50",
                      )}
                    >
                      {selectedIndex === index && (
                        <motion.div
                          layoutId="active-bar"
                          className="absolute left-0 top-0 bottom-0 w-1 bg-blue-500 rounded-r"
                        />
                      )}
                      <div className="flex items-start gap-2.5 relative z-10">
                        <div
                          className={cn(
                            "h-8 w-8 rounded-lg flex items-center justify-center shrink-0",
                            selectedIndex === index
                              ? "bg-white/10"
                              : "bg-slate-100",
                          )}
                        >
                          <Box
                            className={cn(
                              "h-4 w-4",
                              selectedIndex === index
                                ? "text-white"
                                : "text-slate-500",
                            )}
                          />
                        </div>
                        <div className="min-w-0 flex-1">
                          <h4
                            className={cn(
                              "text-xs font-bold truncate",
                              selectedIndex === index
                                ? "text-white"
                                : "text-slate-900",
                            )}
                          >
                            {item.name}
                          </h4>
                          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                            <Badge
                              className={cn(
                                "text-[8px] font-black uppercase px-1 py-0 h-3.5 rounded border-none",
                                selectedIndex === index
                                  ? "bg-blue-500/20 text-blue-200"
                                  : "bg-slate-100 text-slate-500",
                              )}
                            >
                              {item.geometry.recommendedProcess?.replace(
                                "cnc-",
                                "",
                              )}
                            </Badge>
                            <span
                              className={cn(
                                "text-[9px] font-medium",
                                selectedIndex === index
                                  ? "text-white/40"
                                  : "text-slate-400",
                              )}
                            >
                              {item.geometry.boundingBox.x.toFixed(0)}×
                              {item.geometry.boundingBox.y.toFixed(0)}×
                              {item.geometry.boundingBox.z.toFixed(0)}mm
                            </span>
                          </div>
                        </div>
                        <div
                          onClick={(e) => {
                            e.stopPropagation();
                            removeFile(index);
                          }}
                          className={cn(
                            "opacity-0 group-hover:opacity-100 p-1 rounded-lg transition-all",
                            selectedIndex === index
                              ? "hover:bg-white/10 text-white"
                              : "hover:bg-red-50 text-slate-400 hover:text-red-500",
                          )}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </div>
                      </div>
                    </button>
                  </motion.div>
                ))
              )}
            </AnimatePresence>
          </div>
        </ScrollArea>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-100">
          <div className="flex items-center gap-3">
            <div className="h-7 w-7 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600">
              <CheckCircle2 className="h-3.5 w-3.5" />
            </div>
            <p className="text-[10px] font-medium text-slate-600 leading-tight">
              Multi-tier analysis active
              <br />
              <span className="text-slate-400 font-normal">
                Backend + client cascade
              </span>
            </p>
          </div>
        </div>
      </motion.div>

      {/* ── Main Content Area ── */}
      <div className="flex-1 flex flex-col bg-white overflow-hidden">
        {/* Top Navigation Bar */}
        <header className="h-14 border-b border-slate-100 bg-white/80 backdrop-blur-md flex items-center justify-between px-5 z-10 shrink-0">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-xl hover:bg-slate-100"
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            >
              <ChevronRight
                className={cn(
                  "h-4 w-4 text-slate-500 transition-transform duration-300",
                  isSidebarOpen ? "rotate-180" : "",
                )}
              />
            </Button>
            <div className="h-4 w-px bg-slate-200" />
            {selectedFile ? (
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-slate-900 truncate max-w-[200px]">
                  {selectedFile.name}
                </span>
                <Badge className="bg-slate-100 text-slate-600 border-none text-[10px] font-bold capitalize">
                  {selectedFile.geometry.recommendedProcess}
                </Badge>
                {(selectedFile.geometry as any).thicknessDetectionMethod ===
                  "backend_analysis" && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Badge className="bg-blue-50 text-blue-600 border-blue-100 px-1.5 py-0 h-4 flex items-center gap-1 cursor-default">
                          <Zap className="h-2.5 w-2.5 fill-current" />
                          <span className="text-[9px] font-black uppercase">
                            Advanced
                          </span>
                        </Badge>
                      </TooltipTrigger>
                      <TooltipContent>
                        Backend ray-casting analysis
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
              </div>
            ) : (
              <span className="text-sm font-medium text-slate-400 italic">
                No part selected
              </span>
            )}
          </div>

          <div className="flex items-center gap-3">
            {isUploading && (
              <div className="flex items-center gap-2.5 bg-blue-50 px-3 py-1.5 rounded-full border border-blue-100">
                <Loader2 className="h-3.5 w-3.5 text-blue-600 animate-spin" />
                <span className="text-[10px] font-bold text-blue-600 truncate max-w-[180px]">
                  {analysisStage || "Processing…"}
                </span>
              </div>
            )}
            <div className="h-4 w-px bg-slate-200" />
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-xl hover:bg-slate-100"
              onClick={() => setIsDetailsOpen(!isDetailsOpen)}
            >
              <ChevronRight
                className={cn(
                  "h-4 w-4 text-slate-500 transition-transform duration-300",
                  isDetailsOpen ? "" : "rotate-180",
                )}
              />
            </Button>
          </div>
        </header>

        {/* Content: 3D Viewer + Details Panel */}
        <div className="flex-1 flex overflow-hidden">
          <AnimatePresence mode="wait">
            {selectedFile ? (
              <motion.div
                key={selectedFile.id}
                initial={{ opacity: 0, scale: 0.99 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
                className="flex flex-1 overflow-hidden"
              >
                {/* 3D Viewport */}
                <div className="flex-1 relative bg-slate-50/30 flex flex-col group/canvas">
                  {/* Live badge */}
                  <div className="absolute top-5 left-5 z-10">
                    <Badge className="bg-white text-slate-900 border-slate-200/60 font-black px-3 py-1.5 shadow-sm text-[10px] uppercase rounded-xl flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                      Live Preview
                    </Badge>
                  </div>

                  {/* Viewport controls */}
                  <div className="absolute top-5 right-5 z-10 opacity-50 group-hover/canvas:opacity-100 transition-opacity duration-300">
                    <div className="flex items-center gap-1 bg-white/80 backdrop-blur-md border border-slate-200/50 p-1 rounded-2xl shadow-sm">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 rounded-xl hover:bg-slate-100"
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
                              className="h-8 w-8 rounded-xl hover:bg-slate-100"
                            >
                              <Box className="h-4 w-4 text-slate-600" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Reset View</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                  </div>

                  {/* The 3D viewer */}
                  <div className="flex-1 w-full bg-[radial-gradient(circle_at_50%_50%,#ffffff_0%,#f1f5f9_100%)]">
                    <CadViewer
                      file={selectedFile.file}
                      className="h-full w-full"
                      showControls={true}
                      zoom={0.9}
                      showViewCube={true}
                    />
                  </div>

                  {/* Quick metrics bar */}
                  <div className="h-14 bg-white/70 backdrop-blur-sm border-t border-slate-100 px-6 flex items-center gap-8 shrink-0">
                    <MetricItem
                      icon={<Activity className="h-3.5 w-3.5 text-blue-500" />}
                      label="Complexity"
                      value={selectedFile.geometry.complexity}
                      status="info"
                    />
                    <div className="h-6 w-px bg-slate-100" />
                    <MetricItem
                      icon={<Hammer className="h-3.5 w-3.5 text-amber-500" />}
                      label="Process"
                      value={getProcessLabel(
                        selectedFile.geometry.recommendedProcess,
                      )}
                      status="warning"
                    />
                    <div className="h-6 w-px bg-slate-100" />
                    <MetricItem
                      icon={<Layers className="h-3.5 w-3.5 text-emerald-500" />}
                      label="Volume"
                      value={`${selectedFile.geometry.volume.toFixed(0)} mm³`}
                    />
                  </div>
                </div>

                {/* Analysis Details Panel */}
                <motion.div
                  initial={false}
                  animate={{
                    width: isDetailsOpen ? 440 : 0,
                    opacity: isDetailsOpen ? 1 : 0,
                  }}
                  transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
                  className="border-l border-slate-100 bg-white flex flex-col shadow-[-20px_0_40px_rgba(0,0,0,0.02)] overflow-hidden shrink-0"
                >
                  {/* Panel header */}
                  <div className="px-7 py-5 border-b border-slate-50 shrink-0">
                    <div className="flex items-center justify-between">
                      <h2 className="text-base font-black text-slate-900 tracking-tight">
                        Geometry Details
                      </h2>
                      <Badge className="bg-slate-100 text-slate-600 border-none font-bold uppercase text-[9px] px-2 py-0.5">
                        {(selectedFile.geometry as any).classificationMethod ||
                          "cascade"}
                      </Badge>
                    </div>
                    <p className="text-[10px] text-slate-400 font-medium uppercase tracking-widest mt-1">
                      Verified extraction complete
                    </p>
                  </div>

                  {/* Tabs */}
                  <Tabs
                    defaultValue="overview"
                    className="flex-1 flex flex-col min-h-0"
                  >
                    <div className="px-7 bg-slate-50/50 border-b border-slate-100 shrink-0">
                      <TabsList className="bg-transparent h-12 w-full justify-start gap-5 p-0">
                        {["overview", "features", "dfm"].map((tab) => (
                          <TabsTrigger
                            key={tab}
                            value={tab}
                            className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-blue-600 data-[state=active]:border-b-2 data-[state=active]:border-blue-600 rounded-none h-full px-0 font-bold text-[11px] uppercase tracking-widest text-slate-400"
                          >
                            {tab === "dfm"
                              ? "DFM Review"
                              : tab.charAt(0).toUpperCase() + tab.slice(1)}
                          </TabsTrigger>
                        ))}
                      </TabsList>
                    </div>

                    <ScrollArea className="flex-1">
                      <div className="px-7 py-6 pb-12 space-y-8">
                        {/* ── OVERVIEW TAB ── */}
                        <TabsContent
                          value="overview"
                          className="mt-0 space-y-7"
                        >
                          {/* Recommended Process */}
                          <section>
                            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-3 flex items-center gap-1.5">
                              <Cpu className="h-3 w-3" /> Manufacturing Strategy
                            </h3>
                            <Card className="border-slate-100 overflow-hidden shadow-sm">
                              <div className="bg-gradient-to-br from-blue-600 to-blue-700 px-5 py-4 flex items-center justify-between">
                                <div className="flex items-center gap-3.5">
                                  <div className="h-10 w-10 rounded-xl bg-white/10 flex items-center justify-center">
                                    <Zap className="h-5 w-5 text-white" />
                                  </div>
                                  <div>
                                    <h4 className="text-white font-black text-sm leading-tight">
                                      {getProcessLabel(
                                        selectedFile.geometry
                                          .recommendedProcess,
                                      )}
                                    </h4>
                                    <p className="text-blue-200 text-[10px] font-bold uppercase tracking-wider mt-0.5">
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
                                  <p className="text-blue-200 text-[10px] uppercase font-black">
                                    Confidence
                                  </p>
                                </div>
                              </div>
                              {selectedFile.geometry.processReasoning && (
                                <div className="px-5 py-3 bg-white">
                                  <div className="flex items-start gap-2">
                                    <Info className="h-3.5 w-3.5 text-blue-400 mt-0.5 shrink-0" />
                                    <p className="text-xs text-slate-600 leading-relaxed">
                                      {selectedFile.geometry.processReasoning}
                                    </p>
                                  </div>
                                </div>
                              )}
                            </Card>
                          </section>

                          {/* Dimensions */}
                          <section>
                            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-3 flex items-center gap-1.5">
                              <Ruler className="h-3 w-3" /> Geometry
                            </h3>
                            <div className="grid grid-cols-2 gap-3">
                              <DataCard
                                label="Bounding Box"
                                value={`${selectedFile.geometry.boundingBox.x.toFixed(1)} × ${selectedFile.geometry.boundingBox.y.toFixed(1)} × ${selectedFile.geometry.boundingBox.z.toFixed(1)}`}
                                subValue="mm (X × Y × Z)"
                              />
                              <DataCard
                                label="Surface Area"
                                value={`${selectedFile.geometry.surfaceArea.toFixed(0)}`}
                                subValue="mm²"
                              />
                              <DataCard
                                label="Volume"
                                value={`${selectedFile.geometry.volume.toFixed(0)}`}
                                subValue="mm³"
                              />
                              <DataCard
                                label="Material Weight"
                                value={`${selectedFile.geometry.materialWeight.toFixed(2)}`}
                                subValue="grams (base material)"
                              />
                            </div>
                          </section>

                          {/* Characteristics */}
                          {selectedFile.geometry.partCharacteristics && (
                            <section>
                              <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-3">
                                Characteristics
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
                          )}
                        </TabsContent>

                        {/* ── FEATURES TAB ── */}
                        <TabsContent
                          value="features"
                          className="mt-0 space-y-7"
                        >
                          <section>
                            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-3">
                              Detected Features
                            </h3>
                            <div className="space-y-2.5">
                              <FeatureItem
                                icon={<CircleAlert className="h-4 w-4" />}
                                label="Holes"
                                value={
                                  selectedFile.geometry.advancedFeatures.holes
                                    .count
                                }
                                details={`${selectedFile.geometry.advancedFeatures.holes.throughHoles} Through · ${selectedFile.geometry.advancedFeatures.holes.blindHoles} Blind`}
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
                                details={`${selectedFile.geometry.advancedFeatures.threads.internalThreads} Internal · ${selectedFile.geometry.advancedFeatures.threads.externalThreads} External`}
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
                                details={`Avg radius: ${selectedFile.geometry.advancedFeatures.fillets.avgRadius.toFixed(2)}mm`}
                              />
                            </div>
                          </section>

                          <section>
                            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-3">
                              Tooling Insights
                            </h3>
                            <Card className="border-slate-100 shadow-sm p-5 space-y-4">
                              <div className="flex items-center justify-between">
                                <span className="text-sm font-bold text-slate-600">
                                  Setup Count
                                </span>
                                <span className="text-sm font-black text-slate-900">
                                  {
                                    selectedFile.geometry.advancedFeatures
                                      .toolAccess.estimatedSetupCount
                                  }{" "}
                                  setups
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
                              <p className="text-[10px] text-slate-400 italic leading-relaxed">
                                Setup counts are estimates based on tool access
                                geometry. Final strategy may vary.
                              </p>
                            </Card>
                          </section>
                        </TabsContent>

                        {/* ── DFM TAB ── */}
                        <TabsContent value="dfm" className="mt-0 space-y-4">
                          <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                            Design For Manufacturing
                          </h3>
                          {selectedFile.geometry.dfmIssues.length > 0 ? (
                            <div className="space-y-3">
                              {selectedFile.geometry.dfmIssues.map(
                                (issue, i) => (
                                  <motion.div
                                    key={i}
                                    initial={{ opacity: 0, y: 8 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: i * 0.08 }}
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
                                          "px-4 py-2 flex items-center gap-2",
                                          issue.severity === "critical"
                                            ? "bg-red-50"
                                            : issue.severity === "warning"
                                              ? "bg-amber-50"
                                              : "bg-blue-50",
                                        )}
                                      >
                                        {issue.severity === "critical" ? (
                                          <CircleAlert className="h-3.5 w-3.5 text-red-600" />
                                        ) : (
                                          <Info className="h-3.5 w-3.5 text-amber-600" />
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
                                      <div className="p-4">
                                        <h4 className="text-sm font-black text-slate-900 mb-1">
                                          {issue.issue}
                                        </h4>
                                        <p className="text-xs text-slate-600 mb-3 leading-relaxed">
                                          {issue.recommendation}
                                        </p>
                                        {issue.potentialSavings && (
                                          <Badge
                                            variant="outline"
                                            className="bg-emerald-50 border-emerald-200 text-emerald-700 font-bold text-xs"
                                          >
                                            Save: ${issue.potentialSavings}
                                          </Badge>
                                        )}
                                      </div>
                                    </Card>
                                  </motion.div>
                                ),
                              )}
                            </div>
                          ) : (
                            <div className="flex flex-col items-center justify-center py-10 px-6 bg-emerald-50 rounded-3xl border border-emerald-100 text-center">
                              <div className="h-11 w-11 rounded-full bg-white flex items-center justify-center mb-3 shadow-sm">
                                <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                              </div>
                              <h4 className="text-emerald-900 font-black mb-1 text-sm">
                                Perfect Score!
                              </h4>
                              <p className="text-emerald-700 text-xs font-medium">
                                No DFM issues detected. Part is optimized for
                                production.
                              </p>
                            </div>
                          )}
                        </TabsContent>
                      </div>
                    </ScrollArea>
                  </Tabs>
                </motion.div>
              </motion.div>
            ) : (
              /* Empty state */
              <motion.div
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex-1 flex flex-col items-center justify-center bg-[#fcfdfe] p-12 text-center"
              >
                <div className="max-w-sm w-full relative">
                  <div className="absolute -top-20 -left-20 w-56 h-56 bg-blue-100/40 rounded-full blur-3xl" />
                  <div className="absolute -bottom-20 -right-20 w-56 h-56 bg-purple-100/40 rounded-full blur-3xl" />

                  <div className="relative z-10 space-y-7">
                    <div className="h-20 w-20 bg-white rounded-3xl shadow-2xl flex items-center justify-center mx-auto ring-1 ring-slate-100">
                      <motion.div
                        animate={{ rotateY: [0, 180, 360], scale: [1, 1.1, 1] }}
                        transition={{
                          duration: 4,
                          repeat: Infinity,
                          ease: "easeInOut",
                        }}
                      >
                        <Box className="h-10 w-10 text-blue-600" />
                      </motion.div>
                    </div>

                    <div>
                      <h2 className="text-2xl font-black text-slate-900 tracking-tight mb-3">
                        Select a Part to Analyze
                      </h2>
                      <p className="text-slate-500 text-sm font-medium leading-relaxed">
                        Upload your CAD files to our advanced geometry engine.
                        We'll automatically extract features, detect DFM issues,
                        and recommend the best manufacturing process.
                      </p>
                    </div>

                    <div className="flex flex-col gap-3">
                      <Button
                        {...getRootProps()}
                        className="h-12 rounded-2xl bg-slate-900 text-white hover:bg-slate-800 shadow-xl shadow-slate-200 transition-all font-black gap-2"
                      >
                        <Upload className="h-4 w-4" />
                        Upload Your First File
                      </Button>
                      <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest">
                        Supports STEP • STP • STL • IGES
                      </p>
                    </div>

                    <div className="grid grid-cols-3 gap-4 pt-6">
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
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

// ── Helper Components ──────────────────────────────────────────────────────────

function MetricItem({
  icon,
  label,
  value,
  status = "default",
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  status?: string;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <div
        className={cn(
          "h-8 w-8 rounded-lg flex items-center justify-center",
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
        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-0.5">
          {label}
        </p>
        <p className="text-sm font-black text-slate-900 leading-none capitalize">
          {value}
        </p>
      </div>
    </div>
  );
}

function DataCard({
  label,
  value,
  subValue,
}: {
  label: string;
  value: string;
  subValue: string;
}) {
  return (
    <div className="p-4 rounded-xl border border-slate-100 bg-white shadow-sm hover:shadow-md transition-shadow group">
      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5 group-hover:text-blue-500 transition-colors">
        {label}
      </p>
      <p className="text-sm font-black text-slate-900">{value}</p>
      <p className="text-[9px] font-medium text-slate-400 mt-1">{subValue}</p>
    </div>
  );
}

function FeatureItem({
  icon,
  label,
  value,
  details,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  details: string;
}) {
  return (
    <div className="flex items-center gap-3 p-3.5 rounded-xl bg-white border border-slate-100 shadow-sm group hover:border-blue-200 transition-all">
      <div className="h-9 w-9 rounded-lg bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-blue-50 group-hover:text-blue-600 transition-colors shrink-0">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-0.5">
          <p className="text-xs font-black text-slate-900 uppercase tracking-wide">
            {label}
          </p>
          <span className="text-sm font-black text-blue-600">{value}</span>
        </div>
        <p className="text-[10px] font-medium text-slate-500 truncate">
          {details}
        </p>
      </div>
    </div>
  );
}

function CharBadge({ label }: { label: string }) {
  return (
    <Badge className="bg-slate-50 text-slate-600 border-slate-100 hover:bg-slate-100 px-3 py-1 font-bold text-[10px] rounded-lg tracking-wide">
      {label}
    </Badge>
  );
}

function SetupBox({
  label,
  value,
  active,
}: {
  label: string;
  value: number;
  active: boolean;
}) {
  return (
    <div
      className={cn(
        "p-2.5 rounded-xl border text-center transition-all",
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

function FeatureHighlight({
  icon,
  label,
}: {
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="h-10 w-10 rounded-2xl bg-white shadow-lg flex items-center justify-center text-slate-400 border border-slate-100">
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
