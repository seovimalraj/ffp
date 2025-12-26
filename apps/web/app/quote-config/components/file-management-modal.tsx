import React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Upload } from "lucide-react";
import { FileText } from "lucide-react";
import { Maximize2 } from "lucide-react";
import { Trash2 } from "lucide-react";
import { Loader2 } from "lucide-react";
import { FileIcon } from "lucide-react";
import { File2D, PartConfig } from "@/types/part-config";

type FileManagementModalProps = {
  isFilesModalOpen: boolean;
  setIsFilesModalOpen: (open: boolean) => void;
  part: PartConfig;
  isUploading: boolean;
  handleFileClick: (file2d: File2D) => void;
  handleDeleteFile: (fileIndex: number) => void;
  getRootProps: () => any;
  getInputProps: () => any;
};

const FileManagementModal = ({
  isFilesModalOpen,
  setIsFilesModalOpen,
  part,
  isUploading,
  handleFileClick,
  handleDeleteFile,
  getRootProps,
  getInputProps,
}: FileManagementModalProps) => {
  return (
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
  );
};

export default FileManagementModal;
