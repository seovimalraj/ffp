"use client";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

import {
  Zap,
  Loader2,
  Upload,
  Trash2,
  Settings,
  FileIcon,
  FileText,
  Maximize2,
  Activity,
  Ruler,
  Check,
  Archive,
} from "lucide-react";
import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import dynamic from "next/dynamic";
import { ImageViewerModal } from "@/components/image-viewer-modal";
import { CubeIcon } from "@heroicons/react/24/outline";
import { formatCurrencyFixed } from "@/lib/utils";
import { CadViewer } from "@/components/cad/cad-viewer";
import ExpandFileModal from "./expand-file-modal";
import { EditPartModal } from "./edit-part-modal";
import { useFileUpload } from "@/lib/hooks/use-file-upload";
import { notify } from "@/lib/toast";

// Dynamically import PDF viewer to avoid SSR issues with DOMMatrix
const PdfViewerModal = dynamic(
  () =>
    import("@/components/pdf-viewer-modal").then((mod) => mod.PdfViewerModal),
  { ssr: false },
);

import {
  PartConfig,
  File2D,
  MaterialItem,
  ToleranceItem,
  FinishItem,
  InspectionItem,
  ThreadItem,
} from "@/types/part-config";
import { apiClient } from "@/lib/api";

// --- Sub-Component: PartCardItem ---
export function PartCardItem({
  part,
  index,
  updatePart,
  updatePartFields,
  handleDeletePart,
  handleArchivePart,
  calculatePrice,
  MATERIALS_LIST,
  TOLERANCES_LIST,
  FINISHES_LIST,
  THREAD_OPTIONS,
  INSPECTIONS_OPTIONS,
  isSelected,
  onToggleSelection,
}: {
  part: PartConfig;
  index: number;
  updatePart: (
    index: number,
    field: keyof PartConfig,
    value: any,
    saveToDb?: boolean,
  ) => void;
  updatePartFields?: (
    index: number,
    updates: Partial<PartConfig>,
    saveToDb?: boolean,
  ) => void;
  handleDeletePart: (index: number) => void;
  handleArchivePart?: (partId: string) => void;
  calculatePrice: (
    part: PartConfig,
    tier?: "economy" | "standard" | "expedited",
  ) => number;
  MATERIALS_LIST: MaterialItem[];
  TOLERANCES_LIST: ToleranceItem[];
  FINISHES_LIST: FinishItem[];
  INSPECTIONS_OPTIONS: InspectionItem[];
  THREAD_OPTIONS: ThreadItem[];
  isSelected?: boolean;
  onToggleSelection?: () => void;
}) {
  // const [isEditing, setIsEditing] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File2D | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isViewerOpen, setIsViewerOpen] = useState(false);
  const [isPdfViewerOpen, setIsPdfViewerOpen] = useState(false);
  const [isFilesModalOpen, setIsFilesModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [expandedFile, setExpandedFile] = useState<File | string | null>(null);

  const { upload } = useFileUpload();

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      if (acceptedFiles.length > 0) {
        setIsUploading(true);
        try {
          const newFiles = await Promise.all(
            acceptedFiles.map(async (file) => {
              let preview = URL.createObjectURL(file);
              try {
                const { url } = await upload(file);
                preview = url;
              } catch (error) {
                console.error("Failed to upload 2D file:", error);
                notify.error(`Failed to upload ${file.name}`);
              }
              return {
                file,
                preview,
              };
            }),
          );

          const { data } = await apiClient.post(
            `/rfq/${part.rfqId}/${part.id}/add-2d-drawings`,
            {
              drawings: newFiles.map((f) => ({
                file_name: f.file.name,
                file_url: f.preview,
                mime_type: f.file.type,
              })),
            },
          );

          if (!data || !data.drawings) {
            throw new Error("Failed to upload files");
          }

          const uploadedFiles = newFiles.map((f, i) => ({
            ...f,
            id: data.drawings[i]?.id,
          }));

          const currentFiles = part.files2d || [];
          updatePart(index, "files2d", [...currentFiles, ...uploadedFiles]);
        } catch (error) {
          console.error("Error uploading files:", error);
          notify.error("Failed to upload files");
        } finally {
          setIsUploading(false);
        }
      }
    },
    [index, updatePart, upload, part.files2d],
  );

  const { getRootProps, getInputProps } = useDropzone({
    onDrop,
    accept: {
      "model/stl": [".stl"],
      "model/step": [".step", ".stp"],
      "application/octet-stream": [".stl", ".step", ".stp"],
      "application/pdf": [".pdf"],
      "image/vnd.dxf": [".dxf"],
      "image/vnd.dwg": [".dwg"],
      "image/png": [".png"],
      "image/jpeg": [".jpg", ".jpeg"],
      "image/svg+xml": [".svg"],
      "image/webp": [".webp"],
    },
    multiple: true,
  });

  const handleFileClick = (file2d: File2D) => {
    setSelectedFile(file2d);
    const isPdf = file2d.file.type === "application/pdf";
    setIsFilesModalOpen(false);
    if (isPdf) {
      setIsPdfViewerOpen(true);
    } else {
      setIsViewerOpen(true);
    }
  };

  const handleDeleteFile = async (fileIndex: number) => {
    const fileToDelete = part.files2d?.[fileIndex];
    if (!fileToDelete) return;

    const fileId =
      "id" in fileToDelete.file ? fileToDelete.file.id : fileToDelete.id;

    console.log("in", fileId);

    if (fileId) {
      try {
        await apiClient.delete(
          `/rfq/${part.rfqId}/parts/${part.id}/drawings/${fileId}`,
        );
        notify.success("Drawing removed");
      } catch (error) {
        console.error("Failed to delete drawing", error);
        notify.error("Failed to delete drawing");
        return;
      }
    }

    const currentFiles = part.files2d || [];
    const updatedFiles = currentFiles.filter((_, i) => i !== fileIndex);
    updatePart(index, "files2d", updatedFiles);
  };

  /* New Layout Design */
  return (
    <Card
      className={`overflow-hidden border shadow-sm hover:shadow-md transition-all duration-300 bg-white group relative  ${isSelected ? "border-blue-500 ring-2 ring-blue-200" : "border-slate-200"}`}
    >
      <div className="absolute top-4 left-4 z-10">
        <div
          className={`w-6 h-6 rounded-md border-2 flex items-center justify-center cursor-pointer transition-all ${
            isSelected
              ? "bg-blue-600 border-blue-600"
              : "bg-white border-slate-300 group-hover:border-blue-400"
          }`}
          onClick={onToggleSelection}
        >
          {isSelected && <Check className="w-4 h-4 text-white" />}
        </div>
      </div>

      <div className="flex flex-col md:flex-row">
        {/* LEFT SIDEBAR: Visuals, Pricing, Key Metrics */}
        <div className="w-full md:w-[340px] bg-slate-50/80 border-b md:border-b-0 md:border-r border-slate-100 p-6 flex flex-col gap-6 flex-shrink-0">
          {/* 3D Thumbnail */}
          <div className="aspect-square w-full bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm relative hover:border-blue-400 transition-all duration-300">
            <CadViewer
              file={part.fileObject || part.filePath}
              className="h-full w-full"
              zoom={0.9}
            />
            {/* Overlay Badges */}
            <div className="absolute top-2 right-2 flex flex-col gap-1 items-end">
              {part.geometry && (
                <span className="bg-black/70 backdrop-blur-sm text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                  {part.geometry.volume.toFixed(2)} mm³
                </span>
              )}
            </div>

            <button
              onClick={() =>
                setExpandedFile(part.fileObject || part.filePath || null)
              }
              className="absolute bottom-4 right-4 rounded-full bg-white/10 p-2 text-white backdrop-blur-sm transition-colors hover:bg-white/20"
              title="Expand View"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="15 3 21 3 21 9" />
                <polyline points="9 21 3 21 3 15" />
                <line x1="21" y1="3" x2="14" y2="10" />
                <line x1="3" y1="21" x2="10" y2="14" />
              </svg>
            </button>
          </div>

          {part.geometry && (
            <div className="flex flex-wrap gap-0.5">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-100/50 border border-slate-200 text-[10px] font-bold text-slate-600 uppercase tracking-wider">
                <Maximize2 className="w-3.5 h-3.5 text-slate-400" />
                {part.geometry.boundingBox.x.toFixed(1)}×
                {part.geometry.boundingBox.y.toFixed(1)}×
                {part.geometry.boundingBox.z.toFixed(1)}
              </div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-100/50 border border-slate-200 text-[10px] font-bold text-slate-600 uppercase tracking-wider">
                <CubeIcon className="w-3.5 h-3.5 text-slate-400" />
                {part.geometry.volume.toFixed(0)} mm³
              </div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-100/50 border border-slate-200 text-[10px] font-bold text-slate-600 uppercase tracking-wider">
                <Ruler className="w-3.5 h-3.5 text-slate-400" />
                {part.geometry.surfaceArea.toFixed(0)} mm²
              </div>
            </div>
          )}

          {part.files2d && part.files2d.length > 0 ? (
            <div className="space-y-3">
              {/* Show first 2 files */}
              {part.files2d.slice(0, 1).map((file2d, fileIndex) => {
                const isPdfFile = file2d.file.type === "application/pdf";
                return (
                  <div
                    key={fileIndex}
                    className="flex items-center gap-4 cursor-pointer group hover:bg-blue-50/50 p-3 rounded-lg transition-all border border-transparent hover:border-blue-200"
                    onClick={() => handleFileClick(file2d)}
                  >
                    <div className="relative overflow-hidden rounded-md border border-slate-200 bg-white h-16 w-16 sm:h-20 sm:w-20 flex-shrink-0 flex items-center justify-center">
                      {isPdfFile ? (
                        <FileText className="w-8 h-8 text-red-500" />
                      ) : (
                        <img
                          src={file2d.preview}
                          alt="Technical Drawing"
                          className="object-contain max-h-full max-w-full p-1"
                        />
                      )}
                      <div className="absolute inset-0 bg-blue-900/0 group-hover:bg-blue-900/10 transition-colors flex items-center justify-center">
                        <Maximize2 className="w-5 h-5 text-blue-600 opacity-0 group-hover:opacity-100 transform scale-75 group-hover:scale-100 transition-all" />
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-bold text-slate-900 truncate mb-0.5">
                        {file2d.file.name}
                      </h4>
                      <div className="flex items-center gap-2 mb-1">
                        {isPdfFile && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-700 uppercase tracking-wider">
                            PDF
                          </span>
                        )}
                        <p className="text-[10px] font-semibold text-blue-600 flex items-center gap-1 uppercase tracking-wider">
                          <Maximize2 className="w-2.5 h-2.5" /> Preview
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-slate-400 hover:text-red-500 hover:bg-red-50"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteFile(fileIndex);
                      }}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                );
              })}

              {/* Show More Button if more than 1 file */}
              {part.files2d.length > 1 && (
                <Button
                  variant="outline"
                  className="w-full border-blue-200 text-blue-600 hover:bg-blue-50 hover:border-blue-300"
                  onClick={() => setIsFilesModalOpen(true)}
                >
                  <FileIcon className="w-4 h-4 mr-2" />
                  Show all {part.files2d.length} files
                </Button>
              )}

              {/* Add More Files Button */}
              <div
                {...getRootProps()}
                className="border border-dashed border-slate-300 rounded-lg p-4 bg-slate-50/50 hover:bg-slate-50 hover:border-blue-400 transition-all cursor-pointer text-center group flex flex-col items-center justify-center gap-2"
              >
                <input
                  {...getInputProps()}
                  key={`file-input-${part.files2d?.length || 0}`}
                />
                {isUploading ? (
                  <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
                ) : (
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-white rounded-full border border-slate-200 shadow-sm group-hover:border-blue-300">
                      <Upload className="w-3.5 h-3.5 text-slate-400 group-hover:text-blue-500" />
                    </div>
                    <p className="text-xs font-medium text-slate-600 group-hover:text-blue-700 transition-colors">
                      Add More Files
                    </p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div
              {...getRootProps()}
              className="border border-dashed border-slate-300 rounded-lg p-8 bg-slate-50/50 hover:bg-slate-50 hover:border-blue-400 transition-all cursor-pointer text-center group flex flex-col items-center justify-center gap-3"
            >
              <input {...getInputProps()} />
              {isUploading ? (
                <div className="flex flex-col items-center justify-center">
                  <Loader2 className="w-8 h-8 text-blue-600 animate-spin mb-2" />
                  <p className="text-sm font-medium text-blue-600">
                    Uploading...
                  </p>
                </div>
              ) : (
                <>
                  <div className="p-2 bg-white rounded-full border border-slate-200 shadow-sm group-hover:border-blue-300">
                    <Upload className="w-4 h-4 text-slate-400 group-hover:text-blue-500" />
                  </div>
                  <p className="text-xs font-medium text-slate-600 group-hover:text-blue-700 transition-colors">
                    Upload 2D Drawings <br />
                    <span className="text-slate-400 font-normal">
                      (PDF, JPG, PNG, DXF, DWG - Multiple files supported)
                    </span>
                  </p>
                </>
              )}
            </div>
          )}
        </div>

        {/* RIGHT MAIN CONTENT: Configuration & Details */}
        <div className="flex-1 p-6 lg:p-10 flex flex-col min-w-0">
          {/* Header Section */}
          <div className="flex flex-col gap-6 mb-8 border-b border-slate-100 pb-8">
            {/* Top Row: Title, Index & Actions */}
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-4 min-w-0">
                <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-blue-600 text-white text-sm font-black flex-shrink-0 shadow-sm">
                  {index + 1}
                </div>
                <div className="min-w-0">
                  <h3 className="text-xl font-black text-slate-900 truncate tracking-tight">
                    {part.fileName}
                  </h3>
                  {/* Badges immediately under title for context */}
                  <div className="flex flex-wrap items-center gap-2 mt-3">
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-amber-50 border border-amber-100 text-[10px] font-bold text-amber-700 uppercase tracking-wider">
                      <Zap className="w-3.5 h-3.5 text-amber-500" />
                      CNC Machining
                    </div>
                    {part.geometry && (
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-blue-50 border border-blue-100 text-[10px] font-bold text-blue-700 uppercase tracking-wider">
                        <Activity className="w-3.5 h-3.5 text-blue-400" />
                        {part.geometry.complexity}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Controls Section: Qty & Lead Time */}
            <div className="flex flex-col gap-5">
              {/* Row 1: Quantity Selector & Action Buttons */}
              <div className="flex items-center justify-between gap-4">
                <div className="bg-slate-50 border border-slate-200 px-3 flex items-center gap-3 h-11 rounded-xl shadow-sm">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-r border-slate-200 pr-3 h-full flex items-center">
                    Qty
                  </span>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 rounded-md hover:bg-white text-slate-600 hover:text-blue-600 transition-colors"
                      onClick={() => {
                        const newQ = part.quantity - 1;
                        if (newQ >= 1)
                          updatePart(index, "quantity", newQ, false);
                      }}
                    >
                      <span className="text-base font-bold">−</span>
                    </Button>
                    <input
                      type="number"
                      value={part.quantity}
                      onChange={(e) => {
                        const val = parseInt(e.target.value || "1");
                        if (!isNaN(val) && val >= 1) {
                          updatePart(index, "quantity", val, false);
                        }
                      }}
                      className="w-10 text-center font-bold text-slate-900 border-none bg-transparent focus:ring-0 p-0 text-sm"
                      min="1"
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 rounded-md hover:bg-white text-slate-600 hover:text-blue-600 transition-colors"
                      onClick={() =>
                        updatePart(index, "quantity", part.quantity + 1, false)
                      }
                    >
                      <span className="text-base font-bold">+</span>
                    </Button>
                  </div>
                </div>

                {/* Action Buttons: Standardized h-11 */}
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setIsEditModalOpen(true)}
                    className="h-11 w-11 rounded-xl border-slate-200 text-slate-600 hover:text-blue-600 hover:border-blue-300 hover:bg-blue-50 shadow-sm transition-all"
                    title="Configure Part"
                  >
                    <Settings className="w-4.5 h-4.5" />
                  </Button>
                  {handleArchivePart && (
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => handleArchivePart(part.id)}
                      className="h-11 w-11 rounded-xl border-slate-200 text-slate-600 hover:text-amber-600 hover:border-amber-300 hover:bg-amber-50 shadow-sm transition-all"
                      title="Archive Part"
                    >
                      <Archive className="w-4.5 h-4.5" />
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => handleDeletePart(index)}
                    className="h-11 w-11 rounded-xl border-slate-200 text-slate-400 hover:text-white hover:bg-red-500 hover:border-red-500 shadow-sm transition-all"
                    title="Delete Part"
                  >
                    <Trash2 className="w-4.5 h-4.5" />
                  </Button>
                </div>
              </div>

              {/* Row 2: Lead Time Pricing Options */}
              <div className="space-y-4">
                <span className="text-[13px] font-black text-slate-400 uppercase tracking-widest px-1">
                  Lead Time & Pricing
                </span>
                <div className="grid mt-3 grid-cols-3 items-center gap-2">
                  {["economy", "standard", "expedited"].map((leadTimeType) => {
                    const leadTimePrice = calculatePrice(
                      part,
                      leadTimeType as "economy" | "standard" | "expedited",
                    );
                    const isSelected = part.leadTimeType === leadTimeType;
                    const icon = `/icons/${leadTimeType}.png`;

                    return (
                      <div
                        key={leadTimeType}
                        onClick={() =>
                          updatePart(
                            index,
                            "leadTimeType",
                            leadTimeType as
                              | "economy"
                              | "standard"
                              | "expedited",
                            false,
                          )
                        }
                        className={`group cursor-pointer relative flex items-center gap-4 px-4 py-2.5 rounded-xl transition-all border h-14 min-w-[140px]
                          ${
                            isSelected
                              ? "border-blue-600 bg-blue-50 ring-1 ring-blue-600 shadow-sm"
                              : "border-slate-200 bg-white hover:border-blue-400 hover:shadow-sm"
                          }`}
                      >
                        <img
                          src={icon}
                          alt=""
                          className="w-8 h-8 transition-all"
                        />
                        <div className="flex flex-col gap-y-2">
                          <span
                            className={`text-lg font-bold tracking-tight leading-none ${isSelected ? "text-blue-700" : "text-slate-900"}`}
                          >
                            {formatCurrencyFixed(leadTimePrice / part.quantity)}
                          </span>
                          <span className=" text-[12px] font-bold uppercase tracking-tight text-slate-500 leading-none mb-1">
                            {leadTimeType}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Content Area */}
          <div className="flex-1">
            <div className="space-y-5">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 p-5 rounded-xl bg-slate-50/50 border border-slate-200 shadow-sm">
                <div className="space-y-1">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    Material
                  </p>
                  <p className="text-sm font-bold text-slate-900 leading-tight">
                    {MATERIALS_LIST.find((m) => m.value === part.material)
                      ?.label ||
                      part.material ||
                      "Not specified"}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    Finish
                  </p>
                  <p className="text-sm font-bold text-slate-900 leading-tight">
                    {FINISHES_LIST.find((f) => f.value === part.finish)
                      ?.label ||
                      part.finish ||
                      "As Machined"}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    Tolerance
                  </p>
                  <p className="text-sm font-bold text-slate-900 leading-tight capitalize">
                    {part.tolerance || "Standard"}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    Inspection
                  </p>
                  <p className="text-sm font-bold text-slate-900 leading-tight capitalize">
                    {part.inspection || "Standard"}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      {/* Image Viewer for image files */}
      <ImageViewerModal
        isOpen={isViewerOpen && selectedFile?.file.type !== "application/pdf"}
        onClose={() => {
          setIsViewerOpen(false);
          setSelectedFile(null);
        }}
        imageSrc={selectedFile?.preview || ""}
        altText={selectedFile?.file.name || "Technical Drawing"}
      />

      {/* PDF Viewer for PDF files */}
      <PdfViewerModal
        isOpen={
          isPdfViewerOpen && selectedFile?.file.type === "application/pdf"
        }
        onClose={() => {
          setIsPdfViewerOpen(false);
          setSelectedFile(null);
        }}
        pdfSrc={selectedFile?.preview || ""}
        fileName={selectedFile?.file.name.replace(/\.pdf$/i, "") || "Document"}
      />

      {/* Files Management Modal */}
      <Dialog open={isFilesModalOpen} onOpenChange={setIsFilesModalOpen}>
        <DialogContent className="sm:max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold">
              2D Technical Drawings
            </DialogTitle>
            <DialogDescription>
              Manage all technical drawings and documentation for this part
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto invisible-scrollbar pr-2 -mr-2">
            {/* Upload Section */}
            <div className="mb-6">
              <div
                {...getRootProps()}
                className="border-2 border-dashed border-slate-300 rounded-lg p-6 bg-slate-50/50 hover:bg-slate-50 hover:border-blue-400 transition-all cursor-pointer text-center group"
              >
                <input {...getInputProps()} />
                {isUploading ? (
                  <div className="flex flex-col items-center justify-center gap-2">
                    <Loader2 className="w-6 h-6 text-blue-600 animate-spin" />
                    <p className="text-sm font-medium text-slate-700">
                      Uploading...
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2">
                    <div className="p-3 bg-white rounded-full border border-slate-200 shadow-sm group-hover:border-blue-300">
                      <Upload className="w-6 h-6 text-slate-400 group-hover:text-blue-500" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-700 group-hover:text-blue-700">
                        Upload more files
                      </p>
                      <p className="text-xs text-slate-500 mt-1">
                        PDF, JPG, PNG, DXF, DWG - Multiple files supported
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Files Grid */}
            {part.files2d && part.files2d.length > 0 && (
              <div className="grid grid-cols-2 gap-4">
                {part.files2d.map((file2d, fileIndex) => {
                  const isPdfFile = file2d.file.type === "application/pdf";
                  return (
                    <div
                      key={fileIndex}
                      className="group relative border border-slate-200 rounded-lg p-4 hover:border-blue-300 hover:shadow-md transition-all bg-white"
                    >
                      {/* Preview/Icon Section */}
                      <div
                        className="aspect-square w-full bg-slate-50 rounded-lg mb-3 overflow-hidden cursor-pointer relative"
                        onClick={() => {
                          handleFileClick(file2d);
                          setIsFilesModalOpen(false);
                        }}
                      >
                        {isPdfFile ? (
                          <div className="w-full h-full flex items-center justify-center">
                            <FileText className="w-16 h-16 text-red-500" />
                          </div>
                        ) : (
                          <img
                            src={file2d.preview}
                            alt={file2d.file.name}
                            className="w-full h-full object-contain p-2"
                          />
                        )}
                        <div className="absolute inset-0 bg-blue-900/0 group-hover:bg-blue-900/5 transition-colors flex items-center justify-center">
                          <Maximize2 className="w-6 h-6 text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                      </div>

                      {/* File Info */}
                      <div className="space-y-1">
                        <h4 className="text-sm font-semibold text-slate-900 truncate">
                          {file2d.file.name}
                        </h4>
                        <div className="flex items-center justify-between">
                          {isPdfFile && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-700">
                              PDF
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Delete Button */}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity bg-white hover:bg-red-50 text-slate-400 hover:text-red-500 shadow-sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteFile(fileIndex);
                          if (part.files2d && part.files2d.length <= 3) {
                            setIsFilesModalOpen(false);
                          }
                        }}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Empty State */}
            {(!part.files2d || part.files2d.length === 0) && (
              <div className="text-center py-12">
                <FileIcon className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <p className="text-sm text-slate-500">No files uploaded yet</p>
                <p className="text-xs text-slate-400 mt-1">
                  Upload your first file above
                </p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <EditPartModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        part={part}
        index={index}
        updatePart={updatePart}
        updatePartFields={updatePartFields}
        calculatePrice={(
          part: PartConfig,
          leadTimeType: typeof part.leadTimeType,
        ) => calculatePrice(part, leadTimeType)}
        MATERIALS_LIST={MATERIALS_LIST}
        TOLERANCES_LIST={TOLERANCES_LIST}
        FINISHES_LIST={FINISHES_LIST}
        THREAD_OPTIONS={THREAD_OPTIONS}
        INSPECTIONS_OPTIONS={INSPECTIONS_OPTIONS}
      />

      {expandedFile && (
        <ExpandFileModal
          expandedFile={expandedFile}
          setExpandedFile={setExpandedFile}
        />
      )}
    </Card>
  );
}
