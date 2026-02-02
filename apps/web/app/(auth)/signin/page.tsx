import { AuroraBackground } from "@/components/aurora-background";
import { SignInForm } from "@/components/auth/SignInForm";
import ImageCarousel from "@/components/image-carousel";

export default function SignupPage() {
  return (
    <AuroraBackground className="overflow-hidden">
      <div className="relative w-full max-w-5xl z-10 flex flex-col lg:flex-row rounded-3xl overflow-hidden shadow-2xl border border-white/40 ring-1 ring-white/50 backdrop-blur-md bg-white/40 min-h-[600px]">
        {/* Left side - Image Carousel */}
        <ImageCarousel />

        {/* Right side - Signup Form */}
        <div className="w-full lg:w-1/2 relative">
          {/* Inner Light Effect */}
          <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-transparent pointer-events-none" />
          <SignInForm />
        </div>
      </div>
    </AuroraBackground>
  );
}
