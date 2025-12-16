"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useDropzone } from "react-dropzone";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Upload,
  Sparkles,
  FileText,
  Shield,
  Clock,
  Award,
  Package,
  X,
  Loader2,
  Eye,
  ArrowRight,
  User,
  Settings,
  Layers,
  Box,
  LogOut,
} from "lucide-react";
import { getFileDownloadUrl } from "../../lib/database";
import { analyzeCADFile, GeometryData } from "../../lib/cad-analysis";
import { PricingBreakdown } from "../../lib/pricing-engine";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { signIn, signOut, useSession } from "next-auth/react";
import { setItem } from "@/lib/item-storage";
import { notify } from "@/lib/toast";
import { randomInt } from "crypto";
import ExpandFileModal from "../quote-config/components/expand-file-modal";
import { useFileUpload } from "@/lib/hooks/use-file-upload";

// Dynamically import 3D viewer to avoid SSR issues
const CadViewer3D = dynamic(() => import("@/components/viewer/CadViewer3D"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-full">
      <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
    </div>
  ),
});

interface UploadedFileData {
  file: File;
  uploadedPath: string;
  name: string;
  size: number;
  mimeType: string;
  geometry?: GeometryData;
  pricing?: PricingBreakdown;
}

export default function InstantQuotePage() {
  const router = useRouter();
  const [files, setFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [selected3DFile, setSelected3DFile] = useState<File | string | null>(
    null,
  );
  const [authMode, setAuthMode] = useState<"signin" | "signup">("signin");
  const [isAuthLoading, setIsAuthLoading] = useState(false);
  const [redirectUrl, setRedirectUrl] = useState<string>("");
  const [authForm, setAuthForm] = useState({
    email: "",
    password: "",
    name: "",
    company: "",
  });

  const session = useSession();
  const { upload } = useFileUpload();

  const onDrop = useCallback((acceptedFiles: File[]) => {
    setFiles((prev) => [...prev, ...acceptedFiles]);

    if (session.status === "unauthenticated") {
      setShowAuthModal(true);
      return;
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    onDrop,
    accept: {
      "model/stl": [".stl"],
      "model/step": [".step", ".stp"],
      "model/iges": [".iges", ".igs"],
      "application/dxf": [".dxf"],
      "image/vnd.dxf": [".dxf"],
      "application/acad": [".dwg"],
      "image/vnd.dwg": [".dwg"],
      "application/octet-stream": [
        ".stl",
        ".step",
        ".stp",
        ".iges",
        ".igs",
        ".dxf",
        ".dwg",
      ],
    },
  });

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUploadAndAuth = async () => {
    if (files.length === 0) {
      alert("Please select at least one file");
      return;
    }

    setIsUploading(true);

    try {
      // Analyze files and prepare for quote configuration
      const uploadPromises = files.map(async (file) => {
        // Analyze CAD geometry
        console.log(`Analyzing CAD file: ${file.name}`);
        const geometry = await analyzeCADFile(file);
        console.log(`Geometry analysis complete:`, geometry);

        // Upload file to Supabase
        let uploadedPath = `quotes/temp-${Date.now()}/${file.name}`;
        try {
          const { url } = await upload(file);
          uploadedPath = url;
        } catch (error) {
          console.error(`Failed to upload ${file.name}:`, error);
          notify.error(`Failed to upload ${file.name}`);
        }

        return {
          file,
          uploadedPath,
          name: file.name,
          size: file.size,
          mimeType: file.type,
          geometry,
        } as UploadedFileData;
      });

      const uploadResults = await Promise.all(uploadPromises);

      // Generate temporary quote ID (no database call to avoid 502)
      const tempQuoteId = `FRI_RFQ_${Math.floor(100000 + Math.random() * 900000)}`;

      // Store files in sessionStorage for quote-config page
      const filesData = uploadResults.map((r) => ({
        name: r.name,
        size: r.size,
        type: r.mimeType,
        geometry: r.geometry,
        path: r.uploadedPath,
      }));

      // Store metadata
      // Use IndexedDB instead of sessionStorage to handle larger files
      await Promise.all([
        setItem(`quote-${tempQuoteId}-files`, JSON.stringify(filesData)),
        setItem(`quote-${tempQuoteId}-email`, `guest-${Date.now()}@temp.quote`),
      ]);

      // Store actual file data as File objects (IndexedDB supports File/Blob natively)
      const filePromises = uploadResults.map((result, i) => {
        return setItem(`quote-${tempQuoteId}-file-${i}`, result.file);
      });

      // Wait for all files to be stored
      await Promise.all(filePromises);

      console.log(
        `Files stored in sessionStorage. Redirecting to quote config: ${tempQuoteId}`,
      );

      if (session.status === "authenticated" || session.status === "loading") {
        router.push(`/quote-config/${tempQuoteId}`);
      } else {
        setRedirectUrl(`/quote-config/${tempQuoteId}`);
        setShowAuthModal(true);
      }
    } catch (error: any) {
      console.error("Upload error:", error);
      notify.error(
        "Failed to process files: " + error.message || "Please try again",
      );
      setIsUploading(false);
    }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsAuthLoading(true);

    if (authMode === "signin") {
      const respone = await signIn("credentials", {
        email: authForm.email,
        password: authForm.password,
        redirect: false,
      });

      if (respone?.error) {
        notify.error("Error while signing in");
        return;
      }
    }

    setShowAuthModal(false);
    setIsAuthLoading(false);
    if (redirectUrl) {
      router.push(redirectUrl);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50/20 font-sans selection:bg-blue-100">
      {/* 1. Header: Clean, Simple Top Bar */}
      <header className="sticky top-0 z-50 backdrop-blur-md bg-white/70 border-b border-blue-50 h-16 transition-all duration-300">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-full flex items-center justify-between">
          {/* Left: Back to Home */}
          <Link href="/" className="flex items-center space-x-2">
            <div className="h-16 px-3 rounded flex items-center justify-center">
              <img
                src="https://frigate.ai/wp-content/uploads/2025/03/FastParts-logo-1024x351.png"
                className="aspect-video w-full h-full object-contain"
              />
            </div>
          </Link>

          {/* Right: Profile / Sign In */}
          {session.status === "authenticated" ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className="font-medium text-sm transition-all duration-300 text-slate-700 hover:bg-slate-100"
                >
                  <User className="w-4 h-4 mr-2" />
                  {session.data.user.name}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none">
                      {session.data.user.name}
                    </p>
                    <p className="text-xs leading-none text-muted-foreground">
                      {session.data.user.email}
                    </p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => signOut()}
                  className="text-red-600 cursor-pointer"
                >
                  <LogOut className="w-4 h-4 mr-2" />
                  Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button
              variant="ghost"
              onClick={() => setShowAuthModal(true)}
              className="font-medium text-sm transition-all duration-300 text-blue-700 hover:text-blue-800 hover:bg-blue-50"
            >
              Sign In
            </Button>
          )}
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {/* 2. Main Attraction: File Upload Hero */}
        <section className="relative z-10 max-w-4xl mx-auto mb-16">
          <div className="text-center mb-10">
            <h1 className="text-4xl md:text-5xl font-light text-slate-800 tracking-tight mb-4">
              Instant Pricing.{" "}
              <span className="text-blue-600 font-normal">
                Production Speed.
              </span>
            </h1>
            <p className="text-lg text-slate-500 max-w-2xl mx-auto font-light">
              Upload your CAD files to get an AI-powered manufacturability
              analysis and instant quote.
            </p>
          </div>
          <section className="max-w-4xl mx-auto mb-10 px-4">
            <div className="relative">
              {/* Progress Line - Desktop */}
              <div
                className="absolute top-6 left-0 right-0 h-0.5 bg-gradient-to-r from-blue-200 via-slate-200 to-slate-200 -z-10"
                style={{
                  left: "calc(16.66% + 24px)",
                  right: "calc(16.66% + 24px)",
                }}
              ></div>

              {/* Steps Container */}
              <div className="flex flex-row items-center justify-between gap-0">
                {/* Step 1 */}
                <div className="flex flex-col items-center group relative z-10 flex-1">
                  <div className="relative">
                    {/* Glow effect */}
                    <div className="absolute inset-0 bg-blue-400 rounded-full blur-xl opacity-20 group-hover:opacity-40 transition-opacity duration-300"></div>

                    {/* Main circle */}
                    <div className="relative w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center font-semibold text-base mb-3 shadow-lg transform group-hover:scale-110 transition-all duration-300">
                      <span className="text-white">1</span>
                    </div>
                  </div>

                  <div className="text-center">
                    <h3 className="text-sm font-semibold text-slate-800 mb-0.5 group-hover:text-blue-600 transition-colors">
                      Upload File
                    </h3>
                    <p className="text-xs text-slate-500">Instant Analysis</p>
                  </div>
                </div>

                {/* Step 2 */}
                <div className="flex flex-col items-center group relative z-10 flex-1">
                  <div className="relative">
                    {/* Glow effect */}
                    <div className="absolute inset-0 bg-slate-300 rounded-full blur-xl opacity-0 group-hover:opacity-30 transition-opacity duration-300"></div>

                    {/* Main circle */}
                    <div className="relative w-12 h-12 rounded-full bg-white border-3 border-slate-200 flex items-center justify-center font-semibold text-base mb-3 shadow-md transform group-hover:scale-110 group-hover:border-blue-400 transition-all duration-300">
                      <span className="text-slate-400 group-hover:text-blue-600 transition-colors">
                        2
                      </span>
                    </div>
                  </div>

                  <div className="text-center">
                    <h3 className="text-sm font-semibold text-slate-800 mb-0.5 group-hover:text-blue-600 transition-colors">
                      Review Quote
                    </h3>
                    <p className="text-xs text-slate-500">Real-time Pricing</p>
                  </div>
                </div>

                {/* Step 3 */}
                <div className="flex flex-col items-center group relative z-10 flex-1">
                  <div className="relative">
                    {/* Glow effect */}
                    <div className="absolute inset-0 bg-slate-300 rounded-full blur-xl opacity-0 group-hover:opacity-30 transition-opacity duration-300"></div>

                    {/* Main circle */}
                    <div className="relative w-12 h-12 rounded-full bg-white border-3 border-slate-200 flex items-center justify-center font-semibold text-base mb-3 shadow-md transform group-hover:scale-110 group-hover:border-blue-400 transition-all duration-300">
                      <span className="text-slate-400 group-hover:text-blue-600 transition-colors">
                        3
                      </span>
                    </div>
                  </div>

                  <div className="text-center">
                    <h3 className="text-sm font-semibold text-slate-800 mb-0.5 group-hover:text-blue-600 transition-colors">
                      Place Order
                    </h3>
                    <p className="text-xs text-slate-500">Start Production</p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <div
            className={`
              relative group rounded-3xl p-1
              cursor-pointer
              bg-gradient-to-br from-white/80 to-white/40
              backdrop-blur-xl border border-white/50 shadow-[0_8px_32px_rgba(0,0,0,0.04)]
              transition-all duration-500
              ${isUploading ? "opacity-90 pointer-events-none" : "hover:shadow-[0_12px_48px_rgba(37,99,235,0.08)]"}
            `}
          >
            {/* Inner Upload Zone */}
            <div
              {...getRootProps()}
              className={`
                bg-white/50 rounded-[22px] min-h-[400px] flex flex-col items-center justify-center p-8
                border-2 border-dashed border-slate-200 
                transition-all duration-300
                ${isDragActive ? "border-blue-500 bg-blue-50/10" : "hover:border-blue-400 group-hover:bg-white/80"}
              `}
            >
              <input {...getInputProps()} />

              {isDragActive && (
                <div className="absolute inset-0 z-50 bg-blue-50/90 backdrop-blur-sm rounded-[22px] flex items-center justify-center border-2 border-blue-500 border-dashed animate-in fade-in duration-200">
                  <div className="text-center">
                    <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4 animate-bounce">
                      <Upload className="w-8 h-8 text-blue-600" />
                    </div>
                    <h3 className="text-2xl font-semibold text-blue-700">
                      Drop files here
                    </h3>
                    <p className="text-blue-500 mt-2">to instantly upload</p>
                  </div>
                </div>
              )}

              {files.length === 0 ? (
                /* Empty State */
                <div className="text-center space-y-6 animate-in fade-in zoom-in-95 duration-500 relative z-10">
                  <div className="relative inline-flex mb-4 group-hover:scale-105 transition-transform duration-300">
                    <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center shadow-inner">
                      <Upload className="w-8 h-8 text-blue-600" />
                    </div>
                    <div className="absolute -top-1 -right-1 w-6 h-6 bg-white rounded-full flex items-center justify-center shadow-md">
                      <Sparkles className="w-3 h-3 text-amber-400" />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <h3 className="text-xl font-medium text-slate-800">
                      Drag & Drop Your CAD Files
                    </h3>
                    <p className="text-sm text-slate-400">
                      Supports STEP, IGES, STL, DXF • Max 50MB
                    </p>
                  </div>

                  <div className="pt-2">
                    <Button
                      size="lg"
                      className="bg-blue-600 hover:bg-blue-700 text-white rounded-full px-8 h-12 shadow-lg shadow-blue-600/20 hover:shadow-blue-600/30 transition-all active:scale-95"
                    >
                      Browse Files
                    </Button>
                  </div>
                </div>
              ) : (
                /* File List State */
                <div className="w-full max-w-2xl mx-auto space-y-4 animate-in slide-in-from-bottom-4 duration-500">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-slate-600 font-medium flex items-center gap-2">
                      <FileText className="w-4 h-4" />
                      {files.length} Files Selected
                    </h3>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        setFiles([]);
                      }}
                      className="text-red-400 hover:text-red-600 hover:bg-red-50 text-xs"
                    >
                      Clear All
                    </Button>
                  </div>

                  <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                    {files.map((file, idx) => {
                      const canPreview = ["stl", "step", "stp", "obj"].includes(
                        file.name.toLowerCase().split(".").pop() || "",
                      );
                      return (
                        <div
                          key={idx}
                          className="flex items-center justify-between p-4 bg-white rounded-xl border border-slate-100 shadow-sm hover:shadow-md transition-all group/file"
                        >
                          <div className="flex items-center gap-4 overflow-hidden">
                            <div className="w-10 h-10 rounded-lg bg-slate-50 flex items-center justify-center flex-shrink-0 text-slate-400 group-hover/file:text-blue-600 group-hover/file:bg-blue-50 transition-colors">
                              <Package className="w-5 h-5" />
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-slate-700 truncate">
                                {file.name}
                              </p>
                              <p className="text-xs text-slate-400">
                                {(file.size / (1024 * 1024)).toFixed(2)} MB
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            {canPreview && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-slate-400 hover:text-blue-600 hover:bg-blue-50"
                                title="3D Preview"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelected3DFile(file);
                                }}
                              >
                                <Eye className="w-4 h-4" />
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-slate-300 hover:text-red-500 hover:bg-red-50"
                              onClick={(e) => {
                                e.stopPropagation();
                                removeFile(idx);
                              }}
                            >
                              <X className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div
                    className="pt-6 flex flex-col sm:flex-row gap-3 justify-end border-t border-slate-100 mt-4"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Button
                      variant="outline"
                      className="w-full sm:w-auto text-slate-600"
                      onClick={open}
                    >
                      Add More
                    </Button>
                    <Button
                      onClick={handleUploadAndAuth}
                      disabled={isUploading}
                      className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-600/20"
                    >
                      {isUploading ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Analysing Geometry...
                        </>
                      ) : (
                        <>
                          Get Quote
                          <ArrowRight className="w-4 h-4 ml-2" />
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {/* Corner Decorations */}
            <div className="absolute top-0 left-0 -ml-4 -mt-4 w-24 h-24 bg-gradient-to-br from-blue-100/50 to-transparent rounded-full blur-2xl -z-10 opacity-60" />
            <div className="absolute bottom-0 right-0 -mr-4 -mb-4 w-32 h-32 bg-gradient-to-tl from-blue-100/50 to-transparent rounded-full blur-2xl -z-10 opacity-60" />
          </div>
        </section>

        {/* 3. Trusted By Strip (Subtler) */}
        <div className="mb-20 text-center opacity-70">
          <p className="text-xs font-semibold text-slate-400 mb-6 uppercase tracking-widest">
            Trusted By
          </p>
          <div className="flex flex-wrap justify-center gap-8 md:gap-16 opacity-50 grayscale hover:grayscale-0 transition-all duration-700">
            <img
              src="https://frigate.ai/wp-content/uploads/2024/04/Reliance-1-150x90.png"
              alt="Reliance"
              className="aspect-auto h-20"
            />
            <img
              src="https://frigate.ai/wp-content/uploads/2024/04/TATA-1-1-150x90.png"
              alt="TATA"
              className="aspect-auto h-20"
            />
            <img
              src="https://frigate.ai/wp-content/uploads/2024/07/Indian-oil-logo-300x113.png"
              alt=""
              className="aspect-auto h-20"
            />
            <img
              src="https://frigate.ai/wp-content/uploads/2024/07/MRG-logo-300x113.png"
              alt=""
              className="aspect-auto h-20"
            />
          </div>
        </div>

        {/* 5. Bento Grid Layout */}
        <section className="mb-24 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Box 1: Capabilities (Large) */}
          <div className="lg:col-span-2 bg-white rounded-3xl p-8 border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex flex-col h-full">
              <div className="mb-6">
                <h2 className="text-2xl font-light text-slate-800">
                  Manufacturing Capabilities
                </h2>
                <p className="text-slate-500 text-sm mt-2">
                  Comprehensive solutions for every stage of development.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 flex-grow">
                {[
                  {
                    icon: Settings,
                    title: "CNC Machining",
                    desc: "Start to finish precision, ±0.005mm.",
                  },
                  {
                    icon: Layers,
                    title: "Vacuum Casting",
                    desc: "Production molds for scalable plastics.",
                  },
                  {
                    icon: Box,
                    title: "Sheet Metal",
                    desc: "Laser cutting & bending for durable parts.",
                  },
                  {
                    icon: Package,
                    title: "Injection Molding",
                    desc: "Production molds for scalable plastics.",
                  },
                ].map((item, i) => (
                  <div
                    key={i}
                    className="p-4 rounded-xl bg-slate-50 border border-slate-100 hover:border-blue-200 hover:bg-blue-50/30 transition-colors group"
                  >
                    <div className="flex items-center gap-3 mb-2">
                      <div className="p-2 bg-white rounded-lg shadow-sm text-blue-600 group-hover:text-blue-700">
                        <item.icon className="w-4 h-4" />
                      </div>
                      <span className="font-semibold text-slate-700 text-sm">
                        {item.title}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 leading-relaxed pl-1">
                      {item.desc}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Box 2: Quality (Tall) */}
          <div className="bg-gradient-to-b from-slate-900 to-slate-800 text-white rounded-3xl p-8 shadow-xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/20 rounded-full blur-3xl -mr-16 -mt-16 group-hover:bg-blue-500/30 transition-colors"></div>

            <div className="relative z-10 h-full flex flex-col justify-between space-y-8">
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/20 text-blue-300 text-xs font-medium mb-4 border border-blue-500/20">
                  <Award className="w-3 h-3" /> Premium Quality
                </div>
                <h3 className="text-2xl font-light leading-tight">
                  ISO 9001
                  <br />
                  <span className="font-semibold text-blue-400">
                    Certified Precision
                  </span>
                </h3>
              </div>

              <div className="space-y-6">
                <div className="flex gap-4">
                  <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0">
                    <Clock className="w-5 h-5 text-blue-300" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">Lightning Fast</p>
                    <p className="text-xs text-slate-400 mt-1">
                      Standard lead times from 3 days. Rush options available.
                    </p>
                  </div>
                </div>
                <div className="flex gap-4">
                  <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0">
                    <Shield className="w-5 h-5 text-purple-300" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">Full IP Protection</p>
                    <p className="text-xs text-slate-400 mt-1">
                      Strict NDAs and encrypted storage for your designs.
                    </p>
                  </div>
                </div>
              </div>

              <Button
                variant="outline"
                className="w-full transition-transform duration-300 ease-in-out border-white/20 bg-white/10 text-white hover:scale-105"
              >
                View Certifications
              </Button>
            </div>
          </div>
        </section>

        {/* Footer Area - Minimal */}
        <footer className="border-t border-slate-100 pt-8 mt-12 text-center text-slate-400 text-sm">
          <div className="flex justify-center gap-6 mb-4">
            <Link href="#" className="hover:text-blue-600 transition-colors">
              Privacy
            </Link>
            <Link href="#" className="hover:text-blue-600 transition-colors">
              Terms
            </Link>
            <Link href="#" className="hover:text-blue-600 transition-colors">
              Support
            </Link>
          </div>
          <p>© 2025 Frigate Engineering Services. Secure & Confidential.</p>
        </footer>
      </main>

      {/* Auth Modal - Preserves functionality, updates style */}
      <Dialog open={showAuthModal} onOpenChange={setShowAuthModal}>
        <DialogContent
          onInteractOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
          className="sm:max-w-md border-0 shadow-2xl bg-white/95 backdrop-blur-md"
        >
          <DialogHeader>
            <DialogTitle className="text-2xl font-light text-center mb-2">
              {authMode === "signup" ? "Create Account" : "Welcome Back"}
            </DialogTitle>
            <DialogDescription className="text-center">
              {authMode === "signup"
                ? "Save your quotes and track your orders."
                : "Sign in to access your quotes and orders."}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleAuth} className="space-y-4 mt-4">
            {authMode === "signup" && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Name</Label>
                  <Input
                    id="name"
                    placeholder="John Doe"
                    value={authForm.name}
                    onChange={(e) =>
                      setAuthForm((prev) => ({ ...prev, name: e.target.value }))
                    }
                    className="bg-slate-50 border-slate-200 focus:border-blue-500 focus:ring-blue-500/20"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="company">Company</Label>
                  <Input
                    id="company"
                    placeholder="Acme Inc."
                    value={authForm.company}
                    onChange={(e) =>
                      setAuthForm((prev) => ({
                        ...prev,
                        company: e.target.value,
                      }))
                    }
                    className="bg-slate-50 border-slate-200 focus:border-blue-500 focus:ring-blue-500/20"
                  />
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@company.com"
                value={authForm.email}
                onChange={(e) =>
                  setAuthForm((prev) => ({ ...prev, email: e.target.value }))
                }
                className="bg-slate-50 border-slate-200 focus:border-blue-500 focus:ring-blue-500/20"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={authForm.password}
                onChange={(e) =>
                  setAuthForm((prev) => ({ ...prev, password: e.target.value }))
                }
                className="bg-slate-50 border-slate-200 focus:border-blue-500 focus:ring-blue-500/20"
                required
              />
            </div>

            <Button
              type="submit"
              loading={isAuthLoading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium h-11"
            >
              {authMode === "signup" ? "Create Account" : "Sign In"}
            </Button>

            <div className="text-center text-white text-sm pt-2">
              {authMode === "signup" ? (
                <p className="text-slate-500">
                  Already have an account?{" "}
                  <Button
                    type="button"
                    variant="link"
                    onClick={() => {
                      setAuthMode("signin");
                      setShowAuthModal(true);
                    }}
                    className="text-blue-600 hover:text-blue-700 hover:underline font-medium p-0 h-auto"
                  >
                    Sign in
                  </Button>
                </p>
              ) : (
                <p className="text-slate-500">
                  Don't have an account?{" "}
                  <Button
                    type="button"
                    variant="link"
                    onClick={() => {
                      setAuthMode("signup");
                      setShowAuthModal(true);
                    }}
                    className="text-blue-600 hover:text-blue-700 hover:underline font-medium p-0 h-auto"
                  >
                    Sign up
                  </Button>
                </p>
              )}
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* 3D Viewer Dialog */}
      {selected3DFile && (
        <ExpandFileModal
          expandedFile={selected3DFile}
          setExpandedFile={setSelected3DFile}
        />
      )}
    </div>
  );
}
