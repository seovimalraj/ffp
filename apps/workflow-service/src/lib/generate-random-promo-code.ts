type PromoOptions = {
  prefix?: string;
  segments?: number;
  segmentLength?: number;
};

const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

/**
 * Functional Promo Code Generator
 * Algorithm: Weighted Sum Modulo
 */
export const generateRandomPromoCode = ({
  prefix = "",
  segments = 3,
  segmentLength = 4,
}: PromoOptions = {}): string => {
  // 1. Generate random characters for the body
  const generateSegment = () =>
    Array.from(
      { length: segmentLength },
      () => ALPHABET[Math.floor(Math.random() * ALPHABET.length)],
    ).join("");

  const bodySegments = Array.from({ length: segments }, generateSegment);
  const bodyText = bodySegments.join("-");

  // 2. Algorithm: Calculate Checksum
  // We sum (char_index * position) to ensure character swaps invalidate the code
  const cleanBody = bodyText.replace(/-/g, "");
  const checksumValue = cleanBody
    .split("")
    .reduce((acc, char, idx) => acc + ALPHABET.indexOf(char) * (idx + 1), 0);

  const checkChar = ALPHABET[checksumValue % ALPHABET.length];

  // 3. Assemble final string
  return prefix
    ? `${prefix.toUpperCase()}-${bodyText}-${checkChar}`
    : `${bodyText}-${checkChar}`;
};
