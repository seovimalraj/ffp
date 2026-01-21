import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { fileId, lineId, quoteId } = body;

    if (!fileId || !lineId || !quoteId) {
      return NextResponse.json(
        { error: "Missing required fields: fileId, lineId, quoteId" },
        { status: 400 },
      );
    }

    // Generate task ID
    const taskId = `cad_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;

    // Connect to CAD service for real analysis
    const cadServiceUrl =
      process.env.CAD_SERVICE_URL || "http://cad-service:10001";

    try {
      const cadResponse = await fetch(`${cadServiceUrl}/api/cad/analyze`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          file_id: fileId,
          quote_line_id: lineId,
          process: "cnc", // Default to CNC, can be made configurable
          material: "aluminum_6061", // Default material
          units: "mm",
        }),
      });

      if (!cadResponse.ok) {
        console.error(
          "CAD service error:",
          cadResponse.status,
          cadResponse.statusText,
        );
        return NextResponse.json(
          { error: "CAD service is currently unavailable" },
          { status: 503 },
        );
      }

      const cadResult = await cadResponse.json();

      return NextResponse.json({
        taskId,
        fileId,
        lineId,
        quoteId,
        status: cadResult.status || "processing",
        createdAt: new Date().toISOString(),
        estimatedDuration: cadResult.estimated_duration || 20000,
        progress: cadResult.progress || 0,
        ...cadResult,
      });
    } catch (cadError) {
      console.error("CAD service connection error:", cadError);
      return NextResponse.json(
        { error: "Failed to connect to CAD service" },
        { status: 500 },
      );
    }
  } catch (error) {
    console.error("CAD analysis error:", error);
    return NextResponse.json(
      { error: "Failed to start CAD analysis" },
      { status: 500 },
    );
  }
}
