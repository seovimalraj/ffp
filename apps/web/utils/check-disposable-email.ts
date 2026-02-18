import { disposableEmails } from "@cnc-quote/shared";

export function isBannedEmail(email: string) {
  if (!email || !email.includes("@")) return false;
  const domain = email.split("@")[1].toLowerCase().trim();
  return disposableEmails.has(domain);
}
