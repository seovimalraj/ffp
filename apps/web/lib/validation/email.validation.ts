import { isBannedEmail } from "@/utils/check-disposable-email";

export const validateEmail = (email: string) => {
  if (!email) return "Email is required";
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) return "Please enter a valid email address";
  if (isBannedEmail(email))
    return "Registration requires a verified organizational email. Disposable and public email domains are blocked.";
  return "";
};

export const validatePassword = (password: string) => {
  if (!password) return "Password is required";
  if (password.length < 6) return "Password must be at least 6 characters";
  return "";
};
