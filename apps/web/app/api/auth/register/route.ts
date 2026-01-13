import { NextRequest, NextResponse } from "next/server";
import { AuthService, createAuthResponse } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    const data = await request.json();

    if (!data.email || !data.password || !data.name) {
      return NextResponse.json(
        { error: "Email, password, and name are required" },
        { status: 400 },
      );
    }

    const result = await AuthService.register(data);
    return createAuthResponse(result.user, result.token);
  } catch (_error) {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
