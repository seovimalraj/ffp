"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { trackEvent } from "@/lib/analytics/posthog";
import { signIn, getSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { notify } from "@/lib/toast";
import {
  Eye,
  EyeOff,
  Loader2,
  AlertCircle,
  Globe,
  MessageCircle,
  ClipboardList,
} from "lucide-react";
import { formatUrlForRole, useMetaStore } from "@/components/store/title-store";
import { SocialLinks } from "@cnc-quote/shared";

export function SignInForm() {
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [emailError, setEmailError] = useState("");
  const [passwordError, setPasswordError] = useState("");

  const [formData, setFormData] = useState({
    email: "",
    password: "",
    agreeToTerms: false,
  });

  const router = useRouter();
  const searchParams = useSearchParams();
  const { redirectUrl, setRedirectUrl } = useMetaStore();
  const error = searchParams?.get("error");
  const intent = searchParams?.get("intent");

  useEffect(() => {
    trackEvent("signin_view");
  }, []);

  // Load saved email from localStorage
  useEffect(() => {
    const savedEmail = localStorage.getItem("rememberedEmail");
    if (savedEmail) {
      setFormData((prev) => ({
        ...prev,
        email: savedEmail,
        agreeToTerms: true,
      }));
    }
  }, []);

  const validateEmail = useCallback((email: string) => {
    if (!email) {
      setEmailError("Email is required");
      return false;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setEmailError("Please enter a valid email address");
      return false;
    }
    setEmailError("");
    return true;
  }, []);

  const validatePassword = useCallback((password: string) => {
    if (!password) {
      setPasswordError("Password is required");
      return false;
    }
    if (password.length < 6) {
      setPasswordError("Password must be at least 6 characters");
      return false;
    }
    setPasswordError("");
    return true;
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));

    // Clear errors on change
    if (name === "email") setEmailError("");
    if (name === "password") setPasswordError("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const { email, password } = formData;

    // Validate before submitting
    const isEmailValid = validateEmail(email);
    const isPasswordValid = validatePassword(password);

    if (!isEmailValid || !isPasswordValid) {
      return;
    }

    setIsLoading(true);

    try {
      // Save email if remember me is checked
      if (formData.agreeToTerms) {
        localStorage.setItem("rememberedEmail", email);
      } else {
        localStorage.removeItem("rememberedEmail");
      }

      trackEvent("signin_submit", {
        has_email: !!email,
        remember_me: formData.agreeToTerms,
      });

      const response = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (response?.error) {
        trackEvent("signin_failure", { error: response.error });
        notify.error(
          response.error === "CredentialsSignin"
            ? "Invalid email or password"
            : response.error,
        );
        return;
      }

      const session = await getSession();

      if (!session?.user?.role) {
        notify.error("Invalid session");
        return;
      }

      console.log(session.user.role, session.user, session);

      trackEvent("signin_success", { role: session.user.role });
      notify.success("Welcome back!");
      // Unverified suppliers must verify before accessing the portal
      if (session.user.role === "supplier" && !session.user.verified) {
        router.push("/verify");
      } else if (redirectUrl) {
        setRedirectUrl("");
        router.push(
          formatUrlForRole(redirectUrl, session?.user?.role || "customer"),
        );
      } else {
        router.push(`/${session.user.role}`);
      }
    } catch (err) {
      trackEvent("signin_failure", {
        error: err instanceof Error ? err.message : "Unknown error",
      });
      notify.error("Unable to sign in. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const apiUrl = process.env.INTERNAL_API_URL || "https://ffp-api.frigate.ai";

  console.log("API:", apiUrl);

  return (
    <div className="w-full h-full p-8 lg:p-12 flex flex-col justify-center">
      <div className="max-w-md mx-auto w-full">

        {/* Production Order Intent Banner */}
        {intent === "production-order" && (
          <div className="mb-6 p-4 bg-orange-50 border border-orange-200 rounded-2xl flex items-start gap-3">
            <div className="p-2 bg-orange-100 rounded-xl flex-shrink-0">
              <ClipboardList className="w-5 h-5 text-orange-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-orange-900">Book a Production Order</p>
              <p className="text-xs text-orange-700 mt-0.5 leading-relaxed">
                Sign in to continue booking your production order. You'll be taken directly to the order form after logging in.
              </p>
            </div>
          </div>
        )}

        <h1 className="text-4xl font-bold text-gray-900 mb-2">
          Sign in to your account
        </h1>
        <p className="text-gray-600 mb-8">
          Don't have an account?{" "}
          <Link
            href={intent ? `/sign-up?intent=${intent}` : "/sign-up"}
            className="text-purple-600 hover:text-purple-700 font-medium transition-colors underline-offset-2 hover:underline"
          >
            Sign up
          </Link>
        </p>

        {error && (
          <div
            className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3"
            role="alert"
          >
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <p className="text-red-700 text-sm">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5" noValidate>
          {/* Email */}
          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              Email address
            </label>
            <Input
              id="email"
              type="email"
              name="email"
              placeholder="you@example.com"
              value={formData.email}
              onChange={handleChange}
              onBlur={() => validateEmail(formData.email)}
              autoComplete="email"
              aria-invalid={!!emailError}
              aria-describedby={emailError ? "email-error" : undefined}
              className={`bg-white border-gray-300 text-gray-900 placeholder:text-gray-400 h-12 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all ${
                emailError ? "border-red-500 focus:ring-red-500" : ""
              }`}
              required
            />
            {emailError && (
              <p
                id="email-error"
                className="mt-1.5 text-sm text-red-600 flex items-center gap-1"
              >
                <AlertCircle className="w-4 h-4" />
                {emailError}
              </p>
            )}
          </div>

          {/* Password */}
          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              Password
            </label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                name="password"
                placeholder="Enter your password"
                value={formData.password}
                onChange={handleChange}
                onBlur={() => validatePassword(formData.password)}
                autoComplete="current-password"
                aria-invalid={!!passwordError}
                aria-describedby={passwordError ? "password-error" : undefined}
                className={`bg-white border-gray-300 text-gray-900 placeholder:text-gray-400 h-12 rounded-lg pr-12 focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all ${
                  passwordError ? "border-red-500 focus:ring-red-500" : ""
                }`}
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 transition-colors focus:outline-none focus:ring-2 focus:ring-purple-500 rounded"
              >
                {showPassword ? (
                  <EyeOff className="w-5 h-5" />
                ) : (
                  <Eye className="w-5 h-5" />
                )}
              </button>
            </div>
            {passwordError && (
              <p
                id="password-error"
                className="mt-1.5 text-sm text-red-600 flex items-center gap-1"
              >
                <AlertCircle className="w-4 h-4" />
                {passwordError}
              </p>
            )}
          </div>

          <Button
            type="submit"
            disabled={isLoading}
            className="w-full h-12 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-400 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-all shadow-sm hover:shadow-md focus:ring-2 focus:ring-purple-500 focus:ring-offset-2"
          >
            {isLoading ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="w-5 h-5 animate-spin" />
                Signing in...
              </span>
            ) : (
              "Sign in"
            )}
          </Button>
        </form>

        {/* Divider */}
        <div className="flex items-center gap-4 my-8">
          <div className="flex-1 h-px bg-gray-200" />
          <span className="text-gray-500 text-sm">Quick Links</span>
          <div className="flex-1 h-px bg-gray-200" />
        </div>

        {/* Navigation Buttons */}
        <div className="grid grid-cols-2 gap-4">
          <Link
            href={SocialLinks.FrigateOfficialSiteFFP}
            target="_blank"
            rel="noopener noreferrer"
            className="h-12 border-2 border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 hover:border-gray-300 transition-all flex items-center justify-center gap-2 font-medium focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2"
          >
            <img src="/logos/ffp shorten logo.png" className="w-5 h-5 invert" />
            Main Site
          </Link>
          <Link
            href="/support"
            className="h-12 border-2 border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 hover:border-gray-300 transition-all flex items-center justify-center gap-2 font-medium focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2"
          >
            <MessageCircle className="w-5 h-5" />
            Support
          </Link>
        </div>
      </div>
    </div>
  );
}
