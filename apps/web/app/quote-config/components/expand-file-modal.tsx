"use client";

import { useEffect } from "react";
import { X } from "lucide-react";
import { CadViewer } from "@/components/cad/cad-viewer";

type ExpandFileModalProps = {
  expandedFile: File | string | null;
  setExpandedFile: (file: File | string | null) => void;
  part?: any;
};

const ExpandFileModal = ({
  expandedFile,
  setExpandedFile,
  part,
}: ExpandFileModalProps) => {
  const fileName =
    expandedFile instanceof File
      ? expandedFile.name
      : typeof expandedFile === "string"
        ? expandedFile.split("/").pop()?.split("?")[0] || ""
        : "";

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setExpandedFile(null);
      }
    };
    window.addEventListener("keydown", handleEscape);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "unset";
    };
  }, [setExpandedFile]);

  return (
    <div
      onClick={() => setExpandedFile(null)}
      className="animate-fade-in fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="animate-scale-in relative h-[90vh] w-[90vw] overflow-hidden rounded-2xl bg-[#0b1220] shadow-2xl"
      >
        {/* Close Button */}
        <button
          onClick={() => setExpandedFile(null)}
          className="absolute right-6 top-6 z-[110] flex h-12 w-12 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur-xl transition-all hover:scale-110 hover:bg-white/20 active:scale-95 border border-white/10 shadow-lg"
          aria-label="Close modal"
        >
          <X className="h-6 w-6" />
        </button>

        {/* Modal Header Gradient Overlay */}
        <div className="absolute left-0 right-0 top-0 z-10 h-32 bg-gradient-to-b from-black/60 to-transparent pointer-events-none" />

        {/* Fullscreen Viewer */}
        <CadViewer
          file={expandedFile}
          className="h-full w-full"
          showControls={true}
        />

        {(part?.rfq_part?.file_name ||
          part?.fileName ||
          part?.file_name ||
          fileName) && (
          <div className="absolute bottom-8 left-8 z-10 p-4 bg-black/40 backdrop-blur-xl rounded-2xl border border-white/10 text-white pointer-events-none">
            <div className="text-[10px] text-slate-100 uppercase font-bold tracking-[0.2em] mb-1">
              Component Source
            </div>
            <div className="text-sm font-semibold tracking-wide">
              {part?.rfq_part?.file_name ||
                part?.fileName ||
                part?.file_name ||
                fileName}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ExpandFileModal;
