import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    // Connect to CAD service for geometry extraction
    const cadServiceUrl = process.env.CAD_SERVICE_URL || 'http://localhost:10001';

    try {
      // Forward the file to CAD service
      const cadFormData = new FormData();
      cadFormData.append('file', file);

      const cadResponse = await fetch(`${cadServiceUrl}/extract-step-features`, {
        method: 'POST',
        body: cadFormData,
      });

      if (!cadResponse.ok) {
        console.error('CAD service error:', cadResponse.status, cadResponse.statusText);
        return NextResponse.json(
          { error: 'CAD service is currently unavailable' },
          { status: 503 }
        );
      }

      const cadResult = await cadResponse.json();

      // Return extracted features
      return NextResponse.json({
        volume: cadResult.volume,
        surface_area: cadResult.surface_area,
        dimensions: cadResult.dimensions,
        features: cadResult.features,
        complexity: cadResult.complexity,
      });

    } catch (cadError) {
      console.error('CAD service connection error:', cadError);
      // Return error so fallback estimation can be used
      return NextResponse.json(
        { error: 'CAD service unavailable' },
        { status: 503 }
      );
    }

  } catch (error) {
    console.error('Feature extraction error:', error);
    return NextResponse.json(
      { error: 'Failed to extract features' },
      { status: 500 }
    );
  }
}
