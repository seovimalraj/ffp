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
