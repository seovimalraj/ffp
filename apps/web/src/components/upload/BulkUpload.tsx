"use client";

import React, { useCallback, useState, useRef } from "react";
import { useDropzone, type FileRejection } from "react-dropzone";
import {
  Upload,
  X,
  AlertCircle,
  CheckCircle,
  Play,
  Pause,
  RotateCcw,
  FileText,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/components/ui/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const supabase = createClient();

const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB
const MAX_FILES = 50; // Maximum number of files per batch
const CONCURRENT_UPLOADS = 3; // Number of simultaneous uploads

interface BulkUploadProps {
  organizationId: string;
  onUploadComplete?: (fileIds: string[]) => void;
  onUploadProgress?: (completed: number, total: number) => void;
}

interface UploadState {
  localId: string;
  id?: string;
  file: File;
  name: string;
  size: number;
  progress: number;
  status:
    | "waiting"
    | "uploading"
    | "processing"
    | "complete"
    | "error"
    | "paused";
  error?: string;
  startTime?: number;
  endTime?: number;
}

interface BatchStats {
  totalFiles: number;
  completed: number;
  failed: number;
  totalSize: number;
  uploadedSize: number;
  averageSpeed: number;
  estimatedTimeRemaining: number;
}

// Helper types for direct upload
type AuthSession = { token?: string };
type ProgressCallback = (progress: number) => void;

// Direct upload with progress and abort support
function directUploadWithProgress(
  baseUrl: string,
  auth: { token?: string },
  organizationId: string,
  file: File,
  signal: AbortSignal,
  onProgress: (progress: number) => void,
) {
  return new Promise<{ file: { id: string } }>((resolve, reject) => {
    const formData = new FormData();
    formData.append("org_id", organizationId);
    formData.append("file", file);

    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${baseUrl}/api/files/direct`, true);
    if (auth.token) {
      xhr.setRequestHeader("Authorization", `Bearer ${auth.token}`);
    }
    xhr.responseType = "json";

    const abortHandler = () => {
      xhr.abort();
      reject(new DOMException("Upload aborted", "AbortError"));
    };
    signal.addEventListener("abort", abortHandler);

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        const pct = Math.min(
          100,
          Math.round((event.loaded / event.total) * 100),
        );
        onProgress(pct);
      }
    };

    xhr.onload = () => {
      signal.removeEventListener("abort", abortHandler);
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(xhr.response as { file: { id: string } });
      } else {
        const message =
          (xhr.response && (xhr.response.error || xhr.response.message)) ||
          `Upload failed (${xhr.status})`;
        reject(new Error(message));
      }
    };

    xhr.onerror = () => {
      signal.removeEventListener("abort", abortHandler);
      reject(new Error("Network error during upload"));
    };

    try {
      xhr.send(formData);
    } catch (error) {
      signal.removeEventListener("abort", abortHandler);
      reject(error as Error);
    }
  });
}

async function pollVirusScanWithAbort(
  baseUrl: string,
  fileId: string,
  auth: { token?: string },
  signal: AbortSignal,
) {
  const MAX_POLL_ATTEMPTS = 20;
  const POLL_INTERVAL_MS = 2000;
  for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt += 1) {
    if (signal.aborted) {
      throw new DOMException("Upload aborted", "AbortError");
    }

    const res = await fetch(`${baseUrl}/api/files/${fileId}/metadata`, {
      headers: auth.token
        ? { Authorization: `Bearer ${auth.token}` }
        : undefined,
      signal,
    });

    if (!res.ok) {
      throw new Error(`Failed to poll file metadata (${res.status})`);
    }

    const metadata = await res.json();
    const status = metadata?.virus_scan;
    if (status === "clean") {
      return;
    }
    if (status === "infected" || status === "error") {
      const reason = metadata?.error_message || "File failed virus scan";
      throw new Error(reason);
    }

    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }

  throw new Error("Timed out waiting for virus scan to finish");
}

export function BulkUpload({
  organizationId,
  onUploadComplete,
  onUploadProgress,
}: Readonly<BulkUploadProps>) {
  const [uploads, setUploads] = useState<UploadState[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [batchStats, setBatchStats] = useState<BatchStats>({
    totalFiles: 0,
    completed: 0,
    failed: 0,
    totalSize: 0,
    uploadedSize: 0,
    averageSpeed: 0,
    estimatedTimeRemaining: 0,
  });

  const abortControllerRef = useRef<AbortController | null>(null);
  const uploadQueueRef = useRef<number[]>([]);
  const activeUploadsRef = useRef<Set<number>>(new Set());

  const updateBatchStats = useCallback(
    (currentUploads: UploadState[]) => {
      const totalFiles = currentUploads.length;
      const completed = currentUploads.filter(
        (u) => u.status === "complete",
      ).length;
      const failed = currentUploads.filter((u) => u.status === "error").length;
      const totalSize = currentUploads.reduce((sum, u) => sum + u.size, 0);
      const uploadedSize = currentUploads.reduce((sum, u) => {
        if (u.status === "complete") return sum + u.size;
        if (u.status === "uploading") return sum + (u.size * u.progress) / 100;
        return sum;
      }, 0);

      // Calculate average speed and ETA
      const completedUploads = currentUploads.filter(
        (u) => u.status === "complete" && u.startTime && u.endTime,
      );
      const averageSpeed =
        completedUploads.length > 0
          ? completedUploads.reduce(
              (sum, u) => sum + u.size / ((u.endTime! - u.startTime!) / 1000),
              0,
            ) / completedUploads.length
          : 0;

      const remainingSize = totalSize - uploadedSize;
      const estimatedTimeRemaining =
        averageSpeed > 0 ? remainingSize / averageSpeed : 0;

      setBatchStats({
        totalFiles,
        completed,
        failed,
        totalSize,
        uploadedSize,
        averageSpeed,
        estimatedTimeRemaining,
      });

      onUploadProgress?.(completed, totalFiles);
    },
    [onUploadProgress],
  );

  const uploadFile = useCallback(
    async (uploadIndex: number, signal: AbortSignal) => {
      const currentUpload = uploads[uploadIndex];
      if (
        !currentUpload ||
        (currentUpload.status !== "uploading" &&
          currentUpload.status !== "waiting" &&
          currentUpload.status !== "paused")
      ) {
        activeUploadsRef.current.delete(uploadIndex);
        return;
      }

      const { data } = await supabase.auth.getSession();
      const authContext: AuthSession = {
        token: data.session?.access_token || undefined,
      };

      setUploads((prev) => {
        const next = [...prev];
        if (next[uploadIndex]) {
          next[uploadIndex] = {
            ...next[uploadIndex],
            startTime: Date.now(),
            status: "uploading",
            error: undefined,
          };
        }
        updateBatchStats(next);
        return next;
      });

      const onProgress: ProgressCallback = (progress: number) => {
        if (signal.aborted) return;
        setUploads((prev) => {
          const next = [...prev];
          if (next[uploadIndex]) {
            next[uploadIndex] = {
              ...next[uploadIndex],
              progress,
            };
          }
          updateBatchStats(next);
          return next;
        });
      };

      try {
        const response = await directUploadWithProgress(
          "",
          authContext,
          organizationId,
          currentUpload.file,
          signal,
          onProgress,
        );
        if (signal.aborted) {
          return;
        }

        const serverId = response.file.id;

        setUploads((prev) => {
          const next = [...prev];
          if (next[uploadIndex]) {
            next[uploadIndex] = {
              ...next[uploadIndex],
              id: serverId,
              status: "processing",
              progress: 100,
            };
          }
          updateBatchStats(next);
          return next;
        });

        await pollVirusScanWithAbort("", serverId, authContext, signal);

        setUploads((prev) => {
          const next = [...prev];
          if (next[uploadIndex]) {
            next[uploadIndex] = {
              ...next[uploadIndex],
              status: "complete",
              endTime: Date.now(),
            };
          }
          updateBatchStats(next);
          return next;
        });
      } catch (error) {
        if (signal.aborted) {
          return;
        }

        const message =
          error instanceof Error ? error.message : "Upload failed";
        setUploads((prev) => {
          const next = [...prev];
          if (next[uploadIndex]) {
            next[uploadIndex] = {
              ...next[uploadIndex],
              status: "error",
              error: message,
              endTime: Date.now(),
            };
          }
          updateBatchStats(next);
          return next;
        });
      } finally {
        activeUploadsRef.current.delete(uploadIndex);
      }
    },
    [organizationId, updateBatchStats, uploads],
  );

  const processQueue = useCallback(async () => {
    if (isPaused || uploadQueueRef.current.length === 0) return;

    const availableSlots = CONCURRENT_UPLOADS - activeUploadsRef.current.size;
    if (availableSlots <= 0) return;

    const toProcess = uploadQueueRef.current.splice(0, availableSlots);

    for (const uploadIndex of toProcess) {
      activeUploadsRef.current.add(uploadIndex);
      uploadFile(uploadIndex, abortControllerRef.current!.signal);
    }
  }, [isPaused, uploadFile]);

  const startBatchUpload = useCallback(async () => {
    if (uploads.length === 0) return;

    setIsUploading(true);
    setIsPaused(false);
    abortControllerRef.current = new AbortController();

    // Initialize all uploads to uploading status
    setUploads((prev) =>
      prev.map((upload) => ({
        ...upload,
        status: "uploading" as const,
        progress: 0,
      })),
    );

    // Create upload queue
    uploadQueueRef.current = uploads.map((_, index) => index);
    activeUploadsRef.current.clear();

    // Start processing queue
    await processQueue();
  }, [uploads, processQueue]);

  const pauseBatchUpload = useCallback(() => {
    setIsPaused(true);
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;

    // Mark active uploads as paused
    setUploads((prev) =>
      prev.map((upload) =>
        activeUploadsRef.current.has(uploads.indexOf(upload))
          ? { ...upload, status: "paused" as const }
          : upload,
      ),
    );

    activeUploadsRef.current.clear();
  }, [uploads]);

  const resumeBatchUpload = useCallback(async () => {
    setIsPaused(false);
    abortControllerRef.current = new AbortController();

    // Resume paused uploads
    const pausedUploads = uploads
      .map((upload, index) => ({ upload, index }))
      .filter(({ upload }) => upload.status === "paused");

    for (const { index } of pausedUploads) {
      setUploads((prev) => {
        const newUploads = [...prev];
        newUploads[index] = {
          ...newUploads[index],
          status: "uploading" as const,
        };
        return newUploads;
      });
    }

    uploadQueueRef.current = pausedUploads.map(({ index }) => index);
    await processQueue();
  }, [uploads, processQueue]);

  const cancelBatchUpload = useCallback(() => {
    setIsUploading(false);
    setIsPaused(false);
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;

    activeUploadsRef.current.clear();
    uploadQueueRef.current = [];

    setUploads((prev) =>
      prev.map((upload) =>
        upload.status === "uploading" || upload.status === "paused"
          ? { ...upload, status: "waiting" as const, progress: 0 }
          : upload,
      ),
    );
  }, []);

  const onDrop = useCallback(
    (acceptedFiles: File[], rejectedFiles: FileRejection[]) => {
      // Handle rejected files
      if (rejectedFiles.length > 0) {
        rejectedFiles.forEach(({ file, errors }) => {
          console.error(
            `${file.name}: ${errors.map((error) => error.message).join(", ")}`,
          );
        });
      }

      // Filter and validate accepted files
      const validFiles = acceptedFiles.filter((file) => {
        if (file.size > MAX_FILE_SIZE) {
          toast({
            title: "File too large",
            description: `${file.name} exceeds the maximum file size of 100MB`,
            variant: "destructive",
          });
          return false;
        }
        return true;
      });

      if (validFiles.length === 0) return;

      // Check total file limit
      const currentCount = uploads.length;
      if (currentCount + validFiles.length > MAX_FILES) {
        toast({
          title: "Too many files",
          description: `Maximum ${MAX_FILES} files allowed per batch. You tried to add ${validFiles.length} more.`,
          variant: "destructive",
        });
        return;
      }

      // Add files to upload list
      const newUploads: UploadState[] = validFiles.map((file) => ({
        localId: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        file,
        name: file.name,
        size: file.size,
        progress: 0,
        status: "waiting",
      }));

      setUploads((prev) => [...prev, ...newUploads]);
    },
    [uploads.length],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "model/step": [".step", ".stp"],
      "model/stl": [".stl"],
      "application/dxf": [".dxf"],
    } as Record<string, string[]>,
    maxSize: MAX_FILE_SIZE,
    multiple: true,
  });

  const removeFile = useCallback((localId: string) => {
    setUploads((prev) => prev.filter((u) => u.localId !== localId));
  }, []);

  const clearCompleted = useCallback(() => {
    setUploads((prev) => prev.filter((upload) => upload.status !== "complete"));
  }, []);

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  };

  const formatTime = (seconds: number) => {
    if (seconds < 60) return `${Math.round(seconds)}s`;
    const minutes = Math.floor(seconds / 60);
    const secs = Math.round(seconds % 60);
    return `${minutes}m ${secs}s`;
  };

  const renderStatusIcon = (status: UploadState["status"]) => {
    switch (status) {
      case "error":
        return <AlertCircle className="h-5 w-5 text-destructive" />;
      case "complete":
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case "uploading":
      case "processing":
        return (
          <div className="h-5 w-5 rounded-full border-2 border-t-primary animate-spin" />
        );
      case "paused":
        return <Pause className="h-5 w-5 text-yellow-500" />;
      default:
        return (
          <div className="h-5 w-5 rounded-full border-2 border-muted-foreground/30" />
        );
    }
  };

  const getBadgeVariant = (status: UploadState["status"]) => {
    switch (status) {
      case "complete":
        return "default" as const;
      case "error":
        return "destructive" as const;
      case "uploading":
      case "processing":
        return "secondary" as const;
      default:
        return "outline" as const;
    }
  };

  const getStatusLabel = (status: UploadState["status"]) => {
    switch (status) {
      case "waiting":
        return "Waiting";
      case "uploading":
        return "Uploading";
      case "processing":
        return "Processing";
      case "complete":
        return "Complete";
      case "error":
        return "Error";
      case "paused":
        return "Paused";
      default:
        return status;
    }
  };

  const shouldShowProgressBar = (status: UploadState["status"]) =>
    status === "uploading" || status === "paused";

  const completedFileIds = uploads
    .filter((upload) => upload.status === "complete" && upload.id)
    .map((upload) => upload.id!);

  // Auto-complete when all uploads are done
  React.useEffect(() => {
    const allDone =
      uploads.length > 0 &&
      uploads.every((u) => u.status === "complete" || u.status === "error");

    if (allDone && isUploading) {
      setIsUploading(false);
      if (completedFileIds.length > 0) {
        onUploadComplete?.(completedFileIds);
        toast({
          title: "Batch upload completed",
          description: `Successfully uploaded ${completedFileIds.length} of ${uploads.length} files`,
        });
      }
    }
  }, [uploads, isUploading, completedFileIds, onUploadComplete]);

  return (
    <div className="space-y-6">
      {/* Upload Zone */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Bulk CAD File Upload
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div
            {...getRootProps()}
            className={`
              border-2 border-dashed rounded-lg p-8 text-center cursor-pointer
              transition-colors duration-200
              ${isDragActive ? "border-primary bg-primary/10" : "border-border"}
              ${isUploading ? "opacity-50 pointer-events-none" : ""}
            `}
          >
            <input {...getInputProps()} />
            <Upload className="mx-auto h-12 w-12 text-muted-foreground" />
            <p className="mt-2 text-sm text-muted-foreground">
              Drag & drop multiple CAD files here, or click to select
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Supported: STEP, STL, DXF • Max 100MB per file • Up to {MAX_FILES}{" "}
              files
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Batch Controls */}
      {uploads.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Batch Upload Controls</span>
              <div className="flex gap-2">
                {!isUploading && !isPaused && (
                  <Button
                    onClick={startBatchUpload}
                    disabled={uploads.length === 0}
                  >
                    <Play className="h-4 w-4 mr-2" />
                    Start Upload
                  </Button>
                )}
                {isUploading && !isPaused && (
                  <Button onClick={pauseBatchUpload} variant="outline">
                    <Pause className="h-4 w-4 mr-2" />
                    Pause
                  </Button>
                )}
                {isPaused && (
                  <Button onClick={resumeBatchUpload}>
                    <Play className="h-4 w-4 mr-2" />
                    Resume
                  </Button>
                )}
                {(isUploading || isPaused) && (
                  <Button onClick={cancelBatchUpload} variant="outline">
                    <RotateCcw className="h-4 w-4 mr-2" />
                    Cancel
                  </Button>
                )}
                <Button onClick={clearCompleted} variant="outline" size="sm">
                  Clear Completed
                </Button>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {/* Batch Statistics */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-primary">
                  {batchStats.completed}
                </div>
                <div className="text-sm text-muted-foreground">Completed</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-destructive">
                  {batchStats.failed}
                </div>
                <div className="text-sm text-muted-foreground">Failed</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold">
                  {formatFileSize(batchStats.uploadedSize)}
                </div>
                <div className="text-sm text-muted-foreground">Uploaded</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold">
                  {formatTime(batchStats.estimatedTimeRemaining)}
                </div>
                <div className="text-sm text-muted-foreground">ETA</div>
              </div>
            </div>

            {/* Overall Progress */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Overall Progress</span>
                <span>
                  {batchStats.completed + batchStats.failed} /{" "}
                  {batchStats.totalFiles}
                </span>
              </div>
              <Progress
                value={
                  ((batchStats.completed + batchStats.failed) /
                    batchStats.totalFiles) *
                  100
                }
                className="h-2"
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* File List */}
      {uploads.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Files ({uploads.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {uploads.map((upload) => (
                <div
                  key={upload.localId}
                  className="flex items-center gap-4 p-3 bg-muted/50 rounded-lg"
                >
                  {/* Status Icon */}
                  <div className="flex-shrink-0">
                    {renderStatusIcon(upload.status)}
                  </div>

                  {/* File Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-sm font-medium truncate">
                        {upload.name}
                      </p>
                      <Badge variant={getBadgeVariant(upload.status)}>
                        {getStatusLabel(upload.status)}
                      </Badge>
                    </div>

                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span>{formatFileSize(upload.size)}</span>
                      {upload.status === "uploading" && (
                        <span>{Math.round(upload.progress)}%</span>
                      )}
                      {upload.error && (
                        <span className="text-destructive">{upload.error}</span>
                      )}
                    </div>

                    {/* Progress Bar */}
                    {shouldShowProgressBar(upload.status) && (
                      <Progress value={upload.progress} className="h-1 mt-2" />
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex-shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeFile(upload.localId)}
                      disabled={upload.status === "uploading"}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Empty State */}
      {uploads.length === 0 && (
        <Card>
          <CardContent className="py-12">
            <div className="text-center text-muted-foreground">
              <Upload className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium">No files selected</p>
              <p className="text-sm">
                Drag and drop CAD files above to get started
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
