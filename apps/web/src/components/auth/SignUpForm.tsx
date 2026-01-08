"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { trackEvent } from "@/lib/analytics/posthog";
import { getSession, signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { notify } from "@/lib/toast";
import { Eye, EyeOff, Loader2, Building2, User, Phone } from "lucide-react";

export function SignUpForm() {
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone_number: "",
    password: "",
    organization_name: "",
    agreeToTerms: false,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const router = useRouter();

  useEffect(() => {
    trackEvent("signup_view");
  }, []);

  const validateEmail = (email: string) => {
    if (!email) return "Email is required";
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) return "Please enter a valid email address";
    return "";
  };

  const validatePassword = (password: string) => {
    if (!password) return "Password is required";
    if (password.length < 6) return "Password must be at least 6 characters";
    return "";
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.name) newErrors.name = "Full name is required";

    const emailError = validateEmail(formData.email);
    if (emailError) newErrors.email = emailError;

    const passwordError = validatePassword(formData.password);
    if (passwordError) newErrors.password = passwordError;

    if (!formData.organization_name)
      newErrors.organization_name = "Organization name is required";

    if (!formData.phone_number)
      newErrors.phone_number = "Phone number is required";

    if (!formData.agreeToTerms) {
      newErrors.agreeToTerms = "You must agree to the terms";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[name];
        return next;
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;

    if (!validateForm()) return;

    setIsLoading(true);

    try {
      trackEvent("signup_submit", { email: formData.email });

      // Map formData to API expected structure
      const apiPayload = {
        email: formData.email,
        password: formData.password,
        organization_name: formData.organization_name,
        name: formData.name,
        phone: formData.phone_number,
      };

      const res = await fetch("/api/auth/register", {
        method: "POST",
        body: JSON.stringify(apiPayload),
        headers: { "Content-Type": "application/json" },
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || data.error || "Registration failed");
      }

      notify.success("Account created successfully!");

      // Auto login with next-auth credentials provider
      const result = await signIn("credentials", {
        email: formData.email,
        password: formData.password,
        redirect: false,
      });

      if (result?.error) {
        notify.error(
          "Account created, but automatic sign-in failed. Please sign in manually.",
        );
        router.push("/signin");
        return;
      }
      const session = await getSession();

      if (!session?.user?.role) {
        notify.error("Invalid session");
        return;
      }

      trackEvent("signup_success", { email: formData.email });
      router.push(`/${session.user.role}`);
    } catch (err: any) {
      console.error(err);
      trackEvent("signup_failure", { error: err.message });
      notify.error(err.message || "Failed to create account");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full lg:w-1/2 bg-white p-8 lg:p-12 flex flex-col justify-center min-h-screen">
      <div className="max-w-md mx-auto w-full relative">
        {/* Header */}
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Create your account
          </h1>
        </div>

        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          <div className="grid grid-cols-1 gap-4">
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1.5 flex items-center gap-2">
                <User className="w-4 h-4 text-gray-400" />
                Full Name
              </label>
              <Input
                name="name"
                placeholder="John Doe"
                value={formData.name}
                onChange={handleChange}
                className={`h-12 border-gray-200 focus:ring-purple-500 ${errors.name ? "border-red-500" : ""}`}
              />
              {errors.name && (
                <p className="text-red-500 text-xs mt-1">{errors.name}</p>
              )}
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 mb-1.5 flex">
                Email Address
              </label>
              <Input
                name="email"
                type="email"
                placeholder="john@example.com"
                value={formData.email}
                onChange={handleChange}
                className={`h-12 border-gray-200 focus:ring-purple-500 ${errors.email ? "border-red-500" : ""}`}
              />
              {errors.email && (
                <p className="text-red-500 text-xs mt-1">{errors.email}</p>
              )}
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 mb-1.5 flex items-center gap-2">
                <Building2 className="w-4 h-4 text-gray-400" />
                Organization Name
              </label>
              <Input
                name="organization_name"
                placeholder="Acme Inc."
                value={formData.organization_name}
                onChange={handleChange}
                className={`h-12 border-gray-200 focus:ring-purple-500 ${errors.organization_name ? "border-red-500" : ""}`}
              />
              {errors.organization_name && (
                <p className="text-red-500 text-xs mt-1">
                  {errors.organization_name}
                </p>
              )}
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 mb-1.5 flex items-center gap-2">
                <Phone className="w-4 h-4 text-gray-400" />
                Phone Number
              </label>
              <Input
                name="phone_number"
                type="tel"
                placeholder="+1 (555) 000-0000"
                value={formData.phone_number}
                onChange={handleChange}
                className={`h-12 border-gray-200 focus:ring-purple-500 ${errors.phone_number ? "border-red-500" : ""}`}
              />
              {errors.phone_number && (
                <p className="text-red-500 text-xs mt-1">
                  {errors.phone_number}
                </p>
              )}
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 mb-1.5 flex">
                Password
              </label>
              <div className="relative">
                <Input
                  name="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={formData.password}
                  onChange={handleChange}
                  className={`h-12 border-gray-200 pr-12 focus:ring-purple-500 ${errors.password ? "border-red-500" : ""}`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {errors.password && (
                <p className="text-red-500 text-xs mt-1">{errors.password}</p>
              )}
            </div>
          </div>

          <div className="pt-2">
            <div className="flex items-start gap-3 p-4 bg-gray-50 rounded-xl">
              <Checkbox
                id="terms"
                checked={formData.agreeToTerms}
                onCheckedChange={(checked) =>
                  setFormData((prev) => ({
                    ...prev,
                    agreeToTerms: Boolean(checked),
                  }))
                }
                className="mt-1"
              />
              <label
                htmlFor="terms"
                className="text-xs text-gray-500 leading-relaxed cursor-pointer select-none"
              >
                By creating an account, you agree to our{" "}
                <Link
                  href="/terms"
                  className="text-purple-600 font-medium hover:underline"
                >
                  Terms of Service
                </Link>{" "}
                and{" "}
                <Link
                  href="/privacy"
                  className="text-purple-600 font-medium hover:underline"
                >
                  Privacy Policy
                </Link>
                .
              </label>
            </div>
            {errors.agreeToTerms && (
              <p className="text-red-500 text-xs mt-1">{errors.agreeToTerms}</p>
            )}
          </div>

          <Button
            type="submit"
            disabled={isLoading}
            className="w-full h-12 bg-purple-600 hover:bg-purple-700 text-white rounded-xl shadow-lg shadow-purple-200 transition-all font-semibold"
          >
            {isLoading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              "Create Account"
            )}
          </Button>
        </form>

        {/* <div className="flex items-center gap-4 my-8">
          <div className="flex-1 h-px bg-gray-100" />
          <span className="text-gray-400 text-xs uppercase tracking-wider font-semibold">
            Or join with
          </span>
          <div className="flex-1 h-px bg-gray-100" />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <button
            type="button"
            onClick={() => signIn("google", { callbackUrl: "/" })}
            className="h-12 border border-gray-200 rounded-xl hover:bg-gray-50 flex items-center justify-center gap-2 transition-all font-medium text-gray-700"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
            </svg>
            Google
          </button>

          <button
            type="button"
            onClick={() => signIn("apple", { callbackUrl: "/" })}
            className="h-12 border border-gray-200 rounded-xl hover:bg-gray-50 flex items-center justify-center gap-2 transition-all font-medium text-gray-700"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09v-.01z" />
              <path d="M12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
            </svg>
            Apple
          </button>
        </div> */}

        <p className="mt-8 text-center text-sm text-gray-500">
          Already have an account?{" "}
          <Link
            href="/signin"
            className="text-purple-600 font-semibold hover:underline"
          >
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
