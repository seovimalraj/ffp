"use client";

import { AlertTriangle, Clock, XCircle } from "lucide-react";
import { useState } from "react";

interface ExpirationBannerProps {
  quoteId: string;
  status: "draft" | "active" | "expired" | "won" | "lost";
  expiresAt: Date | null;
  canExtend?: boolean;
  canReprice?: boolean;
  onExtend?: () => void;
  onReprice?: () => void;
}

export function ExpirationBanner({
  status,
  expiresAt,
  canExtend = false,
  canReprice = false,
  onExtend,
  onReprice,
}: ExpirationBannerProps) {
  const [dismissed, setDismissed] = useState(false);

  if (
    !expiresAt ||
    status === "won" ||
    status === "lost" ||
    status === "draft"
  ) {
    return null;
  }

  if (dismissed && status !== "expired") {
    return null;
  }

  const now = new Date();
  const expiresDate = new Date(expiresAt);
  const daysLeft = Math.ceil(
    (expiresDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
  );
  const hoursLeft = Math.ceil(
    (expiresDate.getTime() - now.getTime()) / (1000 * 60 * 60),
  );

  // Determine banner state
  let variant: "info" | "warning" | "error" = "info";
  let icon = <Clock className="h-5 w-5" />;
  let message = "";

  if (status === "expired") {
    variant = "error";
    icon = <XCircle className="h-5 w-5" />;
    message = "This quote has expired and is now read-only.";
  } else if (daysLeft <= 0 || hoursLeft <= 0) {
    variant = "error";
    icon = <AlertTriangle className="h-5 w-5" />;
    message = "This quote expires today!";
  } else if (daysLeft <= 2) {
    variant = "warning";
    icon = <AlertTriangle className="h-5 w-5" />;
    message = `This quote expires in ${daysLeft} day${daysLeft !== 1 ? "s" : ""}.`;
  } else if (daysLeft <= 7) {
    variant = "info";
    icon = <Clock className="h-5 w-5" />;
    message = `This quote expires in ${daysLeft} days on ${expiresDate.toLocaleDateString()}.`;
  } else {
    // More than 7 days - don't show banner
    return null;
  }

  const variantStyles = {
    info: "bg-blue-50 border-blue-200 text-blue-900",
    warning: "bg-yellow-50 border-yellow-200 text-yellow-900",
    error: "bg-red-50 border-red-200 text-red-900",
  };

  const buttonStyles = {
    info: "bg-blue-600 hover:bg-blue-700 text-white",
    warning: "bg-yellow-600 hover:bg-yellow-700 text-white",
    error: "bg-red-600 hover:bg-red-700 text-white",
  };

  return (
    <div
      className={`border-l-4 p-4 ${variantStyles[variant]} flex items-start gap-3 rounded-lg`}
      role="alert"
    >
      <div className="flex-shrink-0">{icon}</div>

      <div className="flex-1">
        <p className="font-medium">{message}</p>

        {status === "expired" && (
          <p className="mt-1 text-sm">
            To update this quote, you can generate a reprice with current
            pricing {canExtend && "or extend the expiration date"}.
          </p>
        )}
      </div>

      <div className="flex gap-2">
        {status === "expired" && canReprice && onReprice && (
          <button
            onClick={onReprice}
            className={`px-4 py-2 rounded-md text-sm font-medium ${buttonStyles[variant]}`}
          >
            Reprice Quote
          </button>
        )}

        {canExtend && onExtend && (
          <button
            onClick={onExtend}
            className={`px-4 py-2 rounded-md text-sm font-medium border ${
              variant === "error"
                ? "border-red-600 text-red-600 hover:bg-red-50"
                : variant === "warning"
                  ? "border-yellow-600 text-yellow-600 hover:bg-yellow-50"
                  : "border-blue-600 text-blue-600 hover:bg-blue-50"
            }`}
          >
            Extend Expiration
          </button>
        )}

        {status !== "expired" && (
          <button
            onClick={() => setDismissed(true)}
            className="text-gray-400 hover:text-gray-600"
            aria-label="Dismiss"
          >
            <XCircle className="h-5 w-5" />
          </button>
        )}
      </div>
    </div>
  );
}
