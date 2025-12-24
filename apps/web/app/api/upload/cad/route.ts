import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { v4 as uuidv4 } from "uuid";

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

    // Validate file type
    // const allowedTypes = [
    //   'application/step',
    //   'application/sldprt',
    //   'model/x.stl',
    //   'application/x-zip-compressed',
    //   'application/zip'
    // ];

    const fileExtension = file.name.split(".").pop()?.toLowerCase();
    const allowedExtensions = [
      "step",
      "stp",
      "iges",
      "igs",
      "sldprt",
      "x_t",
      "x_b",
      "jt",
      "3mf",
      "dxf",
      "stl",
      "zip",
    ];

    if (!allowedExtensions.includes(fileExtension || "")) {
      return NextResponse.json(
        { error: "Unsupported file type" },
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
    const { error: insertError } = await supabase.from("dfm_files").insert({
      id: fileId,
      file_name: file.name,
      file_path: filePath,
      file_size: file.size,
      mime_type: file.type,
      organization_id: user?.id,
      uploaded_by: user?.id,
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
    console.error("CAD upload error:", error);
    return NextResponse.json({ error: "File upload failed" }, { status: 500 });
  }
}
