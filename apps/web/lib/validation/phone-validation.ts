import { CountryCode } from "./postcode-types";

// Phone validation regexes for common countries
export const PHONE_REGEXES: Map<string, RegExp> = new Map([
  [CountryCode.US, /^\+?1?[2-9]\d{9}$/],
  [CountryCode.GB, /^\+?44\d{10}$/],
  [CountryCode.UK, /^\+?44\d{10}$/],
  [CountryCode.IN, /^\+?91[6789]\d{9}$/],
  [CountryCode.CA, /^\+?1?[2-9]\d{9}$/],
  [CountryCode.DE, /^\+?49\d{10,11}$/],
  [CountryCode.FR, /^\+?33\d{9}$/],
  [CountryCode.JP, /^\+?81\d{10}$/],
  [CountryCode.AU, /^\+?61\d{9}$/],
  [CountryCode.IT, /^\+?39\d{10}$/],
  [CountryCode.ES, /^\+?34\d{9}$/],
  [CountryCode.NL, /^\+?31\d{9}$/],
  [CountryCode.BE, /^\+?32\d{9}$/],
  [CountryCode.DK, /^\+?45\d{8}$/],
  [CountryCode.SE, /^\+?46\d{7,10}$/],
  [CountryCode.NO, /^\+?47\d{8}$/],
  [CountryCode.SG, /^\+?65\d{8}$/],
  [CountryCode.INTL, /^\+?[1-9]\d{1,14}$/],
]);

/**
 * Validates a phone number based on the provided country code.
 * Falls back to true if the country code is not recognized to remain permissive.
 */
export function isValidPhone(phone: string, countryCode?: string): boolean {
  if (!countryCode) return true;
  const regex = PHONE_REGEXES.get(countryCode);
  if (!regex) return true;

  // Basic cleaning: remove spaces, dashes, and parentheses for validation
  const cleanPhone = phone.replace(/[\s\-\(\)]/g, "");
  return regex.test(cleanPhone);
}
