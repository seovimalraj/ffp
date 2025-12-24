import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    // Check if user is authenticated via cookies
    const userDataCookie = request.cookies.get("user-data")?.value;

    if (!userDataCookie) {
      return NextResponse.json({ user: null }, { status: 401 });
    }

    // Parse user data from cookie
    let userData;
    try {
      userData = JSON.parse(userDataCookie);
    } catch (_error) {
      return NextResponse.json({ user: null }, { status: 401 });
    }

    // Return user data (middleware already validates authentication)
    return NextResponse.json({
      user: {
        id: userData.id,
        email: userData.email,
        role: userData.role,
        organization_id: userData.organization_id,
        sub: userData.id, // For compatibility
      },
    });
  } catch (error) {
    console.error("Session check error:", error);
    return NextResponse.json({ user: null }, { status: 500 });
  }
}
