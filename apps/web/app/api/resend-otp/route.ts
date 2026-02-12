import { NextRequest, NextResponse } from "next/server";
import { AuthService, getSession } from "@/lib/auth";

export async function POST(_request: NextRequest) {
  try {
    const session = await getSession();

    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;

    if (!userId) {
      return NextResponse.json(
        { error: "Authentication token missing. Please sign in again." },
        { status: 401 },
      );
    }

    const result = await AuthService.resendOTP(userId);
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 },
    );
  }
}
