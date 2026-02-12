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
