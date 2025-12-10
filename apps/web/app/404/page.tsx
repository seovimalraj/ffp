"use client";
import { useSearchParams } from "next/navigation";

export default function NotFoundPage() {
  const params = useSearchParams();
  const isUnderDevelopment = params?.get("dev") === "true";

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 flex items-center justify-center px-4">
      <div className="max-w-lg w-full">
        {/* Card */}
        <div className="bg-white shadow-xl rounded-2xl border border-gray-200 p-10 text-center">
          {/* Title */}
          <h1 className="text-5xl font-extrabold text-gray-900 mb-3">404</h1>

          <h2 className="text-xl font-semibold text-gray-700 mb-4">
            {isUnderDevelopment ? "Under Development" : "Page Not Found"}
          </h2>

          {/* Description */}
          <p className="text-gray-600 mb-10 leading-relaxed">
            {isUnderDevelopment
              ? "This page is currently being built. Check back soon."
              : "The page you’re trying to access doesn’t exist or has been moved."}
          </p>

          {/* Actions */}
          <div className="space-y-3">
            <button
              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium shadow-sm hover:bg-blue-700 transition"
              disabled
            >
              <span>🏠</span> 
              <span>Go to Dashboard</span>
            </button>

            <button
              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg font-medium shadow-sm hover:bg-gray-50 transition"
              disabled
            >
              <span>⬅️</span>
              <span>Go Back</span>
            </button>

            <button
              className="w-full px-4 py-2 text-gray-700 rounded-lg font-medium border border-gray-200 hover:bg-gray-50 transition"
              disabled
            >
              Help Center
            </button>
          </div>

          {/* Footer Note */}
          <div className="mt-10 pt-6 border-t border-gray-200">
            <p className="text-xs text-gray-500">
              If you believe this is an error,{" "}
              <span className="text-blue-600 font-medium cursor-not-allowed opacity-60">
                contact support
              </span>
              .
            </p>
          </div>
        </div>

        {/* Demo Notice */}
        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-xl p-4">
          <h3 className="text-sm font-semibold text-blue-900 mb-2">404 Demo</h3>
          <p className="text-sm text-blue-800 leading-relaxed">
            This is a preview of the 404 page. In the live product, navigation
            actions will be enabled for users based on access and routes.
          </p>
        </div>
      </div>
    </div>
  );
}
