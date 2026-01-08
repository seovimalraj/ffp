"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useEffect } from "react";
import Link from "next/link";
import { AlertCircle, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

const errorMessages: Record<string, string> = {
  Configuration: "There is a problem with the server configuration.",
  AccessDenied: "You do not have permission to sign in.",
  Verification: "The verification token has expired or has already been used.",
  OAuthSignin: "Error in constructing an authorization URL.",
  OAuthCallback: "Error handling the OAuth callback.",
  OAuthCreateAccount: "Could not create OAuth provider user in the database.",
  EmailCreateAccount: "Could not create email provider user in the database.",
  Callback: "Error in the OAuth callback handler.",
  OAuthAccountNotLinked:
    "The email is already associated with another account.",
  EmailSignin: "Check your email for the sign in link.",
  CredentialsSignin: "Sign in failed. Check the details you provided are correct.",
  SessionRequired: "Please sign in to access this page.",
  Default: "Unable to sign in.",
};

export default function AuthErrorPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const error = searchParams?.get("error");

  useEffect(() => {
    // Auto-redirect to signin after 5 seconds
    const timer = setTimeout(() => {
      router.push("/signin");
    }, 5000);

    return () => clearTimeout(timer);
  }, [router]);

  const errorMessage =
    (error && errorMessages[error]) || errorMessages.Default;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 space-y-6">
        <div className="flex justify-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
            <AlertCircle className="w-8 h-8 text-red-600" />
          </div>
        </div>

        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold text-gray-900">
            Authentication Error
          </h1>
          <p className="text-gray-600">{errorMessage}</p>
        </div>

        {error && (
          <div className="bg-gray-50 rounded-lg p-4">
            <p className="text-sm text-gray-500">
              Error code: <code className="font-mono">{error}</code>
            </p>
          </div>
        )}

        <div className="space-y-3">
          <Button
            onClick={() => router.push("/signin")}
            className="w-full bg-purple-600 hover:bg-purple-700 text-white h-11"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Sign In
          </Button>

          <p className="text-center text-sm text-gray-500">
            Redirecting automatically in 5 seconds...
          </p>
        </div>

        <div className="pt-4 border-t border-gray-200">
          <p className="text-sm text-gray-600 text-center">
            Need help?{" "}
            <Link
              href="/support"
              className="text-purple-600 hover:text-purple-700 font-medium"
            >
              Contact support
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
