import { NextRequest, NextResponse } from "next/server";
import { AuthService, getSession } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();

    // Check if user is authenticated
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get userId from session for Bearer token
    const userId = session.user.id;

    // If no userId, user needs to re-authenticate
    if (!userId) {
      return NextResponse.json(
        { error: "Authentication token missing. Please sign in again." },
        { status: 401 },
      );
    }

    const { code } = await request.json();

    if (!code) {
      return NextResponse.json(
        { error: "Verification code is required" },
        { status: 400 },
      );
    }

    // Pass userId (not JWT accessToken) since backend AuthGuard expects Bearer {userId}
    const result = await AuthService.verifyOTP(code, userId);
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 },
    );
  }
}
