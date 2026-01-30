import dotenv from "dotenv";

dotenv.config({
  path: process.env.NODE_ENV === "production" ? ".env" : ".env.development",
});

export const config = {
  port: Number(process.env.PORT) || 6001,
  logLevel: process.env.LOG_LEVEL || "info",
  email: {
    smtpHost: process.env.SMTP_HOST,
    smtpPort: Number(process.env.SMTP_PORT) || 465,
    smtpUser: process.env.SMTP_USER,
    smtpPassword: process.env.SMTP_PASSWORD,
    smtpFrom: process.env.SMTP_FROM,
  },
  supabase: {
    url: process.env.SUPABASE_URL,
    anonKey: process.env.SUPABASE_ANON_KEY,
  },
  allowedOrigins: process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(",")
    : ["*"],
};
