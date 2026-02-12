import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { v4 as uuidv4 } from "uuid";
import { ALLOWED_MIME_TYPES, ALLOWED_EXTENSIONS } from "@cnc-quote/shared";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Validate file size (200MB limit)
    if (file.size > 200 * 1024 * 1024) {
      return NextResponse.json(
        { error: "File size exceeds 200MB limit" },
        { status: 400 },
      );
    }

    // Validate file type — lists imported from @cnc-quote/shared
    const allowedMimeTypes = ALLOWED_MIME_TYPES;
    const allowedExtensions = ALLOWED_EXTENSIONS;

    const fileExtension = file.name.split(".").pop()?.toLowerCase();

    const hasValidExtension = allowedExtensions.includes(fileExtension as typeof allowedExtensions[number] || "");
    const hasValidMimeType =
      !file.type || file.type === "" || allowedMimeTypes.includes(file.type as typeof allowedMimeTypes[number]);

    if (!hasValidExtension) {
      return NextResponse.json(
        {
          error: `Unsupported file type: .${fileExtension}. Allowed: ${allowedExtensions.join(", ")}`,
        },
        { status: 400 },
      );
    }

    if (!hasValidMimeType) {
      return NextResponse.json(
        {
          error: `Unsupported MIME type: ${file.type}. File extension .${fileExtension} is valid but the content type is not recognized.`,
        },
        { status: 400 },
      );
    }

    const supabase = await createClient();

    // Get current user (optional for public DFM analysis)
    const {
      data: { user },
    } = await supabase.auth.getUser();

    // Generate file ID and signed URL
    const fileId = uuidv4();
    const filePath = `dfm-uploads/${fileId}/${file.name}`;

    // Create signed URL for upload
    const { data: signedUrlData, error: signedUrlError } =
      await supabase.storage
        .from("cad-files")
        .createSignedUploadUrl(filePath, 3600); // 1 hour expiry

    if (signedUrlError) {
      console.error("Failed to create signed URL:", signedUrlError);
      return NextResponse.json(
        { error: "Failed to create upload URL" },
        { status: 500 },
      );
    }

    // Store file metadata
    const organizationId =
      user?.user_metadata?.organization_id ?? null;
    const { error: insertError } = await supabase.from("dfm_files").insert({
      id: fileId,
      file_name: file.name,
      file_path: filePath,
      file_size: file.size,
      mime_type: file.type,
      organization_id: organizationId,
      uploaded_by: user?.id ?? null,
      created_at: new Date().toISOString(),
    });

    if (insertError) {
      console.error("Failed to store file metadata:", insertError);
      return NextResponse.json(
        { error: "Failed to store file metadata" },
        { status: 500 },
      );
    }

    return NextResponse.json({
      fileId,
      signedUrl: signedUrlData.signedUrl,
      path: signedUrlData.path,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown error occurred";
    console.error("CAD upload error:", { message, stack: error instanceof Error ? error.stack : undefined });
    return NextResponse.json(
      { error: `File upload failed: ${message}` },
      { status: 500 },
    );
  }
}
