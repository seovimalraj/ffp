import GridBackground from "@/components/animate-grid-bg";
import { SignInForm } from "@/components/auth/SignInForm";
import ImageCarousel from "@/components/image-carousel";

export default function SignupPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-4">
      <GridBackground />
      <div className="w-full max-w-6xl bg-white/80 backdrop-blur-xl rounded-3xl overflow-hidden shadow-2xl border  border-white/20 flex">
        {/* Left side - Image Carousel */}
        <ImageCarousel />

        {/* Right side - Signup Form */}
        <SignInForm />
      </div>
    </div>
  );
}
