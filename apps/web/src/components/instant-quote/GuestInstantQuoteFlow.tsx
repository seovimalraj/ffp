"use client";

import React, { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { InstantQuoteUploadLanding } from "./InstantQuoteUploadLanding";
import { SignUpModal } from "./SignUpModal";
import { UploadPresignSchema } from "@cnc-quote/shared/contracts/vnext";
import { supabase } from "@/lib/database";

interface SelectedGuestFile {
  id: string;
  file: File;
  status: "pending" | "uploading" | "uploaded" | "error";
  progress: number;
  error?: string;
  fileId?: string;
}

const ACCEPTED_EXTS = [
  "step",
  "stp",
  "iges",
  "igs",
  "sldprt",
  "stl",
  "x_t",
  "x_b",
  "3dxml",
  "catpart",
  "prt",
  "sat",
  "3mf",
  "jt",
  "dxf",
  "zip",
];

const MAX_FILE_SIZE_MB = 200;

export default function GuestInstantQuoteFlow() {
  const router = useRouter();
  const [files, setFiles] = useState<SelectedGuestFile[]>([]);
  const [showSignup, setShowSignup] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [_guestEmail, setGuestEmail] = useState<string | null>(null);
  const _uploadAborters = useRef<Record<string, AbortController>>({});

  const _hasAtLeastOneFile = files.some(
    (f) =>
      f.status === "pending" ||
      f.status === "uploading" ||
      f.status === "uploaded",
  );
  const _uploadedCount = files.filter((f) => f.status === "uploaded").length;

  const validateFile = (f: File): string | null => {
    const ext = f.name.split(".").pop()?.toLowerCase();
    if (!ext || !ACCEPTED_EXTS.includes(ext)) return "UNSUPPORTED_TYPE";
    if (f.size > MAX_FILE_SIZE_MB * 1024 * 1024) return "FILE_TOO_LARGE";
    return null;
  };

  const getErrorMessage = (code: string) => {
    switch (code) {
      case "UNSUPPORTED_TYPE":
        return "This file type is not supported. Try STEP/IGES/Parasolid.";
      case "FILE_TOO_LARGE":
        return `File exceeds ${MAX_FILE_SIZE_MB}MB limit.`;
      case "UPLOAD_FAILED":
        return "Upload failed. Please try again.";
      default:
        return "Unexpected error.";
    }
  };

  const handleFilesSelected = useCallback((incoming: File[]) => {
    const next: SelectedGuestFile[] = [];
    incoming.forEach((file) => {
      const err = validateFile(file);
      const id = `guest_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
      next.push({
        id,
        file,
        status: err ? "error" : "pending",
        progress: 0,
        error: err ? getErrorMessage(err) : undefined,
      });
    });

    setFiles((prev) => [...prev, ...next]);

    // Trigger signup modal after first selection
    setShowSignup(true);
  }, []);

  const presignAndUpload = useCallback(
    async (entry: SelectedGuestFile): Promise<SelectedGuestFile> => {
      try {
        // Presign
        const presignRes = await fetch("/api/files/presign", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fileName: entry.file.name,
            contentType: entry.file.type,
            size: entry.file.size,
            byteLength: entry.file.size,
          }),
        });
        if (!presignRes.ok)
          throw new Error(`Presign failed: ${presignRes.status}`);
        const data = await presignRes.json();
        const presign = UploadPresignSchema.parse(data);

        const uploadMethodRaw = (presign.method ?? "PUT").toUpperCase();
        const uploadMethod = uploadMethodRaw === "POST" ? "POST" : "PUT";

        // Progress simulation tick
        const tick = setInterval(() => {
          setFiles((prev) =>
            prev.map((f) =>
              f.id === entry.id && f.progress < 95
                ? { ...f, progress: f.progress + 5 }
                : f,
            ),
          );
        }, 200);

        try {
          if (uploadMethod === "POST") {
            const formData = new FormData();
            if (presign.fields) {
              Object.entries(presign.fields).forEach(([k, v]) =>
                formData.append(k, v),
              );
            }
            formData.append("file", entry.file);
            const up = await fetch(presign.url, {
              method: "POST",
              body: formData,
              credentials: "omit",
            });
            if (!up.ok) throw new Error(`Upload failed: ${up.status}`);
          } else {
            const headers = presign.headers
              ? new Headers(presign.headers)
              : new Headers();
            if (!headers.has("Content-Type") && entry.file.type)
              headers.set("Content-Type", entry.file.type);
            const up = await fetch(presign.url, {
              method: "PUT",
              body: entry.file,
              headers,
              credentials: "omit",
            });
            if (!up.ok) throw new Error(`Upload failed: ${up.status}`);
          }
        } finally {
          clearInterval(tick);
        }

        const fileId = presign.fileId ?? presign.uploadId;
        if (!fileId) throw new Error("Upload completed without fileId");

        return { ...entry, status: "uploaded", progress: 100, fileId };
      } catch (_e) {
        return {
          ...entry,
          status: "error",
          error: getErrorMessage("UPLOAD_FAILED"),
        };
      }
    },
    [],
  );

  const onSignupComplete = useCallback(
    async (email: string, password: string) => {
      setIsProcessing(true);
      setGuestEmail(email);

      try {
        // Attempt signup (best-effort; may already exist)
        try {
          await supabase.auth.signUp({ email, password });
        } catch (signupErr) {
          console.warn("Signup failed or user exists:", signupErr);
        }

        // Sign in via internal auth to set session cookies for API calls
        // CRITICAL: Must succeed for subsequent API calls to work
        const signinRes = await fetch("/api/auth/signin", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
          credentials: "include", // Ensure cookies are set
        });

        if (!signinRes.ok) {
          const errorText = await signinRes.text().catch(() => "Unknown error");
          throw new Error(`Sign-in failed: ${errorText}`);
        }

        // Upload all valid files
        const toUpload = files.filter((f) => f.status === "pending");
        // mark uploading
        setFiles((prev) =>
          prev.map((f) =>
            f.status === "pending"
              ? { ...f, status: "uploading", progress: 5 }
              : f,
          ),
        );

        const uploaded: SelectedGuestFile[] = [];
        for (const f of toUpload) {
          const result = await presignAndUpload(f);
          uploaded.push(result);
          setFiles((prev) =>
            prev.map((p) => (p.id === result.id ? result : p)),
          );
        }

        const filePayload = uploaded
          .filter((f) => f.status === "uploaded" && f.fileId)
          .map((f) => ({
            fileId: f.fileId as string,
            fileName: f.file.name,
            fileSize: f.file.size,
            contentType: f.file.type,
          }));

        if (!filePayload.length) {
          throw new Error("No files uploaded");
        }

        // Create guest quote with credentials to include session cookies
        const quoteRes = await fetch("/api/quotes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            source: "web",
            guestEmail: email,
            files: filePayload,
          }),
          credentials: "include", // Include cookies for auth
        });

        if (!quoteRes.ok) {
          const t = await quoteRes.text().catch(() => "");
          throw new Error(`Quote create failed: ${quoteRes.status} ${t}`);
        }

        const body = await quoteRes.json();
        const quoteId = body?.id || body?.quote_id || body?.quote?.id;

        if (!quoteId) {
          console.error("Quote response body:", body);
          throw new Error("Quote ID not returned from server");
        }

        // Navigate to quote page
        console.log(`Redirecting to /quote/${quoteId}`);
        router.push(`/quote/${encodeURIComponent(quoteId)}?preparing=true`);
      } catch (err) {
        console.error("Instant quote flow error:", err);
        // Surface a minimal error UI by flagging entries
        setFiles((prev) =>
          prev.map((f) =>
            f.status === "uploading"
              ? {
                  ...f,
                  status: "error",
                  error:
                    err instanceof Error ? err.message : "Failed. Try again.",
                }
              : f,
          ),
        );
      } finally {
        setIsProcessing(false);
        setShowSignup(false);
      }
    },
    [files, presignAndUpload, router],
  );

  const onCancelSignup = useCallback(() => {
    setShowSignup(false);
  }, []);

  return (
    <>
      <InstantQuoteUploadLanding onFilesSelected={handleFilesSelected} />
      {showSignup && (
        <SignUpModal
          fileCount={files.length}
          onComplete={onSignupComplete}
          onCancel={onCancelSignup}
          isProcessing={isProcessing}
        />
      )}
    </>
  );
}
