"use client";

import React, { useEffect, useState, useRef } from "react";
import { useFileUpload } from "@/lib/hooks/use-file-upload";
import { apiClient } from "@/lib/api";
import { Button } from "@/src/components/ui/button";
import { Card, CardContent } from "@/src/components/ui/card";
import {
  FileIcon,
  UploadIcon,
  Loader2,
  FileText,
  Download,
  Paperclip,
  Eye,
  MoreVertical,
  Globe,
  User,
  Building,
} from "lucide-react";
import { useToast } from "@/src/components/ui/use-toast";
import { format } from "date-fns";
import { useSession } from "next-auth/react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/src/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/src/components/ui/dropdown-menu";
import { Input } from "@/src/components/ui/input";
import { Label } from "@/src/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/src/components/ui/select";
import { PdfViewerModal } from "@/components/pdf-viewer-modal";
import { notify } from "@/lib/toast";
import RoleCheck from "@/components/auth/role-check";

type Document = {
  id: string;
  file_name: string;
  document_type: string;
  document_url: string;
  created_at: string;
  uploaded_by: string;
  mime_type: string;
  visibility: string;

  users?: {
    name: string;
    email: string;
    organizations: {
      name: string;
    };
  };
};

type DocumentsProps = {
  orderId: string;
  inView: boolean;
};

const DOCUMENT_TYPES = [
  { value: "technical_drawing", label: "Technical Drawing" },
  { value: "quality_inspection", label: "Quality Inspection" },
  { value: "compliance", label: "Compliance" },
  { value: "logistics", label: "Logistics" },
  { value: "finance", label: "Finance" },
  { value: "other", label: "Other" },
];

const VISIBILITY_TYPES = [
  { value: "customer", label: "Customer" },
  { value: "supplier", label: "Supplier" },
  { value: "global", label: "Global" },
];

const Documents = ({ orderId, inView }: DocumentsProps) => {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { upload, isUploading, progress } = useFileUpload();
  const { toast } = useToast();
  const { data: session } = useSession();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [docName, setDocName] = useState("");
  const [docType, setDocType] = useState("technical_drawing");
  const [docVisibility, setDocVisibility] = useState("global");

  // PDF Viewer State
  const [pdfViewer, setPdfViewer] = useState<{
    isOpen: boolean;
    url: string;
    name: string;
  }>({
    isOpen: false,
    url: "",
    name: "",
  });

  useEffect(() => {
    setDocVisibility(session?.user?.role ?? "global");
  }, [session]);

  const fetchDocuments = async () => {
    try {
      setIsLoading(true);
      const response = await apiClient.get(`/orders/${orderId}/documents`);
      setDocuments(response.data);
    } catch (error) {
      console.error("Error fetching documents:", error);
      toast({
        title: "Error",
        description: "Failed to fetch documents",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (inView) {
      fetchDocuments();
    }
  }, [orderId, inView]);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setPendingFile(file);
    setDocName(file.name);
    setDocType("other");
    setIsModalOpen(true);
  };

  const handleConfirmUpload = async () => {
    if (!pendingFile) return;

    try {
      const uploadRes = await upload(pendingFile);
      console.log("here", uploadRes);
      // Create document record in database
      await apiClient.post(`/orders/${orderId}/documents`, {
        document_type: docType,
        document_url: uploadRes.url,
        file_name: docName || pendingFile.name,
        mime_type: pendingFile.type,
        uploaded_by: session?.user?.id,
        visibility: docVisibility,
      });

      toast({
        title: "Success",
        description: "Document uploaded successfully",
      });

      fetchDocuments();
      handleCloseModal();
    } catch (error) {
      console.error("Error uploading document:", error);
      toast({
        title: "Upload Failed",
        description: "There was an error uploading your document",
        variant: "destructive",
      });
    }
  };

  const handleUpdateVisibility = async (docId: string, visibility: string) => {
    try {
      await apiClient.patch(`/orders/${docId}/documents`, { visibility });
      toast({
        title: "Success",
        description: "Visibility updated successfully",
      });
      fetchDocuments();
    } catch (error) {
      console.error("Error updating visibility:", error);
      toast({
        title: "Error",
        description: "Failed to update visibility",
        variant: "destructive",
      });
    }
  };

  const handleDownload = async (fileUrl: string, fileName: string) => {
    const response = await fetch(fileUrl);
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    const type = blob.type.split("/")[1];
    link.download = `${fileName}.${type}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setPendingFile(null);
    setDocName("");
    setDocType("other");
    setDocVisibility(
      session?.user.role === "admin"
        ? "global"
        : session?.user.role || "global",
    );
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const getFileIcon = (mimeType: string) => {
    if (mimeType.includes("pdf"))
      return (
        <div className="bg-rose-50 p-4 rounded-2xl">
          <FileText className="h-12 w-12 text-rose-500" />
        </div>
      );
    if (mimeType.includes("image"))
      return (
        <div className="bg-sky-50 p-4 rounded-2xl">
          <FileIcon className="h-12 w-12 text-sky-500" />
        </div>
      );
    return (
      <div className="bg-slate-100 p-4 rounded-2xl">
        <FileIcon className="h-12 w-12 text-slate-400" />
      </div>
    );
  };

  const openPdfViewer = (url: string, name: string) => {
    setPdfViewer({
      isOpen: true,
      url,
      name,
    });
  };

  if (isLoading && documents.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-4">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
        <p className="text-sm text-slate-500 font-medium">
          Loading documents...
        </p>
      </div>
    );
  }

  const description =
    session?.user?.role === "admin"
      ? "Manage and view files associated with this order"
      : "View files associated with this order";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900 border-l-4 border-indigo-600 pl-3">
            Order Documents
          </h2>
          <p className="text-sm text-slate-500 mt-1">{description}</p>
        </div>
        <div>
          <input
            type="file"
            className="hidden"
            ref={fileInputRef}
            onChange={handleFileSelect}
          />
          <Button
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-md transition-all active:scale-95"
          >
            {isUploading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Uploading ({progress}%)
              </>
            ) : (
              <>
                <UploadIcon className="mr-2 h-4 w-4" />
                Upload Document
              </>
            )}
          </Button>
        </div>
      </div>

      {documents.length === 0 ? (
        <Card
          className="border-dashed border-2 bg-slate-50/50 hover:bg-slate-50 transition-colors cursor-pointer"
          onClick={() => fileInputRef.current?.click()}
        >
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="bg-white p-5 rounded-full shadow-sm mb-4 border border-slate-100">
              <Paperclip className="h-10 w-10 text-slate-300" />
            </div>
            <h3 className="text-base font-semibold text-slate-900">
              No documents yet
            </h3>
            <p className="text-sm text-slate-500 max-w-xs mt-2">
              Attach drawings, certifications, or invoices for this order to
              keep everything in one place.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {documents.map((doc) => (
            <Card
              key={doc.id}
              className="group overflow-hidden hover:shadow-xl transition-all duration-300 border-slate-200/60 hover:border-indigo-200 flex flex-col h-full bg-white ring-1 ring-slate-200/50 hover:ring-indigo-200/50"
            >
              <CardContent className="p-0 flex flex-col h-full">
                {/* Preview Area */}
                <div className="p-6 bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center aspect-[16/10] relative overflow-hidden group-hover:from-indigo-50 group-hover:to-indigo-50/30 transition-colors duration-500">
                  <div className="transform group-hover:scale-110 transition-transform duration-500">
                    {getFileIcon(doc.mime_type)}
                  </div>

                  {/* Quick View Overlay (for PDFs) */}
                  {doc.mime_type.includes("pdf") && (
                    <div className="absolute inset-0 bg-indigo-900/10 backdrop-blur-[2px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300">
                      <Button
                        size="sm"
                        variant="secondary"
                        className="bg-white text-indigo-600 font-semibold shadow-xl border-none active:scale-95 hover:bg-white hover:text-indigo-700"
                        onClick={() =>
                          openPdfViewer(doc.document_url, doc.file_name)
                        }
                      >
                        <Eye className="w-4 h-4 mr-2" />
                        Quick View
                      </Button>
                    </div>
                  )}

                  {/* Type Badge - Top Right */}
                  <div className="absolute top-3 right-3 flex items-center gap-2">
                    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold bg-white/90 backdrop-blur-md text-slate-600 shadow-sm border border-slate-100 uppercase tracking-wider">
                      {doc.document_type.replace("_", " ")}
                    </span>
                    <RoleCheck roles={["admin"]}>
                      <span
                        className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold bg-white/90 backdrop-blur-md shadow-sm border border-slate-100 uppercase tracking-wider ${
                          doc.visibility === "global"
                            ? "text-emerald-600"
                            : doc.visibility === "customer"
                              ? "text-blue-600"
                              : "text-amber-600"
                        }`}
                      >
                        {doc.visibility === "global" ? (
                          <Globe className="w-3 h-3 mr-1" />
                        ) : doc.visibility === "customer" ? (
                          <User className="w-3 h-3 mr-1" />
                        ) : (
                          <Building className="w-3 h-3 mr-1" />
                        )}
                        {doc.visibility}
                      </span>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 bg-white/90 backdrop-blur-md hover:bg-white shadow-sm border border-slate-100 rounded-full active:scale-90 transition-all pointer-events-auto"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <MoreVertical className="h-3 w-3 text-slate-600" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-40">
                          <DropdownMenuLabel className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-2 py-1.5">
                            Set Visibility
                          </DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          {VISIBILITY_TYPES.map((type) => (
                            <DropdownMenuItem
                              key={type.value}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleUpdateVisibility(doc.id, type.value);
                              }}
                              className={`text-xs font-medium ${
                                doc.visibility === type.value
                                  ? "bg-indigo-50 text-indigo-600 font-bold"
                                  : "text-slate-600"
                              }`}
                            >
                              <div className="flex items-center w-full justify-between">
                                <div className="flex items-center gap-2">
                                  {type.value === "global" ? (
                                    <Globe className="w-3.5 h-3.5" />
                                  ) : type.value === "customer" ? (
                                    <User className="w-3.5 h-3.5" />
                                  ) : (
                                    <Building className="w-3.5 h-3.5" />
                                  )}
                                  {type.label}
                                </div>
                                {doc.visibility === type.value && (
                                  <div className="h-1.5 w-1.5 rounded-full bg-indigo-600" />
                                )}
                              </div>
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </RoleCheck>
                  </div>
                </div>

                {/* Content Area */}
                <div className="p-5 flex flex-col flex-1">
                  <div className="flex-1 min-w-0 mb-4">
                    <h4
                      className="text-sm text-wrap font-bold text-slate-800 line-clamp-2 leading-snug hover:text-indigo-600 transition-colors cursor-default"
                      title={doc.file_name}
                    >
                      {doc.file_name}
                    </h4>
                    <div className="flex items-center mt-2 space-x-2">
                      <div className="h-1.5 w-1.5 rounded-full bg-slate-300"></div>
                      <p className="text-[11px] text-slate-400 font-medium">
                        Uploaded{" "}
                        {format(new Date(doc.created_at), "MMM d, yyyy")}
                      </p>
                    </div>
                    <RoleCheck roles={["admin"]}>
                      <div className="mt-3 pt-3 border-t border-slate-100/80">
                        <div className="flex items-center gap-2.5 group/uploader">
                          <div className="h-7 w-7 rounded-lg bg-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-600 border border-slate-200 group-hover/uploader:bg-indigo-50 group-hover/uploader:text-indigo-600 group-hover/uploader:border-indigo-100 transition-all duration-300">
                            {doc?.users?.name?.charAt(0).toUpperCase() || "U"}
                          </div>
                          <div className="flex flex-col min-w-0">
                            <p className="text-[10px] font-bold text-slate-700 leading-none truncate group-hover/uploader:text-indigo-600 transition-colors">
                              {doc?.users?.name || "System"}
                            </p>
                            <p className="text-[9px] text-slate-500 font-medium mt-1 truncate">
                              {doc?.users?.organizations?.name || "Admin"}
                            </p>
                          </div>
                        </div>
                      </div>
                    </RoleCheck>
                  </div>

                  <div className="pt-4 flex items-center gap-2 border-t border-slate-100/80">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        handleDownload(doc.document_url, doc.file_name)
                      }
                      className="text-slate-600 border-slate-200 hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-600 h-9 flex-1 text-xs font-semibold shadow-sm transition-all active:scale-95"
                    >
                      <Download className="h-3.5 w-3.5 mr-2" />
                      Download
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-slate-600 border-slate-200 hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-600 h-9 flex-1 text-xs font-semibold shadow-sm transition-all active:scale-95"
                      onClick={() => {
                        navigator.clipboard.writeText(doc.document_url);
                        notify.success(
                          "URL Copied to clipboard",
                          "Document URL has been copied to clipboard",
                        );
                      }}
                    >
                      <Paperclip className="h-3.5 w-3.5 mr-2" />
                      Copy Link
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Upload Details Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Document Details</DialogTitle>
            <DialogDescription>
              Identify this document and categorize it correctly.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Document Name</Label>
              <Input
                id="name"
                value={docName}
                onChange={(e) => setDocName(e.target.value)}
                placeholder="e.g. Parts Drawing A-01"
                className="focus-visible:ring-indigo-600"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="type">Category</Label>
              <Select value={docType} onValueChange={setDocType}>
                <SelectTrigger id="type" className="focus:ring-indigo-600">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  {DOCUMENT_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {session?.user.role === "admin" && (
              <div className="space-y-2">
                <Label htmlFor="type">Visibility</Label>
                <Select value={docVisibility} onValueChange={setDocVisibility}>
                  <SelectTrigger id="type" className="focus:ring-indigo-600">
                    <SelectValue placeholder="Select visibility" />
                  </SelectTrigger>
                  <SelectContent>
                    {VISIBILITY_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={handleCloseModal}>
              Cancel
            </Button>
            <Button
              onClick={handleConfirmUpload}
              disabled={isUploading || !docName}
              className="bg-indigo-600 hover:bg-indigo-700 text-white"
            >
              {isUploading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Uploading...
                </>
              ) : (
                "Confirm Upload"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* PDF Viewer */}
      <PdfViewerModal
        isOpen={pdfViewer.isOpen}
        onClose={() => setPdfViewer({ ...pdfViewer, isOpen: false })}
        pdfSrc={pdfViewer.url}
        fileName={pdfViewer.name}
        variant="glass"
      />
    </div>
  );
};

export default Documents;
