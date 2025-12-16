import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function HomePage() {
  const session = await getSession();

  if (!session?.user) {
    // Not authenticated - redirect to login
    redirect("/signin");
  }

  // Authenticated user - redirect based on role
  const userRole = session.user.role || "customer";

  if (userRole === "admin" || userRole === "org_admin") {
    redirect("/admin");
  } else {
    redirect(`/${userRole}`);
  }
}
