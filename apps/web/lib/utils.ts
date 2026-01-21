import { PartConfig } from "@/types/part-config";
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const LEAD_TIME_SHORT = {
  economy: "ECO",
  standard: "STAN",
  expedited: "EXP",
};

export function formatCurrencyFixed(
  amount: number,
  currency = "USD",
  locale = "en-US",
) {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * Validates whether the provided string is a syntactically reasonable email address.
 * Designed for form validation and typical application use cases.
 * Not fully RFC 5322 compliant (intentionally), but catches most invalid patterns
 * while accepting common real-world addresses (including +tag, international domains).
 *
 * @param email - The email address to validate
 * @returns `true` if it appears to be a valid email, `false` otherwise
 */
export function isValidEmail(email: string): boolean {
  if (typeof email !== "string" || email.trim() === "") {
    return false;
  }

  const normalized = email.toLowerCase().trim();

  // Modern, practical regex for form validation (2025 standard)
  // - No leading/trailing/consecutive dots in local part
  // - Allows + - _ . % in local part
  // - Domain: letters, digits, hyphens; TLD ≥ 2 chars
  const emailRegex: RegExp =
    /^(?!\.)(?!.*\.\.)[a-z0-9_'+\-%]+(?:\.[a-z0-9_'+\-%]+)*@[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)*\.[a-z]{2,}$/;

  return emailRegex.test(normalized);
}

export function safeValue<T>(value: T | null | undefined, defaultValue: T): T {
  if (value === null || value === undefined) {
    return defaultValue;
  }
  return value;
}

export function processParts(parts: any[]) {
  console.log(parts, "<<<<");
  const processedParts = parts.map((part) => {
    return {
      id: part.id,
      rfqId: part.rfq_id,
      status: part.status || "active",
      fileName: part.file_name,
      filePath: part.cad_file_url,
      final_price: part.final_price,
      cadFileType: part.cad_file_type,
      material: part.material,
      quantity: part.quantity || 1,
      tolerance: part.tolerance,
      finish: part.finish,
      threads: part.threads,
      inspection: part.inspection,
      notes: part.notes,
      leadTimeType: part.lead_time_type,
      leadTime: part.lead_time,
      geometry: part.geometry,
      files2d: part.files2d || [],
      process: part.process || "cnc-milling",
      certificates: part.certificates || [],
      is_archived: part.is_archived || false,
    };
  });

  return processedParts as PartConfig[];
}

export function generateRandomSlug(prefix = "", length = 8): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let slug = "";

  for (let i = 0; i < length; i++) {
    slug += chars.charAt(Math.floor(Math.random() * chars.length));
  }

  return prefix ? `${prefix}-${slug}` : slug;
}

/**
 * Converts a data URL (base64) to a File object
 */
export function dataURLtoFile(dataurl: string, filename: string): File {
  const arr = dataurl.split(",");
  const mimeMatch = arr[0].match(/:(.*?);/);
  const mime = mimeMatch ? mimeMatch[1] : "image/png";
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new File([u8arr], filename, { type: mime });
}

export const processTranslator = {
  "cnc-milling": "CNC Machining",
  "cnc-turning": "CNC Machining",
  "cnc-machining": "CNC Machining",
  "sheet-metal": "Sheet Metal",
  "injection-molding": "Injection Molding",
  "manual-quote": "Manual Quote",
};
