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
import CustomLoader from "@/components/ui/loader/CustomLoader";
import axios from "axios";

export default function VerifyPage() {
  const [otp, setOtp] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const session = useSession();
  const router = useRouter();

  // Handle redirect for unauthenticated users
  useEffect(() => {
    if (session.status === "unauthenticated") {
      router.push("/signin");
    }
  }, [session.status, router]);

  // Handle redirect for already verified users
  useEffect(() => {
    if (session.data?.user.verified === true) {
      router.push("/portal/dashboard");
    }
  }, [session.data?.user.verified, router]);

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
      await session.update({ verified: true });

      router.push("/portal/dashboard");
    } catch (error: any) {
      notify.error(error.message || "Invalid OTP. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  if (session.status === "loading") {
    return <CustomLoader />;
  }

  return (
    <div className="w-full h-full p-8 lg:p-12 flex flex-col justify-center overflow-y-auto">
      <div className="max-w-md mx-auto w-full relative">
        <div className="mb-8 text-center">
          <div className="mx-auto w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mb-4">
            <Mail className="w-6 h-6 text-purple-600" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Check your email
          </h1>
          <p className="text-gray-500">
            We sent a verification code to your email. Enter the code below to
            verify your account.
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
              onClick={() => notify.info("Resend functionality coming soon")}
              className="text-purple-600 font-semibold hover:underline"
              type="button"
            >
              Click to resend
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
