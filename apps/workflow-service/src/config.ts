import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envFile =
  process.env.NODE_ENV === "production" ? ".env" : ".env.development";

dotenv.config({
  path: path.join(__dirname, "..", envFile),
});

console.warn(`[Config] Loaded environment from ${envFile}`);
console.warn(
  `[Config] Temporal Address: ${process.env.TEMPORAL_ADDRESS || "localhost:7233"}`,
);

export const config = {
  port: Number(process.env.PORT) || 6001,
  logLevel: process.env.LOG_LEVEL || "info",
  frontendUrl: process.env.FRONTEND_URL || "http://localhost:3000",
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
    ? process.env.ALLOWED_ORIGINS.split(",").map((o) => o.trim())
    : ["*"],
  temporal: {
    address: process.env.TEMPORAL_ADDRESS || "localhost:7233",
    namespace: process.env.TEMPORAL_NAMESPACE || "default",
  },
};
