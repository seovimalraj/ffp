import { NextRequest, NextResponse } from "next/server";
import { AuthService, getSession } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();

    if (!session || !(session as any).accessToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { code } = await request.json();

    if (!code) {
      return NextResponse.json(
        { error: "Verification code is required" },
        { status: 400 },
      );
    }

    const result = await AuthService.verifyOTP(
      code,
      (session as any).accessToken,
    );
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 },
    );
  }
}
