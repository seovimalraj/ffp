/**
 * Converts a kebab-case string into Title Case.
 *
 * @param text - Input string (expected kebab-case).
 * @throws {TypeError} If input is not a string.
 * @returns Title-cased string.
 */
export function kebabToTitleSafe(text: unknown): string {
  if (typeof text !== "string") {
    throw new TypeError("Expected a string");
  }

  return text
    .split("-")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}
