"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { trackEvent } from "@/lib/analytics/posthog";
import { getSession, signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { notify } from "@/lib/toast";
import {
  Eye,
  EyeOff,
  Loader2,
  Building2,
  User,
  Phone as PhoneIcon,
  ClipboardList,
} from "lucide-react";
import PhoneInput from "react-phone-number-input";
import "react-phone-number-input/style.css";
import { isValidPhone } from "@/lib/validation/phone-validation";
import { CountryCode } from "@/lib/validation/postcode-types";
import { isBannedEmail } from "../../../utils/check-disposable-email";
import {
  validateEmail,
  validatePassword,
} from "@/lib/validation/email.validation";

export function SignUpForm() {
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [country, setCountry] = useState<CountryCode>(CountryCode.IN);

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
  const searchParams = useSearchParams();
  const intent = searchParams?.get("intent");

  useEffect(() => {
    trackEvent("signup_view");
  }, []);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.name) newErrors.name = "Full name is required";

    const emailError = validateEmail(formData.email);
    if (emailError) newErrors.email = emailError;

    const passwordError = validatePassword(formData.password);
    if (passwordError) newErrors.password = passwordError;

    if (!formData.organization_name)
      newErrors.organization_name = "Organization name is required";

    if (!formData.phone_number) {
      newErrors.phone_number = "Phone number is required";
    } else if (!isValidPhone(formData.phone_number, country)) {
      newErrors.phone_number = "Invalid phone number format for your country";
    }

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

  const handlePhoneChange = (value: string | undefined) => {
    setFormData((prev) => ({ ...prev, phone_number: value || "" }));
    if (errors.phone_number) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next.phone_number;
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
      router.push("/verify");
    } catch (err: any) {
      console.error(err);
      trackEvent("signup_failure", { error: err.message });
      notify.error(err.message || "Failed to create account");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full h-full p-8 lg:p-12 flex flex-col justify-center overflow-y-auto">
      <div className="max-w-md mx-auto w-full relative">

        {/* Production Order Intent Banner */}
        {intent === "production-order" && (
          <div className="mb-6 p-4 bg-orange-50 border border-orange-200 rounded-2xl flex items-start gap-3">
            <div className="p-2 bg-orange-100 rounded-xl flex-shrink-0">
              <ClipboardList className="w-5 h-5 text-orange-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-orange-900">Book a Production Order</p>
              <p className="text-xs text-orange-700 mt-0.5 leading-relaxed">
                Create an account to book your production order. You'll be taken directly to the order form after signing up.
              </p>
            </div>
          </div>
        )}

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
                <PhoneIcon className="w-4 h-4 text-gray-400" />
                Phone Number
              </label>
              <div
                className={`phone-input-container ${errors.phone_number ? "phone-input-error" : ""}`}
              >
                <PhoneInput
                  placeholder="Enter phone number"
                  value={formData.phone_number}
                  onChange={handlePhoneChange}
                  onCountryChange={(v) => setCountry(v as CountryCode)}
                  defaultCountry="IN"
                  className="h-12"
                />
              </div>
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

        <p className="mt-8 text-center text-sm text-gray-500">
          Already have an account?{" "}
          <Link
            href={intent ? `/signin?intent=${intent}` : "/signin"}
            className="text-purple-600 font-semibold hover:underline"
          >
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
