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
      finalPrice: part.final_price,
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
