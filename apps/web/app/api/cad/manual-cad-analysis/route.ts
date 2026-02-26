import { analyzeCADFile } from "@/lib/cad-analysis";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { fileUrl, fileName } = await req.json();

    if (!fileUrl) {
      return NextResponse.json({ error: "fileUrl required" }, { status: 400 });
    }

    // download file
    const res = await fetch(fileUrl);
    if (!res.ok) {
      return NextResponse.json(
        { error: "Failed to fetch file" },
        { status: 500 },
      );
    }

    const arrayBuffer = await res.arrayBuffer();

    // 🔧 convert to File object
    const file = new File([arrayBuffer], fileName || "part.step");

    try {
      const geometry = await analyzeCADFile(file);
      return NextResponse.json(geometry);
    } catch (analysisErr: any) {
      console.error("CAD analysis failed, returning default:", analysisErr);
      return NextResponse.json({
        volume: 0,
        surfaceArea: 0,
        boundingBox: { x: 0, y: 0, z: 0 },
        complexity: "simple",
        recommendedProcess: "manual-quote",
        requiresManualQuote: true,
        manualQuoteReason: `CAD analysis failed: ${analysisErr.message}`,
        processConfidence: 0,
        fallbackRequired: true,
      });
    }
  } catch (err: any) {
    console.error("Manual CAD analysis route error:", err);
    return NextResponse.json({
      volume: 0,
      surfaceArea: 0,
      boundingBox: { x: 0, y: 0, z: 0 },
      complexity: "simple",
      recommendedProcess: "manual-quote",
      requiresManualQuote: true,
      manualQuoteReason: `Fallback processing error: ${err.message}`,
      processConfidence: 0,
      fallbackRequired: true,
    });
  }
}
