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

type Document = {
  id: string;
  file_name: string;
  document_type: string;
  document_url: string;
  created_at: string;
  uploaded_by: string;
  mime_type: string;
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
        uploaded_by: session?.user?.id || session?.user?.email || "User",
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

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setPendingFile(null);
    setDocName("");
    setDocType("other");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const getFileIcon = (mimeType: string) => {
    if (mimeType.includes("pdf"))
      return <FileText className="h-8 w-8 text-rose-500" />;
    if (mimeType.includes("image"))
      return <FileIcon className="h-8 w-8 text-sky-500" />;
    return <FileIcon className="h-8 w-8 text-slate-400" />;
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
          {session?.user?.role === "admin" && (
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
          )}
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
              className="group overflow-hidden hover:shadow-lg transition-all border-slate-200"
            >
              <CardContent className="p-0">
                <div className="p-4 bg-slate-50 flex items-center justify-center aspect-video relative group-hover:bg-slate-100 transition-colors">
                  {getFileIcon(doc.mime_type)}
                  {doc.mime_type.includes("pdf") && (
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all">
                      <Button
                        size="sm"
                        variant="secondary"
                        className="bg-white/90 backdrop-blur-sm active:scale-95"
                        onClick={() =>
                          openPdfViewer(doc.document_url, doc.file_name)
                        }
                      >
                        <Eye className="w-4 h-4 mr-2" />
                        Quick View
                      </Button>
                    </div>
                  )}
                </div>
                <div className="p-4 space-y-3">
                  <div className="flex justify-between items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <h4
                        className="text-sm font-semibold text-slate-900 truncate"
                        title={doc.file_name}
                      >
                        {doc.file_name}
                      </h4>
                      <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wider mt-0.5">
                        {format(new Date(doc.created_at), "MMM d, yyyy")}
                      </p>
                    </div>
                    <span className="flex-shrink-0 inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-50 text-indigo-600 uppercase tracking-tight">
                      {doc.document_type.replace("_", " ")}
                    </span>
                  </div>

                  <div className="pt-2 flex items-center justify-between border-t border-slate-100">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 h-8 flex-1 text-xs"
                      asChild
                    >
                      <a
                        href={doc.document_url}
                        download
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <Download className="h-3.5 w-3.5 mr-1.5" />
                        Download
                      </a>
                    </Button>
                    {doc.mime_type.includes("pdf") && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 h-8 flex-1 text-xs"
                        onClick={() =>
                          openPdfViewer(doc.document_url, doc.file_name)
                        }
                      >
                        <Eye className="h-3.5 w-3.5 mr-1.5" />
                        View
                      </Button>
                    )}
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
