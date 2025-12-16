import { useState } from "react";
import { apiClient } from "../api";

interface UseFileUploadReturn {
  upload: (file: File) => Promise<{ url: string; message: string }>;
  isUploading: boolean;
  progress: number;
  error: string | null;
  data: { url: string; message: string } | null;
  status: "idle" | "uploading" | "success" | "error";
}

export function useFileUpload(): UseFileUploadReturn {
  const [status, setStatus] = useState<
    "idle" | "uploading" | "success" | "error"
  >("idle");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<{ url: string; message: string } | null>(
    null,
  );

  const upload = async (file: File) => {
    setStatus("uploading");
    setProgress(0);
    setError(null);
    setData(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await apiClient.post(`/files`, formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
        onUploadProgress: (progressEvent) => {
          if (progressEvent.total) {
            const percentCompleted = Math.round(
              (progressEvent.loaded * 100) / progressEvent.total,
            );
            setProgress(percentCompleted);
          }
        },
      });

      const responseData = response.data;
      setData(responseData);
      setStatus("success");
      return responseData;
    } catch (err: any) {
      const errorMessage =
        err.response?.data?.message || err.message || "File upload failed";
      setError(errorMessage);
      setStatus("error");
      throw err;
    }
  };

  return {
    upload,
    isUploading: status === "uploading",
    progress,
    error,
    data,
    status,
  };
}
