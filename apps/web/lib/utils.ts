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

export const handleDownload = async (url: string, filename: string) => {
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    const downloadUrl = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = downloadUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(downloadUrl);
  } catch (error) {
    console.error("Download failed:", error);
    window.open(url, "_blank");
  }
};

export function toTitleCase(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
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
  console.log(
    "📦 Processing parts from backend:",
    parts.map((p) => ({ id: p.id, process: p.process })),
  );
  const processedParts = parts.map((part) => {
    // CRITICAL: Normalize process field
    // 1. Use geometry recommendation if process is missing
    // 2. Convert underscore format to hyphen format (sheet_metal → sheet-metal)
    let process = part.process;

    if (!process || process === "") {
      // Fall back to geometry recommendation if available
      process = part.geometry?.recommendedProcess || "cnc-milling";
      console.log(
        `  Part ${part.id}: process was empty, using ${process} from geometry`,
      );
    }

    // Normalize underscore to hyphen format
    const processMap: Record<string, string> = {
      sheet_metal: "sheet-metal",
      cnc_milling: "cnc-milling",
      cnc_turning: "cnc-turning",
    };
    process = processMap[process] || process;

    console.log(
      `  Part ${part.id}: backend process='${part.process}' → final='${process}'`,
    );

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
      process, // Use the normalized process value
      changeMeta: part.changeMeta || {},
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

export enum UtmMedium {
  FFP = "ffp",
  Email = "email",
  Ads = "ads",
  Social = "social",
}

export function buildUtmLink(
  baseUrl: string,
  medium: UtmMedium,
  campaign = "ffp",
  source = "ffp",
): string {
  const url = new URL(baseUrl);

  url.searchParams.set("utm_source", source);
  url.searchParams.set("utm_medium", medium);
  url.searchParams.set("utm_campaign", campaign);

  return url.toString();
}

export function getQuantityRange(val: number = 1): number[] {
  const base = [1, 5, 10, 25, 50];

  if (val <= 50) return base;

  let start = 50;

  while (true) {
    const range: number[] = [
      start,
      Math.round(start * 1.5),
      start * 2,
      start * 3,
      start * 4,
    ];

    if (val <= range[range.length - 1]) {
      return range;
    }

    start = range[range.length - 1];
  }
}

export const processTranslator = {
  "cnc-milling": "CNC Machining",
  "cnc-turning": "CNC Machining",
  "cnc-machining": "CNC Machining",
  "sheet-metal": "Sheet Metal",
  "injection-molding": "Injection Molding",
  "manual-quote": "Manual Quote",
};
