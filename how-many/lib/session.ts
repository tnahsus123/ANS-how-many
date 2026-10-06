/**
 * Anonymous session ID: 48 random bits as hex. Nothing identifying.
 * It also seeds trial order, side assignment and dot layouts, so a session
 * can be reproduced exactly from its ID.
 */
export function createSessionId(): string {
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}
