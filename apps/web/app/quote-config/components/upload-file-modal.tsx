"use client";

import { Upload } from "lucide-react";
import React, { useCallback } from "react";
import { useDropzone } from "react-dropzone";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { PartConfig } from "../[id]/page";
import { analyzeCADFile } from "@/lib/cad-analysis";

type UploadFileModalProps = {
  open: boolean;
  setOpen: (value: boolean) => void;
  parts: PartConfig[];
  setParts: React.Dispatch<React.SetStateAction<PartConfig[]>>;
};

import { useFileUpload } from "@/lib/hooks/use-file-upload";
import { notify } from "@/lib/toast";

const UploadFileModal = ({
  open,
  setOpen,
  parts,
  setParts,
}: UploadFileModalProps) => {
  const { upload } = useFileUpload();

  const onDropFiles = useCallback(
    async (acceptedFiles: File[]) => {
      if (acceptedFiles.length === 0) return;

      const newParts: PartConfig[] = [];

      for (const file of acceptedFiles) {
        let uploadedPath = `temp/${file.name}`;
        try {
          const { url } = await upload(file);
          uploadedPath = url;
        } catch (error) {
          console.error("File upload failed:", error);
          notify.error(`Failed to upload ${file.name}`);
        }

        const geometry = await analyzeCADFile(file);

        const newPart: PartConfig = {
          id: `part-${parts.length + newParts.length + 1}`,
          fileName: file.name,
          filePath: uploadedPath,
          fileObject: file,
          material: "aluminum-6061",
          quantity: 1,
          tolerance: "standard",
          finish: "as-machined",
          threads: "none",
          inspection: "standard",
          notes: "",
          leadTimeType: "standard",
          geometry,
          pricing: undefined,
          files2d: [],
        };

        newParts.push(newPart);
      }

      setParts([...newParts]);

      // Close modal after upload
      setOpen(false);
    },
    [parts.length, setOpen, upload],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: onDropFiles,
    multiple: true,
    accept: {
      "model/stl": [".stl"],
      "model/step": [".step", ".stp"],
      "application/octet-stream": [".stl", ".step", ".stp"],
      "application/sla": [".stl"],
      "application/vnd.ms-pki.stl": [".stl"],
      "application/iges": [".iges", ".igs"],
      "image/vnd.dxf": [".dxf"],
      "image/vnd.dwg": [".dwg"],
      "model/x.stl-binary": [".stl"],
      "application/x-navistyle": [".x_t", ".x_b"],
      "model/obj": [".obj"],
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent
        className="max-w-xl p-0 overflow-hidden"
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader className="px-6 pt-6">
          <DialogTitle className="text-xl font-bold">New Quote</DialogTitle>
        </DialogHeader>

        <div className="pt-4 w-full px-6 pb-8">
          <div
            {...getRootProps()}
            className={`bg-gradient-to-br from-white to-slate-50/80 rounded-2xl border-2 shadow-sm overflow-hidden transition-all duration-300 cursor-pointer ${
              isDragActive
                ? "border-blue-500 border-dashed bg-blue-50/50 shadow-lg scale-[1.01]"
                : "border-slate-200 hover:border-blue-400 border-dashed hover:shadow-md"
            }`}
          >
            <input {...getInputProps()} />

            {/* Upload Area */}
            <div className="p-8 flex flex-col items-center justify-center gap-4 text-center border-b border-slate-200">
              <div
                className={`p-4 bg-gradient-to-br rounded-2xl transition-all shadow-sm ${
                  isDragActive
                    ? "from-blue-200 to-blue-100 scale-110"
                    : "from-blue-50 to-slate-50"
                }`}
              >
                <Upload
                  className={`w-10 h-10 transition-colors ${
                    isDragActive ? "text-blue-700" : "text-blue-600"
                  }`}
                />
              </div>

              <div>
                <p
                  className={`font-bold text-xl mb-2 transition-colors ${
                    isDragActive ? "text-blue-700" : "text-slate-900"
                  }`}
                >
                  {isDragActive
                    ? "Drop your files here"
                    : "Start by uploading a part"}
                </p>
                <p className="text-sm text-slate-500 max-w-xs mx-auto">
                  {isDragActive
                    ? "Release to upload your CAD files"
                    : "Click to upload or drag and drop your CAD files here"}
                </p>
              </div>

              <div className="flex flex-wrap gap-2 justify-center mt-2">
                {["STEP", "STL", "IGES", "OBJ", "and more"].map((ext) => (
                  <span
                    key={ext}
                    className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                      isDragActive
                        ? "bg-blue-200 text-blue-800"
                        : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {ext}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default UploadFileModal;
