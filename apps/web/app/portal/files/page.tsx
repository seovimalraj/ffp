"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { toast } from "react-hot-toast";
import { formatDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Progress } from "@/components/ui/progress";
import { DatePickerWithRange } from "@/components/ui/date-range-picker";
import {
  CloudArrowUpIcon,
  EyeIcon,
  CloudArrowDownIcon,
  TrashIcon,
  FolderIcon,
  DocumentIcon,
  PhotoIcon,
  ViewfinderCircleIcon,
  Bars3Icon,
  Squares2X2Icon,
} from "@heroicons/react/24/outline";
import { CADPreview, FilePreview } from "@/components/ui/file-preview";
import type { File } from "@/types/order";
import { trackEvent } from "@/lib/analytics/posthog";

const ITEMS_PER_PAGE = 20;

const KIND_OPTIONS = [
  { value: "all", label: "All" },
  { value: "CAD", label: "CAD" },
  { value: "Drawing", label: "Drawing" },
  { value: "PDF", label: "PDF" },
  { value: "Image", label: "Image" },
  { value: "Zip", label: "Zip" },
];

const LINKED_TYPE_OPTIONS = [
  { value: "any", label: "Any" },
  { value: "Quote", label: "Quote" },
  { value: "Order", label: "Order" },
  { value: "Unlinked", label: "Unlinked" },
];

interface FileUpload {
  id: string;
  file: File;
  progress: number;
  status: "uploading" | "completed" | "error";
  error?: string;
}

export default function FilesPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");
  const [filters, setFilters] = useState({
    kind: "all",
    linked_type: "any",
    date_from: "",
    date_to: "",
  });
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [uploads, setUploads] = useState<FileUpload[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [previewFile, setPreviewFile] = useState<File | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [signedUrl, setSignedUrl] = useState<string>("");
  const [cadPreviewUrl, setCadPreviewUrl] = useState<string>("");

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Load files when filters change
  const loadFiles = useCallback(async () => {
    try {
      setIsLoading(true);
      const params = new URLSearchParams({
        page: page.toString(),
        page_size: ITEMS_PER_PAGE.toString(),
        q: debouncedSearchQuery,
        ...(filters.kind !== "all" && { kind: filters.kind }),
        ...(filters.linked_type !== "any" && {
          linked_type: filters.linked_type,
        }),
        ...(filters.date_from && { date_from: filters.date_from }),
        ...(filters.date_to && { date_to: filters.date_to }),
      });

      const response = await api.get<{
        files: File[];
        total: number;
        page: number;
        page_size: number;
      }>(`/files?${params}`);

      setFiles(response.data.files);
      setTotal(response.data.total);

      trackEvent("files_list_view", {
        view_mode: viewMode,
        filters: Object.values(filters).filter(
          (v) => v !== "all" && v !== "any" && v !== "",
        ).length,
        search_query: debouncedSearchQuery || undefined,
      });
    } catch (error: any) {
      toast.error("Failed to load files");
      console.error("Error loading files:", error);
    } finally {
      setIsLoading(false);
    }
  }, [page, debouncedSearchQuery, filters, viewMode]);

  useEffect(() => {
    loadFiles();
  }, [loadFiles]);

  // Handle filter changes
  const handleFilterChange = (key: string, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPage(1);
  };

  // Handle search
  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    setPage(1);
  };

  // Handle file upload
  const handleFileSelect = (selectedFiles: FileList | null) => {
    if (!selectedFiles) return;

    const newUploads: FileUpload[] = Array.from(selectedFiles).map((file) => ({
      id: Math.random().toString(36).substring(2),
      file,
      progress: 0,
      status: "uploading" as const,
    }));

    setUploads((prev) => [...prev, ...newUploads]);

    // Start uploading each file
    newUploads.forEach((upload) => {
      uploadFile(upload);
    });

    trackEvent("file_upload_started", { count: newUploads.length });
  };

  const uploadFile = async (upload: FileUpload) => {
    try {
      const formData = new FormData();
      formData.append("file", upload.file);

      // Simulate progress updates
      const progressInterval = setInterval(() => {
        setUploads((prev) =>
          prev.map((u) =>
            u.id === upload.id && u.progress < 90
              ? { ...u, progress: u.progress + 10 }
              : u,
          ),
        );
      }, 200);

      const response = await fetch("/api/files/upload", {
        method: "POST",
        body: formData,
      });

      clearInterval(progressInterval);

      if (!response.ok) {
        throw new Error("Upload failed");
      }

      setUploads((prev) =>
        prev.map((u) =>
          u.id === upload.id ? { ...u, progress: 100, status: "completed" } : u,
        ),
      );

      // Remove completed upload after a delay
      setTimeout(() => {
        setUploads((prev) => prev.filter((u) => u.id !== upload.id));
      }, 2000);

      // Refresh the file list
      loadFiles();

      trackEvent("file_upload_succeeded", {
        file_name: upload.file.name,
        file_size: upload.file.size,
        mime_type: upload.file.type,
      });
    } catch (error: any) {
      setUploads((prev) =>
        prev.map((u) =>
          u.id === upload.id
            ? { ...u, status: "error", error: error.message }
            : u,
        ),
      );

      console.error("Error uploading file:", error);
    }
  };

  // Handle drag and drop
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    handleFileSelect(e.dataTransfer.files);
  };

  // Handle preview
  const handlePreview = async (file: File) => {
    setPreviewFile(file);
    setIsPreviewLoading(true);
    try {
      if (file.kind === "CAD" && file.preview_ready) {
        const response = await api.get<{ preview_url: string }>(
          `/cad/preview/${file.id}`,
        );
        setCadPreviewUrl(response.data.preview_url);
      } else {
        const response = await api.get<{ signed_url: string }>(
          `/files/${file.id}/signed-url`,
        );
        setSignedUrl(response.data.signed_url);
      }
      trackEvent("file_preview_open", { file_id: file.id, kind: file.kind });
    } catch (error: any) {
      toast.error("Failed to load preview");
      console.error("Error loading preview:", error);
    } finally {
      setIsPreviewLoading(false);
    }
  };

  // Handle download
  const handleDownload = async (file: File) => {
    try {
      const response = await api.get<{ signed_url: string }>(
        `/files/${file.id}/signed-url`,
      );
      window.open(response.data.signed_url, "_blank");
      trackEvent("file_download", { file_id: file.id, kind: file.kind });
    } catch (error: any) {
      toast.error("Failed to download file");
      console.error("Error downloading file:", error);
    }
  };

  // Handle delete
  const handleDelete = async (file: File) => {
    if (
      !confirm(
        `Are you sure you want to delete "${file.name}"? This cannot be undone.`,
      )
    )
      return;
    try {
      await api.delete(`/files/${file.id}`);
      toast.success("File deleted");
      trackEvent("file_delete", { file_id: file.id, kind: file.kind });
      // Refresh the file list
      loadFiles();
    } catch (error: any) {
      toast.error("Failed to delete file");
      console.error("Error deleting file:", error);
    }
  };

  // Handle navigation to linked entity
  const handleNavigateToLinked = (file: File) => {
    if (file.linked_type === "Order") {
      router.push(`/portal/orders/${file.linked_id}`);
    } else if (file.linked_type === "Quote") {
      router.push(`/portal/quotes/${file.linked_id}`);
    }
  };

  // Helper functions
  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const getFileIcon = (kind: string, mime: string) => {
    if (kind === "CAD") return ViewfinderCircleIcon;
    if (kind === "Image" || mime.startsWith("image/")) return PhotoIcon;
    if (kind === "PDF" || mime === "application/pdf") return DocumentIcon;
    return FolderIcon;
  };

  const getFileTypeColor = (kind: string) => {
    const colors: Record<string, string> = {
      CAD: "bg-blue-100 text-blue-800",
      Drawing: "bg-green-100 text-green-800",
      PDF: "bg-red-100 text-red-800",
      Image: "bg-purple-100 text-purple-800",
      Zip: "bg-yellow-100 text-yellow-800",
      Other: "bg-gray-100 text-gray-800",
    };
    return colors[kind] || colors.Other;
  };

  // Pagination
  const totalPages = Math.ceil(total / ITEMS_PER_PAGE);
  const hasNextPage = page < totalPages;
  const hasPrevPage = page > 1;

  return (
    <div className="container py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Files</h1>
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <Button
              variant={viewMode === "grid" ? "default" : "outline"}
              size="sm"
              onClick={() => setViewMode("grid")}
            >
              <Squares2X2Icon className="w-4 h-4" />
            </Button>
            <Button
              variant={viewMode === "list" ? "default" : "outline"}
              size="sm"
              onClick={() => setViewMode("list")}
            >
              <Bars3Icon className="w-4 h-4" />
            </Button>
          </div>
          <Button onClick={() => fileInputRef.current?.click()}>
            <CloudArrowUpIcon className="w-4 h-4 mr-2" />
            Upload Files
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".STEP,.STP,.IGES,.SLDPRT,.STL,.JT,.3MF,.DXF,.PDF,.PNG,.JPG,.ZIP"
            className="hidden"
            onChange={(e) => handleFileSelect(e.target.files)}
          />
        </div>
      </div>

      {/* Upload Progress */}
      {uploads.length > 0 && (
        <Card className="p-4 mb-6">
          <div className="space-y-3">
            <h3 className="font-medium">Uploads</h3>
            {uploads.map((upload) => (
              <div key={upload.id} className="flex items-center space-x-3">
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium">
                      {upload.file.name}
                    </span>
                    <span className="text-sm text-gray-500">
                      {upload.status === "completed"
                        ? "Complete"
                        : upload.status === "error"
                          ? "Failed"
                          : `${upload.progress}%`}
                    </span>
                  </div>
                  <Progress value={upload.progress} className="h-2" />
                  {upload.error && (
                    <p className="text-sm text-red-600 mt-1">{upload.error}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Search and Filters */}
      <Card className="p-6 mb-6">
        <div className="flex flex-col space-y-4">
          <div className="flex items-center space-x-4">
            <div className="flex-1">
              <Input
                placeholder="Search files…"
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="max-w-md"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Select
              value={filters.kind}
              onValueChange={(value) => handleFilterChange("kind", value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="All Types" />
              </SelectTrigger>
              <SelectContent>
                {KIND_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={filters.linked_type}
              onValueChange={(value) =>
                handleFilterChange("linked_type", value)
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Any Linked" />
              </SelectTrigger>
              <SelectContent>
                {LINKED_TYPE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <DatePickerWithRange
              date={{
                from: filters.date_from
                  ? new Date(filters.date_from)
                  : undefined,
                to: filters.date_to ? new Date(filters.date_to) : undefined,
              }}
              onDateChange={(range) => {
                handleFilterChange(
                  "date_from",
                  range.from?.toISOString().split("T")[0] || "",
                );
                handleFilterChange(
                  "date_to",
                  range.to?.toISOString().split("T")[0] || "",
                );
              }}
              className="w-full"
            />
          </div>
        </div>
      </Card>

      {/* Drop Zone */}
      <Card
        className={`p-8 mb-6 border-2 border-dashed transition-colors ${
          isDragOver ? "border-blue-500 bg-blue-50" : "border-gray-300"
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <div className="text-center">
          <CloudArrowUpIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium mb-2">
            Drop files here to upload
          </h3>
          <p className="text-gray-500 mb-4">
            Supports CAD files (.STEP, .STP, .IGES, .SLDPRT, .STL, .JT, .3MF,
            .DXF), PDFs, images, and archives
          </p>
          <p className="text-sm text-gray-400">Maximum file size: 200MB</p>
        </div>
      </Card>

      {/* Files Display */}
      {viewMode === "grid" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {isLoading ? (
            Array.from({ length: 8 }).map((_, i) => (
              <Card key={i} className="animate-pulse">
                <CardContent className="p-4">
                  <div className="w-full h-32 bg-gray-200 rounded mb-3"></div>
                  <div className="h-4 bg-gray-200 rounded mb-2"></div>
                  <div className="h-3 bg-gray-200 rounded"></div>
                </CardContent>
              </Card>
            ))
          ) : files.length === 0 ? (
            <div className="col-span-full text-center py-12">
              <FolderIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">No files yet</h3>
              <p className="text-gray-500">
                Upload your first file to get started
              </p>
            </div>
          ) : (
            files.map((file) => {
              const IconComponent = getFileIcon(file.kind, file.mime);
              return (
                <Card
                  key={file.id}
                  className="hover:shadow-md transition-shadow"
                >
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-3">
                      <IconComponent className="w-8 h-8 text-gray-400" />
                      <Badge className={getFileTypeColor(file.kind)}>
                        {file.kind}
                      </Badge>
                    </div>

                    <h3
                      className="font-medium text-sm mb-1 truncate"
                      title={file.name}
                    >
                      {file.name}
                    </h3>

                    <div className="text-xs text-gray-500 space-y-1 mb-3">
                      <p>{formatFileSize(file.size_bytes)}</p>
                      <p>{formatDate(file.created_at)}</p>
                      {file.linked_type && (
                        <p>
                          {file.linked_type} #{file.linked_id?.slice(0, 8)}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handlePreview(file)}
                          title="Preview"
                        >
                          <EyeIcon className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDownload(file)}
                          title="Download"
                        >
                          <CloudArrowDownIcon className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDelete(file)}
                          title="Delete"
                          className="text-red-600 hover:text-red-700"
                        >
                          <TrashIcon className="w-4 h-4" />
                        </Button>
                      </div>
                      {file.linked_type && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleNavigateToLinked(file)}
                          title="Open Linked"
                        >
                          <FolderIcon className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Linked To</TableHead>
                <TableHead>Size</TableHead>
                <TableHead>Uploaded</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8">
                    Loading files...
                  </TableCell>
                </TableRow>
              ) : files.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8">
                    <div className="flex flex-col items-center space-y-2">
                      <FolderIcon className="w-8 h-8 text-gray-400 mb-2" />
                      <p className="text-gray-500">No files yet</p>
                      <p className="text-sm text-gray-400">
                        Upload your first file to get started
                      </p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                files.map((file) => {
                  const IconComponent = getFileIcon(file.kind, file.mime);
                  return (
                    <TableRow key={file.id}>
                      <TableCell>
                        <div className="flex items-center space-x-3">
                          <IconComponent className="w-5 h-5 text-gray-400" />
                          <div>
                            <p className="font-medium">{file.name}</p>
                            <p className="text-sm text-gray-500">
                              {file.id.slice(0, 8)}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={getFileTypeColor(file.kind)}>
                          {file.kind}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {file.linked_type ? (
                          <span className="text-sm">
                            {file.linked_type} #{file.linked_id?.slice(0, 8)}
                          </span>
                        ) : (
                          <span className="text-sm text-gray-500">
                            Unlinked
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-gray-500">
                        {formatFileSize(file.size_bytes)}
                      </TableCell>
                      <TableCell className="text-sm text-gray-500">
                        {formatDate(file.created_at)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handlePreview(file)}
                            title="Preview"
                          >
                            <EyeIcon className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDownload(file)}
                            title="Download"
                          >
                            <CloudArrowDownIcon className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDelete(file)}
                            title="Delete"
                            className="text-red-600 hover:text-red-700"
                          >
                            <TrashIcon className="w-4 h-4" />
                          </Button>
                          {file.linked_type && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleNavigateToLinked(file)}
                              title="Open Linked"
                            >
                              <FolderIcon className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-6">
          <div className="text-sm text-gray-500">
            Showing {(page - 1) * ITEMS_PER_PAGE + 1} to{" "}
            {Math.min(page * ITEMS_PER_PAGE, total)} of {total} files
          </div>
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(page - 1)}
              disabled={!hasPrevPage}
            >
              Previous
            </Button>
            <span className="text-sm">
              Page {page} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(page + 1)}
              disabled={!hasNextPage}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {/* Preview Sheet */}
      <Sheet
        open={!!previewFile}
        onOpenChange={() => {
          setPreviewFile(null);
          setSignedUrl("");
          setCadPreviewUrl("");
        }}
      >
        <SheetContent side="right" className="w-[600px] sm:w-[800px]">
          <SheetHeader>
            <SheetTitle>{previewFile?.name}</SheetTitle>
          </SheetHeader>

          {isPreviewLoading ? (
            <div className="py-8 text-center">Loading preview...</div>
          ) : cadPreviewUrl ? (
            <CADPreview
              url={cadPreviewUrl}
              title={previewFile?.name}
              className="h-[60vh]"
            />
          ) : signedUrl && previewFile ? (
            <FilePreview
              file={{
                name: previewFile.name,
                mime: previewFile.type,
                size: previewFile.size,
              }}
              signedUrl={signedUrl}
              className="h-[60vh]"
            />
          ) : (
            <div className="py-8 text-center text-gray-500">
              Preview not available
            </div>
          )}

          <div className="flex justify-end space-x-2 mt-4">
            <Button
              variant="outline"
              onClick={() => {
                setPreviewFile(null);
                setSignedUrl("");
                setCadPreviewUrl("");
              }}
            >
              Close
            </Button>
            {signedUrl && (
              <Button onClick={() => window.open(signedUrl, "_blank")}>
                <CloudArrowDownIcon className="w-4 h-4 mr-2" />
                Download
              </Button>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
