"use client";

import { useState } from "react";
import { BaseModal } from "@/components/ui/modal/BaseModal";
import { FormField, Input } from "@/components/ui/form-field";
import { Button } from "@/components/ui/button";
import { Loader2, Lock } from "lucide-react";
import { notify } from "@/lib/toast";
import { apiClient } from "@/lib/api";

interface PasswordChangeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function PasswordChangeModal({
  isOpen,
  onClose,
  onSuccess,
}: PasswordChangeModalProps) {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password.length < 8) {
      notify.error("Password must be at least 8 characters long");
      return;
    }

    if (password !== confirmPassword) {
      notify.error("Passwords do not match");
      return;
    }

    setIsLoading(true);
    try {
      const response = await apiClient.post("/auth/reset-password", {
        password,
      });

      if (!response) {
        throw new Error("Failed to reset password");
      }
      notify.success("Password updated successfully!");
      onSuccess();
    } catch (error: any) {
      const errorMessage =
        error.response?.data?.error ||
        error.message ||
        "Failed to update password. Please try again.";
      notify.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title="Set New Password"
      description="Please set a new password for your supplier account."
      size="md"
    >
      <form onSubmit={handlePasswordChange} className="space-y-6">
        <div className="mx-auto w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mb-6">
          <Lock className="w-8 h-8 text-purple-600" />
        </div>

        <FormField label="New Password" required>
          <Input
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="new-password"
          />
        </FormField>

        <FormField label="Confirm New Password" required>
          <Input
            type="password"
            placeholder="••••••••"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            autoComplete="new-password"
          />
        </FormField>

        <Button
          type="submit"
          disabled={isLoading || !password || !confirmPassword}
          className="w-full h-12 bg-purple-600 hover:bg-purple-700 text-white rounded-xl shadow-lg transition-all font-semibold"
        >
          {isLoading ? (
            <Loader2 className="w-5 h-5 animate-spin mr-2" />
          ) : (
            "Change Password & Continue"
          )}
        </Button>
      </form>
    </BaseModal>
  );
}
