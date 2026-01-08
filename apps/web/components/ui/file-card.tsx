import React, { useState } from "react";
import { FileText, Download, MoreVertical, Trash2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { format } from "date-fns";
import { CadViewer } from "@/components/cad/cad-viewer";
import { notify } from "@/lib/toast";
import { useFileUpload } from "@/lib/hooks/use-file-upload";
import { apiClient } from "@/lib/api";
import { cn } from "@/lib/utils";

interface FileCardProps {
  rfqId: string;
  partId: string;
  fileName: string;
  fileSize?: string;
  uploadedAt: string;
  fileType: string;
  thumbnailUrl?: string; // This is the snapshot_2d_url
  cadFileUrl?: string;
  onDownload?: () => void;
  onPreview?: () => void;
  onDelete?: () => void;
  isSelected?: boolean;
  onSelect?: (selected: boolean) => void;
}

export const FileCard: React.FC<FileCardProps> = ({
  rfqId,
  partId,
  fileName,
  fileSize,
  uploadedAt,
  fileType,
  thumbnailUrl,
  cadFileUrl,
  onDownload,
  onPreview,
  onDelete,
  isSelected,
  onSelect,
}) => {
  const [snapshot, setSnapshot] = useState<string | null>(null);
  const { uploadBase64 } = useFileUpload();
  const displayUrl = thumbnailUrl || snapshot;

  return (
    <div
      onClick={onPreview}
      className={cn(
        "group relative bg-white dark:bg-neutral-900 rounded-2xl border p-4 hover:shadow-xl transition-all duration-300 hover:-translate-y-1 cursor-pointer",
        isSelected
          ? "border-primary ring-1 ring-primary shadow-lg bg-primary/5"
          : "border-slate-200 dark:border-neutral-800",
      )}
    >
      {/* Selection Checkbox */}
      <div
        className={cn(
          "absolute top-3 left-3 z-10 transition-opacity duration-200",
          isSelected ? "opacity-100" : "opacity-0 group-hover:opacity-100",
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <input
          type="checkbox"
          checked={isSelected}
          onChange={(e) => onSelect?.(e.target.checked)}
          className="w-5 h-5 rounded-md border-slate-300 text-primary focus:ring-primary cursor-pointer"
        />
      </div>
      {/* Image/CAD Viewer Section */}
      <div className="aspect-video w-full overflow-hidden rounded-xl bg-slate-50 dark:bg-neutral-800/50 mb-4 border border-slate-100 dark:border-neutral-800/50 flex items-center justify-center">
        {displayUrl ? (
          <img
            src={displayUrl}
            alt={fileName}
            className="w-full h-full object-contain"
          />
        ) : cadFileUrl ? (
          <div className="w-full h-full relative">
            <CadViewer
              file={cadFileUrl}
              {...(!thumbnailUrl && {
                onSnapshot: async (snap) => {
                  try {
                    const { url } = await uploadBase64(
                      snap,
                      `${fileName}-snapshot.png`,
                    );
                    await apiClient.post(
                      `/rfq/${rfqId}/part/${partId}/upload-snapshot`,
                      {
                        snapshot: url,
                      },
                    );
                    notify.success("Snapshot uploaded successfully");
                    setSnapshot(url);
                  } catch (error) {
                    notify.error("Failed to generate snapshot");
                    console.error(error);
                  }
                },
              })}
              zoom={0.8}
            />
          </div>
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-slate-100 dark:bg-neutral-800">
            <FileText className="w-10 h-10 text-slate-400 group-hover:text-primary transition-colors" />
          </div>
        )}
      </div>

      <div className="flex items-start justify-between mb-2">
        <div className="flex-1 min-w-0">
          <h3
            className="font-bold text-slate-800 dark:text-white truncate text-sm"
            title={fileName}
          >
            {fileName}
          </h3>
          <div className="flex items-center gap-2 text-[10px] font-medium text-slate-500 dark:text-neutral-400 mt-1 uppercase tracking-wider">
            <span className="bg-slate-100 dark:bg-neutral-800 px-1.5 py-0.5 rounded text-slate-600 dark:text-neutral-300">
              {fileType}
            </span>
            <span>•</span>
            <span>{format(new Date(uploadedAt), "MMM d, yyyy")}</span>
            {fileSize && (
              <>
                <span>•</span>
                <span>{fileSize}</span>
              </>
            )}
          </div>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              onClick={(e) => e.stopPropagation()}
              className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-neutral-200 hover:bg-slate-100 dark:hover:bg-neutral-800 rounded-lg transition-all"
            >
              <MoreVertical className="w-4 h-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-40">
            <DropdownMenuItem
              onClick={(e) => {
                e.stopPropagation();
                onDownload?.();
              }}
            >
              <Download className="w-4 h-4 mr-2" />
              Download
            </DropdownMenuItem>
            {onDelete && (
              <DropdownMenuItem
                className="text-red-600 focus:text-red-600"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete?.();
                }}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
};
