"use client";

import React from "react";
import { Detail, IOrderFull } from "../page";
import { CadViewer } from "@/components/cad/cad-viewer";
import { X, Package, FileText, Image as ImageIcon, Eye } from "lucide-react";
import dynamic from "next/dynamic";
import { ImageViewerModal } from "@/components/image-viewer-modal";
import { metalTranslation } from "@cnc-quote/shared";
import { useSession } from "next-auth/react";

interface Props {
  part: IOrderFull["parts"][number];
  onClose: () => void;
}

// Dynamically import PDF viewer to avoid SSR issues with DOMMatrix
const PdfViewerModal = dynamic(
  () =>
    import("@/components/pdf-viewer-modal").then((mod) => mod.PdfViewerModal),
  { ssr: false },
);

const RfqSideDrawer = ({ part, onClose }: Props) => {
  const [viewingFile, setViewingFile] = React.useState<{
    file_url: string;
    file_name: string;
    mime_type: string;
  } | null>(null);

  const isImage = viewingFile?.mime_type.startsWith("image/");
  const isPdf = viewingFile?.mime_type.includes("pdf");
  const session = useSession();
  const isSupplier = session.data?.user.role === "supplier";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 lg:p-10">
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity duration-300"
        onClick={onClose}
      />

      {/* Modal Contianer */}
      <div className="relative w-full max-w-[1400px] h-full max-h-[850px] bg-white rounded-[32px] shadow-2xl flex flex-col md:flex-row overflow-hidden transition-all duration-500 ease-out border border-white/20">
        {/* Left Side: 3D Viewer */}
        <div className="flex-1 bg-[#0a0a0f] relative group">
          <div className="absolute inset-0">
            <CadViewer
              file={part.rfq_part.cad_file_url}
              showControls={true}
              autoResize={true}
              zoom={0.5}
            />
          </div>

          {/* Viewer Overlay Info */}
          <div className="absolute bottom-8 left-8 z-10 p-4 bg-black/40 backdrop-blur-xl rounded-2xl border border-white/10 text-white pointer-events-none">
            <div className="text-[10px] text-slate-400 uppercase font-bold tracking-[0.2em] mb-1">
              Component Source
            </div>
            <div className="text-sm font-semibold tracking-wide">
              {part.rfq_part.file_name}
            </div>
          </div>
        </div>

        {/* Right Side: Details */}
        <div className="w-full md:w-[400px] xl:w-[480px] flex flex-col h-full bg-white border-l border-slate-100">
          {/* Header */}
          <div className="p-8 border-b border-slate-100 flex justify-between items-start">
            <div>
              <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-600 text-[10px] font-bold uppercase tracking-wider mb-3">
                <Package className="w-3 h-3" />
                Manufacturing Specification
              </div>
              <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
                {part.rfq_part.file_name.split(".")[0]}
              </h2>
            </div>
            <button
              onClick={onClose}
              className="p-2.5 hover:bg-slate-50 rounded-2xl transition-all duration-200 text-slate-400 hover:text-slate-900 border border-transparent hover:border-slate-200"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-8 space-y-10 custom-scrollbar">
            {!isSupplier && (
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-50/50 p-5 rounded-3xl border border-slate-100 flex flex-col">
                  <span className="text-[10px] text-slate-400 uppercase font-black tracking-widest mb-2">
                    Unit Price
                  </span>
                  <span className="text-xl font-bold text-slate-900">
                    ${part.unit_price.toFixed(2)}
                  </span>
                </div>
                <div className="bg-slate-900 p-5 rounded-3xl shadow-xl shadow-slate-200/50 flex flex-col text-white">
                  <span className="text-[10px] text-slate-400 uppercase font-black tracking-widest mb-2">
                    Total Value
                  </span>
                  <span className="text-xl font-bold">
                    ${part.total_price.toFixed(2)}
                  </span>
                </div>
              </div>
            )}

            {/* Specifications */}
            <section>
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
                <div className="w-1 h-1 rounded-full bg-indigo-500" />
                Technical Details
              </h3>
              <div className="grid gap-y-5">
                <Detail
                  label="Material"
                  value={
                    (metalTranslation as any)[part.rfq_part.material] ??
                    part.rfq_part.material
                  }
                />
                <Detail label="Finishing" value={part.rfq_part.finish} />
                <Detail label="Tolerance" value={part.rfq_part.tolerance} />
                <Detail
                  label="Quality Grade"
                  value={part.rfq_part.inspection || "Standard"}
                />
              </div>
            </section>

            {/* Fulfillment */}
            {!isSupplier && (
              <section>
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
                  <div className="w-1 h-1 rounded-full bg-indigo-500" />
                  Logistics & Volume
                </h3>
                <div className="bg-slate-50/50 rounded-[24px] p-6 border border-slate-100 space-y-5">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        Batch Size
                      </p>
                      <p className="text-sm font-bold text-slate-900">
                        {part.quantity} units
                      </p>
                    </div>
                    <div className="h-8 w-[1px] bg-slate-200" />
                    <div className="space-y-1 text-right">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        Turnaround
                      </p>
                      <p className="text-sm font-bold text-slate-900">
                        {part.lead_time} days
                      </p>
                    </div>
                  </div>
                  <div className="pt-4 border-t border-slate-200/60 flex items-center justify-between">
                    <span className="text-xs font-medium text-slate-500">
                      Shipping Mode
                    </span>
                    <span className="text-xs font-bold text-slate-900 bg-white px-3 py-1 rounded-full border border-slate-200 shadow-sm">
                      {part.lead_time_type.toUpperCase()}
                    </span>
                  </div>
                </div>
              </section>
            )}

            {/* Status */}
            {!isSupplier && (
              <section>
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                  <div className="w-1 h-1 rounded-full bg-indigo-500" />
                  Production Status
                </h3>
                <div className="bg-emerald-50/50 border border-emerald-100 p-5 rounded-[24px] flex items-center justify-between group">
                  <div>
                    <div className="text-[10px] text-emerald-600 uppercase font-black tracking-widest mb-1">
                      Current Phase
                    </div>
                    <div className="text-emerald-900 font-bold text-lg capitalize">
                      {part.status.replace("-", " ")}
                    </div>
                  </div>
                  <div className="relative">
                    <div className="h-3 w-3 rounded-full bg-emerald-500 animate-ping absolute inset-0" />
                    <div className="h-3 w-3 rounded-full bg-emerald-500 relative" />
                  </div>
                </div>
              </section>
            )}
            {/* 2D Diagrams */}
            <section>
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                <div className="w-1 h-1 rounded-full bg-indigo-500" />
                2D Diagrams
              </h3>
              <div className="grid grid-cols-1 gap-3">
                {part.drawings_2d && part.drawings_2d.length > 0 ? (
                  part.drawings_2d.map((file, idx) => (
                    <button
                      key={idx}
                      onClick={() => setViewingFile(file)}
                      className="group flex items-center gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-100 hover:border-indigo-200 hover:bg-white transition-all duration-300 hover:shadow-lg hover:shadow-indigo-500/5 text-left"
                    >
                      <div className="h-10 w-10 rounded-xl bg-white border border-slate-100 flex items-center justify-center text-slate-400 group-hover:text-indigo-600 group-hover:border-indigo-100 transition-colors">
                        {file.mime_type.includes("pdf") ? (
                          <FileText className="h-5 w-5" />
                        ) : (
                          <ImageIcon className="h-5 w-5" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-slate-900 truncate">
                          {file.file_name}
                        </p>
                        <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">
                          {file.mime_type.split("/")[1]?.toUpperCase() ||
                            "FILE"}
                        </p>
                      </div>
                      <div className="h-8 w-8 rounded-full flex items-center justify-center text-slate-300 group-hover:text-indigo-500 group-hover:bg-indigo-50 transition-all">
                        <Eye className="h-4 w-4" />
                      </div>
                    </button>
                  ))
                ) : (
                  <div className="text-center py-8 rounded-[24px] border border-dashed border-slate-200">
                    <p className="text-xs text-slate-400 font-medium">
                      No 2D diagrams available
                    </p>
                  </div>
                )}
              </div>
            </section>

            {/* Notes */}
            {part.rfq_part.notes && !isSupplier && (
              <section className="pb-4">
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                  <div className="w-1 h-1 rounded-full bg-indigo-500" />
                  Manufacturer Notes
                </h3>
                <div className="p-5 bg-slate-50 rounded-[24px] text-sm text-slate-600 leading-relaxed italic border border-slate-100">
                  "{part.rfq_part.notes}"
                </div>
              </section>
            )}
          </div>
        </div>
      </div>

      {/* Media Viewers */}
      {viewingFile && isImage && (
        <ImageViewerModal
          isOpen={!!viewingFile}
          onClose={() => setViewingFile(null)}
          imageSrc={viewingFile.file_url}
          altText={viewingFile.file_name}
        />
      )}

      {viewingFile && isPdf && (
        <PdfViewerModal
          isOpen={!!viewingFile}
          onClose={() => setViewingFile(null)}
          pdfSrc={viewingFile.file_url}
          fileName={viewingFile.file_name}
        />
      )}
    </div>
  );
};

export default RfqSideDrawer;
