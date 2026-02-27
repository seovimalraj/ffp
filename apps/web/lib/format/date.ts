/**
 * Date formatting utilities
 * @ownership web-platform
 */

/**
 * Format a date string or Date object to a localized date string
 * @param date - Date string (ISO) or Date object
 * @param options - Intl.DateTimeFormatOptions for customization
 * @returns Formatted date string (e.g., "Nov 7, 2025")
 */
export function formatDate(
  date: string | Date | null | undefined,
  options?: Intl.DateTimeFormatOptions,
): string {
  if (!date) {
    return "N/A";
  }
  const dateObj = typeof date === "string" ? new Date(date) : date;

  // Check for invalid date
  if (isNaN(dateObj.getTime())) {
    return "Invalid Date";
  }

  const defaultOptions: Intl.DateTimeFormatOptions = {
    year: "numeric",
    month: "short",
    day: "numeric",
  };

  return dateObj.toLocaleDateString("en-US", options || defaultOptions);
}

/**
 * Format a date with time
 * @param date - Date string (ISO) or Date object
 * @returns Formatted date-time string (e.g., "Nov 7, 2025, 2:30 PM")
 */
export function formatDateTime(date: string | Date | null | undefined): string {
  if (!date) return "N/A";
  return formatDate(date, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Format a date with full month name
 * @param date - Date string (ISO) or Date object
 * @returns Formatted date string (e.g., "November 7, 2025")
 */
export function formatDateLong(date: string | Date | null | undefined): string {
  if (!date) return "N/A";
  return formatDate(date, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

/**
 * Format a date with short format
 * @param date - Date string (ISO) or Date object
 * @returns Formatted date string (e.g., "11/7/2025")
 */
export function formatDateShort(
  date: string | Date | null | undefined,
): string {
  if (!date) return "N/A";
  return formatDate(date, {
    year: "numeric",
    month: "numeric",
    day: "numeric",
  });
}

/**
 * Format relative time (e.g., "2 hours ago", "in 3 days")
 * @param date - Date string (ISO) or Date object
 * @returns Relative time string
 */
export function formatRelativeTime(
  date: string | Date | null | undefined,
): string {
  if (!date) return "N/A";
  const dateObj = typeof date === "string" ? new Date(date) : date;

  if (isNaN(dateObj.getTime())) {
    return "Invalid Date";
  }

  const now = new Date();
  const diffMs = dateObj.getTime() - now.getTime();
  const diffSec = Math.round(diffMs / 1000);
  const diffMin = Math.round(diffSec / 60);
  const diffHour = Math.round(diffMin / 60);
  const diffDay = Math.round(diffHour / 24);

  if (Math.abs(diffSec) < 60) {
    return "just now";
  } else if (Math.abs(diffMin) < 60) {
    return diffMin > 0
      ? `in ${diffMin} minute${diffMin === 1 ? "" : "s"}`
      : `${Math.abs(diffMin)} minute${Math.abs(diffMin) === 1 ? "" : "s"} ago`;
  } else if (Math.abs(diffHour) < 24) {
    return diffHour > 0
      ? `in ${diffHour} hour${diffHour === 1 ? "" : "s"}`
      : `${Math.abs(diffHour)} hour${Math.abs(diffHour) === 1 ? "" : "s"} ago`;
  } else if (Math.abs(diffDay) < 7) {
    return diffDay > 0
      ? `in ${diffDay} day${diffDay === 1 ? "" : "s"}`
      : `${Math.abs(diffDay)} day${Math.abs(diffDay) === 1 ? "" : "s"} ago`;
  } else {
    return formatDate(dateObj);
  }
}
