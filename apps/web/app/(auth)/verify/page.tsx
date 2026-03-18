"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { notify } from "@/lib/toast";
import { Loader2, Mail } from "lucide-react";
import { useSession } from "next-auth/react";
import axios from "axios";
import VerifyLoader from "@/components/auth/VerifyLoader";
import { PasswordChangeModal } from "@/components/auth/PasswordChangeModal";

export default function VerifyPage() {
  const [otp, setOtp] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [isPasswordResetModalOpen, setIsPasswordResetModalOpen] =
    useState(false);
  const [otpStatus, setOtpStatus] = useState<{
    hasActiveOtp: boolean;
    cooldownRemaining: number;
  } | null>(null);
  const session = useSession();
  const router = useRouter();

  const checkOtpStatus = async () => {
    try {
      const res = await axios.post("/api/otp-status");
      setOtpStatus(res.data);
    } catch (error) {
      console.error("Failed to check OTP status:", error);
    }
  };

  // Handle redirect for unauthenticated users
  useEffect(() => {
    if (session.status === "unauthenticated") {
      router.push("/signin");
    }
  }, [session.status, router]);

  // Handle redirect for already verified users
  useEffect(() => {
    if (session.data?.user?.verified === true && !isPasswordResetModalOpen) {
      const dashboardPath =
        session.data?.user?.role === "supplier"
          ? "/supplier/dashboard"
          : "/portal/dashboard";
      router.push(dashboardPath);
    }
  }, [
    session.data?.user?.verified,
    session.data?.user?.role,
    router,
    isPasswordResetModalOpen,
  ]);

  // Check OTP status on mount
  useEffect(() => {
    if (session.status === "authenticated") {
      checkOtpStatus();
    }
  }, [session.status]);

  // Cooldown timer logic
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (otpStatus && otpStatus.cooldownRemaining > 0) {
      timer = setInterval(() => {
        setOtpStatus((prev) =>
          prev
            ? {
                ...prev,
                cooldownRemaining: Math.max(0, prev.cooldownRemaining - 1),
              }
            : null,
        );
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [otpStatus?.cooldownRemaining]);

  const handleVerify = async () => {
    if (otp.length !== 6) {
      notify.error("Please enter a valid 6-digit OTP");
      return;
    }

    setIsLoading(true);
    try {
      const res = await axios.post("/api/verify-otp", {
        code: otp,
      });

      if (!res) {
        throw new Error("Verification failed");
      }

      notify.success("Verified successfully!");

      // Update session to reflect verified status
      if (session.data?.user?.role === "supplier") {
        setIsPasswordResetModalOpen(true);
        await session.update({ verified: true });
      } else {
        await session.update({ verified: true });
        router.push("/portal/dashboard");
      }
    } catch (error: any) {
      const errorMessage =
        error.response?.data?.error ||
        error.message ||
        "Invalid OTP. Please try again.";
      notify.error(errorMessage);

      if (error.response?.status === 401) {
        setTimeout(() => {
          router.push("/signin");
        }, 2000);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (otpStatus?.cooldownRemaining && otpStatus.cooldownRemaining > 0) return;

    setIsResending(true);
    try {
      await axios.post("/api/resend-otp");
      notify.success("OTP sent successfully!");
      await checkOtpStatus();
    } catch (error: any) {
      const errorMessage =
        error.response?.data?.error ||
        error.message ||
        "Failed to send OTP. Please try again.";
      notify.error(errorMessage);
    } finally {
      setIsResending(false);
    }
  };

  if (session.status === "loading" || !otpStatus) {
    return <VerifyLoader />;
  }

  return (
    <>
      <div className="w-full h-full p-8 lg:p-12 flex flex-col justify-center overflow-y-auto">
        <div className="max-w-md mx-auto w-full relative">
          {!otpStatus.hasActiveOtp ? (
            <div className="text-center">
              <div className="mx-auto w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-6">
                <Mail className="w-8 h-8 text-purple-600" />
              </div>
              <h1 className="text-3xl font-bold text-gray-900 mb-4">
                Email Verification Needed
              </h1>
              <p className="text-gray-500 mb-8">
                To ensure the security of your account, we need to verify your
                email address. Click the button below to receive a verification
                code.
              </p>
              <Button
                onClick={handleResendOtp}
                disabled={isResending || otpStatus.cooldownRemaining > 0}
                className="w-full h-12 bg-purple-600 hover:bg-purple-700 text-white rounded-xl shadow-lg transition-all font-semibold"
              >
                {isResending ? (
                  <Loader2 className="w-5 h-5 animate-spin mr-2" />
                ) : null}
                {otpStatus.cooldownRemaining > 0
                  ? `Resend in ${otpStatus.cooldownRemaining}s`
                  : "Send Verification Code"}
              </Button>
            </div>
          ) : (
            <>
              <div className="mb-8 text-center">
                <div className="mx-auto w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mb-4">
                  <Mail className="w-6 h-6 text-purple-600" />
                </div>
                <h1 className="text-3xl font-bold text-gray-900 mb-2">
                  Check your email
                </h1>
                <p className="text-gray-500">
                  We sent a verification code to your email. Enter the code
                  below to verify your account.
                </p>
              </div>

              <div className="space-y-6">
                <div className="flex justify-center">
                  <InputOTP
                    maxLength={6}
                    value={otp}
                    onChange={(value) => setOtp(value)}
                  >
                    <InputOTPGroup>
                      <InputOTPSlot index={0} />
                      <InputOTPSlot index={1} />
                      <InputOTPSlot index={2} />
                      <InputOTPSlot index={3} />
                      <InputOTPSlot index={4} />
                      <InputOTPSlot index={5} />
                    </InputOTPGroup>
                  </InputOTP>
                </div>

                <Button
                  onClick={handleVerify}
                  disabled={isLoading || otp.length !== 6}
                  className="w-full h-12 bg-purple-600 hover:bg-purple-700 text-white rounded-xl shadow-lg shadow-purple-200 transition-all font-semibold"
                >
                  {isLoading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    "Verify Email"
                  )}
                </Button>

                <p className="text-center text-sm text-gray-500">
                  Didn't receive the code?{" "}
                  <button
                    disabled={isResending || otpStatus.cooldownRemaining > 0}
                    onClick={handleResendOtp}
                    className={`font-semibold hover:underline ${
                      otpStatus.cooldownRemaining > 0
                        ? "text-gray-400 cursor-not-allowed"
                        : "text-purple-600"
                    }`}
                    type="button"
                  >
                    {otpStatus.cooldownRemaining > 0
                      ? `Resend in ${otpStatus.cooldownRemaining}s`
                      : "Click to resend"}
                  </button>
                </p>
              </div>
            </>
          )}
        </div>
      </div>
      <PasswordChangeModal
        isOpen={isPasswordResetModalOpen}
        onClose={() => setIsPasswordResetModalOpen(false)}
        onSuccess={() => router.push("/supplier/dashboard")}
      />
    </>
  );
}
