"use client";

import { useState } from "react";
import { CadViewer } from "@/components/cad/cad-viewer";
import { Button } from "@/components/ui/button";
import { Upload, X, FileCode, Maximize2, Move } from "lucide-react";

export default function CadPage() {
  const [file, setFile] = useState<File | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const clearFile = () => {
    setFile(null);
  };

  return (
    <div className="flex flex-col h-screen bg-slate-50 text-slate-900">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-white/80 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-600 rounded-lg shadow-lg shadow-blue-600/20">
            <FileCode className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-semibold tracking-tight text-slate-900">
              CAD Viewer
            </h1>
            <p className="text-xs text-slate-500">Precision 3D Inspection</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {!file ? (
            <div className="relative">
              <input
                type="file"
                className="absolute inset-0 opacity-0 cursor-pointer z-10"
                onChange={handleFileChange}
                accept=".step,.stp,.stl,.obj"
              />
              <Button className="bg-blue-600 hover:bg-blue-700 text-white rounded-full px-6 shadow-lg shadow-blue-600/20 transition-all active:scale-95">
                <Upload className="w-4 h-4 mr-2" />
                Upload CAD
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-3 bg-white px-4 py-1.5 rounded-full border border-slate-200 shadow-sm">
              <span className="text-sm font-medium max-w-[200px] truncate text-slate-700">
                {file.name}
              </span>
              <button
                onClick={clearFile}
                className="p-1 hover:bg-slate-100 rounded-full transition-colors text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 relative overflow-hidden">
        {file ? (
          <div className="absolute inset-0">
            <CadViewer
              file={file}
              showControls={true}
              className="w-full h-full"
              backgroundColor="#fff"
            />
          </div>
        ) : (
          <div
            className="h-full flex flex-col items-center justify-center p-8"
            onDragOver={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            onDrop={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                setFile(e.dataTransfer.files[0]);
              }
            }}
          >
            <div className="max-w-md w-full p-12 rounded-3xl border-2 border-dashed border-slate-200 bg-white shadow-sm flex flex-col items-center text-center space-y-6 group hover:border-blue-500/50 hover:shadow-md transition-all duration-500">
              <div className="relative">
                <div className="w-20 h-20 bg-slate-50 rounded-2xl flex items-center justify-center group-hover:scale-110 group-hover:bg-blue-50 transition-all duration-500">
                  <Upload className="w-8 h-8 text-slate-400 group-hover:text-blue-600" />
                </div>
                <div className="absolute -bottom-2 -right-2 w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center shadow-lg transform scale-0 group-hover:scale-100 transition-transform duration-500 delay-100">
                  <Maximize2 className="w-4 h-4 text-white" />
                </div>
              </div>

              <div className="space-y-2">
                <h2 className="text-xl font-medium text-slate-900">
                  No Model Loaded
                </h2>
                <p className="text-sm text-slate-500 leading-relaxed">
                  Drop a STEP or STL file here to begin your high-fidelity 3D
                  analysis and inspection.
                </p>
              </div>

              <div className="relative pt-4">
                <input
                  type="file"
                  className="absolute inset-0 opacity-0 cursor-pointer z-10"
                  onChange={handleFileChange}
                  accept=".step,.stp,.stl,.obj"
                />
                <Button
                  variant="outline"
                  size="lg"
                  className="rounded-full px-8 border-slate-200 hover:bg-slate-50 text-slate-600"
                >
                  Select File
                </Button>
              </div>

              <div className="flex gap-4 pt-4 grayscale opacity-40">
                <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-900">
                  <Move className="w-3 h-3" /> Step
                </div>
                <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-900">
                  <Move className="w-3 h-3" /> Stl
                </div>
                <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-900">
                  <Move className="w-3 h-3" /> Obj
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Footer / Stats */}
      {file && (
        <footer className="px-6 py-3 border-t border-slate-200 bg-white/80 backdrop-blur-md flex items-center justify-between text-xs text-slate-600">
          <div className="flex gap-6">
            <span className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
              Engine Ready
            </span>
            <span>Size: {(file.size / (1024 * 1024)).toFixed(2)} MB</span>
            <span>Format: {file.name.split(".").pop()?.toUpperCase()}</span>
          </div>
          <div>Orbit: RMB • Pan: Shift + RMB • Zoom: Scroll</div>
        </footer>
      )}
    </div>
  );
}
