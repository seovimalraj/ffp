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
