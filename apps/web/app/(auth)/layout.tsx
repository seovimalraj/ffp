"use client";

import { AuroraBackground } from "@/components/aurora-background";
import ImageCarousel from "@/components/image-carousel";
import { usePathname } from "next/navigation";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const canShowCarousel = pathname !== "/verify";

  return (
    <AuroraBackground className="overflow-hidden">
      <div className="relative w-full max-w-5xl z-10 flex flex-col lg:flex-row rounded-3xl overflow-hidden shadow-2xl border border-white/40 ring-1 ring-white/50 backdrop-blur-md bg-white/40 min-h-[600px]">
        {/* Left side - Image Carousel */}
        {canShowCarousel && <ImageCarousel />}

        {/* Right side - Form Content */}
        {children}
      </div>
    </AuroraBackground>
  );
}
