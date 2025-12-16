"use client";

import { useEffect, useState } from "react";
import {
  X,
  ZoomIn,
  ZoomOut,
  Download,
  ChevronLeft,
  ChevronRight,
  FileText,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

// Configure PDF.js worker only in browser environment
if (typeof window !== "undefined") {
  pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
}

interface PdfViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  pdfSrc: string;
  fileName?: string;
}

export function PdfViewerModal({
  isOpen,
  onClose,
  pdfSrc,
  fileName = "Document",
}: PdfViewerModalProps) {
  const [numPages, setNumPages] = useState<number>(0);
  const [pageNumber, setPageNumber] = useState(1);
  const [scale, setScale] = useState(1.0);
  const [isLoading, setIsLoading] = useState(true);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setPageNumber(1);
      setScale(1.0);
      setIsLoading(true);
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }

    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen, pdfSrc]);

  // Handle ESC key to close
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleZoomIn = () => setScale((prev) => Math.min(prev + 0.2, 3.0));
  const handleZoomOut = () => setScale((prev) => Math.max(prev - 0.2, 0.5));
  const handleResetZoom = () => setScale(1.0);

  const handleDownload = async () => {
    try {
      const response = await fetch(pdfSrc);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${fileName}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Download failed:", error);
    }
  };

  const goToPrevPage = () => {
    setPageNumber((prev) => Math.max(prev - 1, 1));
  };

  const goToNextPage = () => {
    setPageNumber((prev) => Math.min(prev + 1, numPages));
  };

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
    setIsLoading(false);
  };

  const onDocumentLoadError = (error: Error) => {
    console.error("PDF load error:", error);
    setIsLoading(false);
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col bg-black/95 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      {/* Top Toolbar */}
      <div className="flex-shrink-0 p-4 flex justify-between items-center border-b border-white/10">
        <div className="flex items-center gap-3 text-white/90 text-sm font-medium">
          <div className="p-2 bg-blue-500/20 rounded-lg">
            <FileText className="w-5 h-5 text-blue-400" />
          </div>
          <div>
            <p className="font-semibold">{fileName}</p>
            <p className="text-xs text-white/60">
              {numPages > 0 ? `${numPages} pages` : "PDF Document"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={handleDownload}
            className="text-white hover:bg-white/10 rounded-lg h-10 w-10"
            title="Download PDF"
          >
            <Download className="w-5 h-5" />
          </Button>
          <div className="w-px h-6 bg-white/20 mx-1" />
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="text-white hover:bg-red-500/80 hover:text-white rounded-lg h-10 w-10"
            title="Close (ESC)"
          >
            <X className="w-5 h-5" />
          </Button>
        </div>
      </div>

      {/* Main PDF Container */}
      <div className="flex-1 overflow-auto bg-slate-900 p-4 flex items-center justify-center">
        {isLoading && (
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
            <p className="text-white/60 text-sm">Loading PDF...</p>
          </div>
        )}
        <Document
          file={pdfSrc}
          onLoadSuccess={onDocumentLoadSuccess}
          onLoadError={onDocumentLoadError}
          loading={null}
          className="flex items-center justify-center"
        >
          <Page
            pageNumber={pageNumber}
            scale={scale}
            renderTextLayer={true}
            renderAnnotationLayer={true}
            className="shadow-2xl bg-white"
            loading={
              <div className="flex items-center justify-center p-8">
                <Loader2 className="w-6 h-6 text-blue-400 animate-spin" />
              </div>
            }
          />
        </Document>
      </div>

      {/* Bottom Controls Bar */}
      <div className="flex-shrink-0 p-4 border-t border-white/10">
        <div className="max-w-2xl mx-auto bg-black/60 backdrop-blur-xl border border-white/10 rounded-full px-6 py-3 flex items-center justify-between gap-4 shadow-2xl">
          {/* Zoom Controls */}
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={handleZoomOut}
              disabled={scale <= 0.5}
              className="text-white/90 hover:bg-white/20 hover:text-white rounded-full h-9 w-9 disabled:opacity-30"
              title="Zoom Out"
            >
              <ZoomOut className="w-4 h-4" />
            </Button>

            <Button
              variant="ghost"
              onClick={handleResetZoom}
              className="text-white/60 hover:text-white hover:bg-white/10 text-xs font-mono min-w-[70px] h-9 rounded-full px-3"
              title="Reset Zoom"
            >
              {Math.round(scale * 100)}%
            </Button>

            <Button
              variant="ghost"
              size="icon"
              onClick={handleZoomIn}
              disabled={scale >= 3.0}
              className="text-white/90 hover:bg-white/20 hover:text-white rounded-full h-9 w-9 disabled:opacity-30"
              title="Zoom In"
            >
              <ZoomIn className="w-4 h-4" />
            </Button>
          </div>

          {/* Page Navigation */}
          {numPages > 1 && (
            <>
              <div className="w-px h-5 bg-white/20" />
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={goToPrevPage}
                  disabled={pageNumber <= 1}
                  className="text-white/90 hover:bg-white/20 hover:text-white rounded-full h-9 w-9 disabled:opacity-30"
                  title="Previous Page"
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>

                <span className="text-white/80 text-sm font-medium min-w-[80px] text-center">
                  Page {pageNumber} / {numPages}
                </span>

                <Button
                  variant="ghost"
                  size="icon"
                  onClick={goToNextPage}
                  disabled={pageNumber >= numPages}
                  className="text-white/90 hover:bg-white/20 hover:text-white rounded-full h-9 w-9 disabled:opacity-30"
                  title="Next Page"
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
