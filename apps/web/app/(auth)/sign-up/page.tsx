import { redirect } from "next/navigation";
import { SignUpForm } from "@/components/auth/SignUpForm";
import ImageCarousel from "@/components/image-carousel";
import { createClient } from "@/lib/supabase/server";
import GridBackground from "@/components/animate-grid-bg";

export default function SignUpPage() {
  async function signUp(formData: FormData) {
    "use server";

    const email = formData.get("email") as string;
    const password = formData.get("password") as string;
    const confirmPassword = formData.get("confirm_password") as string;
    const marketingConsent = formData.get("marketing_consent") === "on";

    if (password !== confirmPassword) {
      redirect("/sign-up?error=Passwords do not match");
    }

    const supabase = await createClient();

    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            marketing_consent: marketingConsent,
          },
        },
      });

      if (error) {
        redirect(`/sign-up?error=${encodeURIComponent(error.message)}`);
      }

      if (data.user && !data.user.email_confirmed_at) {
        // User needs to confirm email
        redirect("/verify-email?email=" + encodeURIComponent(email));
      }

      // User is signed up and confirmed, redirect to onboarding
      redirect("/onboarding");
    } catch (error) {
      console.error("Signup error:", error);
      redirect("/sign-up?error=An unexpected error occurred");
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-4">
      <GridBackground />
      <div className="w-full max-w-6xl bg-white/80 backdrop-blur-xl rounded-3xl overflow-hidden shadow-2xl border border-white/20 flex">
        {/* Left side - Image Carousel */}
        <ImageCarousel />

        <SignUpForm action={signUp} />
      </div>
    </div>
  );
}
