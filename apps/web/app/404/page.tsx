"use client";
import { useSearchParams, useRouter } from "next/navigation";
import Image from "next/image";

export default function NotFoundPage() {
  const params = useSearchParams();
  const router = useRouter();
  const isUnderDevelopment = params?.get("dev") === "true";

  const handleGoBack = () => {
    router.back();
  };

  const handleGoHome = () => {
    router.push("/portal");
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-12">
      <div className="max-w-xl w-full text-center">
        {/* Illustration */}
        <div className="mb-8 flex justify-center">
          <Image
            src="/404_illustration_1767787184306.png"
            alt="404 Illustration"
            width={300}
            height={300}
            className="object-contain"
            priority
          />
        </div>

        {/* Title */}
        <h1 className="text-4xl font-bold text-gray-900 mb-4">
          {isUnderDevelopment ? "Under Construction" : "Page Not Found"}
        </h1>

        {/* Description */}
        <p className="text-lg text-gray-600 mb-10 leading-relaxed">
          {isUnderDevelopment
            ? "We're currently working on this page. Please check back later."
            : "The page you're looking for doesn't exist or has been moved."}
        </p>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
          <button
            onClick={handleGoHome}
            className="w-full sm:w-auto px-6 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors duration-200 flex items-center justify-center gap-2"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
              />
            </svg>
            <span>Go to Dashboard</span>
          </button>

          <button
            onClick={handleGoBack}
            className="w-full sm:w-auto px-6 py-2.5 bg-white border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors duration-200 flex items-center justify-center gap-2"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10 19l-7-7m0 0l7-7m-7 7h18"
              />
            </svg>
            <span>Go Back</span>
          </button>
        </div>

        {/* Help Link */}
        <div className="mt-12 pt-8 border-t border-gray-200">
          <p className="text-sm text-gray-500">
            Need help?{" "}
            <a
              href="#"
              className="text-blue-600 hover:text-blue-800 font-medium"
            >
              Contact Support
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
