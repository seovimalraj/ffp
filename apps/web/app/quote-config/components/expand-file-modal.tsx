"use client";

import { useEffect } from "react";
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
      className="animate-fade-in fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="animate-scale-in relative h-[90vh] w-[90vw] overflow-hidden rounded-2xl bg-[#0b1220] shadow-2xl"
      >
        {/* Modal Header */}
        <div className="absolute left-0 right-0 top-0 z-10 flex items-center justify-between bg-gradient-to-b from-black/50 to-transparent p-4">
          <button
            onClick={() => setExpandedFile(null)}
            className="rounded-full bg-white/10 p-2 text-white backdrop-blur-md transition-colors hover:bg-white/20"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

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
