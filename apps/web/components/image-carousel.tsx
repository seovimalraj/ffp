"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";

export default function ImageCarousel() {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(true);

  const slides = [
    {
      image: "https://frigate.ai/wp-content/uploads/2024/07/Automotive-IMG-1.png",
      title: "Compliance and Reliability with Rigorous Quality Assurance",
      subtitle: "Establish a Continuous Digital Thread Across Systems",
    },
    {
      image: "https://frigate.ai/wp-content/uploads/2024/07/Automotive-IMG-2-1.png",
      title: "Manufacturing Efficiency with Jigs and Fixtures",
      subtitle: "End-to-End Product Development with Iterative Manufacturing",
    },
    {
      image: "https://frigate.ai/wp-content/uploads/2024/07/Automotive-IMG.png",
      title: "Product Development with Rapid Prototyping",
      subtitle: "Quality Certifications and Full Traceability Compliance",
    },
    {
      image: "https://frigate.ai/wp-content/uploads/2024/07/Defense-IMG-4.png",
      title: "Compliance and Reliability with Rigorous Quality Assurance",
      subtitle: "Establish a Continuous Digital Thread Across SystemsBuild Memories",
    },
  ];

  const nextSlide = useCallback(() => {
    setCurrentSlide((prev) => (prev + 1) % slides.length);
  }, [slides.length]);

  const goToSlide = useCallback((index: number) => {
    setCurrentSlide(index);
    setIsAutoPlaying(false);
  }, []);

  useEffect(() => {
    if (!isAutoPlaying) return;
    const interval = setInterval(nextSlide, 5000);
    return () => clearInterval(interval);
  }, [isAutoPlaying, nextSlide]);

  return (
    <div
      className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-black/5"
      onMouseEnter={() => setIsAutoPlaying(false)}
      onMouseLeave={() => setIsAutoPlaying(true)}
    >
      {/* IMAGE + LIQUID GLASS */}
      <div className="absolute inset-0">
        <Image
          src={slides[currentSlide].image}
          alt="carousel"
          fill
          className="object-cover transition-all duration-1000"
          priority={currentSlide === 0}
        />

        {/* Subtle dark overlay for text readability */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/40 to-black/20 pointer-events-none" />
      </div>

      {/* CONTENT */}
      <div className="relative z-10 flex flex-col justify-between p-10 w-full">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="text-white font-bold text-3xl tracking-wide drop-shadow-xl">
            FFP
          </div>

          <Link
            href="/"
            className="group flex items-center gap-2 text-white bg-white/15 hover:bg-white/25 border border-white/20 backdrop-blur-xl px-5 py-2.5 rounded-full text-sm font-medium shadow-lg hover:shadow-xl transition-all"
          >
            Back to website
            <span className="text-lg group-hover:translate-x-1 transition-transform">
              →
            </span>
          </Link>
        </div>

        {/* Text Content */}
        <div className="flex-1 flex items-center justify-center px-8 text-center">
          <div>
            <h2 className="text-3xl md:text-4xl font-semibold text-white drop-shadow-2xl mb-4 transition-all duration-700">
              {slides[currentSlide].title}
            </h2>
            <p className="text-lg text-white/90 font-light drop-shadow-lg transition-all duration-700">
              {slides[currentSlide].subtitle}
            </p>
          </div>
        </div>

        {/* Pagination Dots */}
        <div className="flex justify-center gap-3">
          {slides.map((_, index) => (
            <button
              key={index}
              onClick={() => goToSlide(index)}
              className={`relative rounded-full transition-all focus:outline-none ${
                index === currentSlide
                  ? "w-10 h-2.5 bg-white shadow-lg"
                  : "w-2.5 h-2.5 bg-white/40 border border-white/30 hover:bg-white/60 hover:scale-110"
              }`}
            >
              {index === currentSlide && (
                <span className="absolute inset-0 bg-white/40 rounded-full animate-pulse" />
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
