/**
 * Generates an ISO string for X minutes in the future
 * @param {number} minutesToAdd
 * @returns {string} ISO Timestamp
 */
export function getExpiryTimestamp(minutesToAdd = 5) {
  const now = new Date();
  now.setMinutes(now.getMinutes() + minutesToAdd);
  return now.toISOString();
}

/**
 * @param {Date|string} expiresAt - The timestamp from the DB
 * @returns {boolean} - True if the code is still valid
 */
export function isOtpValid(expiresAt: Date | string): boolean {
  const expiryDate = new Date(expiresAt);
  const now = new Date();

  return expiryDate > now;
}
