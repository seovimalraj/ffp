import { config } from "./config.js";
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { pinoLogger } from "hono-pino";
import { cors } from "hono/cors";

import { serve as serveInngest } from "inngest/hono";
import { inngest } from "./client.js";
import { functions } from "./functions/index.js";

import { logger } from "./lib/logger.js";
import { supabase } from "./lib/supabase.js";
import { cron } from "./cron/index.js";

const app = new Hono();
const port = config.port;

/**
 * =====================================================
 * 1️⃣ INNGEST — MUST BE FIRST (NO MIDDLEWARE BEFORE THIS)
 * =====================================================
 */
app.on(
  ["GET", "PUT", "POST"],
  "/api/inngest",
  serveInngest({
    client: inngest,
    functions: [...functions, ...cron],
  }),
);

/**
 * ==========================
 * 2️⃣ LOGGER (AFTER INNGEST)
 * ==========================
 */
app.use(
  pinoLogger({
    pino: logger,
  }),
);

/**
 * ======================
 * 3️⃣ CORS (AFTER INNGEST)
 * ======================
 */
app.use(
  "/*",
  cors({
    origin: (origin) => {
      if (config.allowedOrigins.includes("*")) return origin;
      if (origin && config.allowedOrigins.includes(origin)) return origin;
      return null;
    },
    credentials: true,
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowHeaders: [
      "Content-Type",
      "Authorization",
      "x-inngest-env",
      "x-inngest-signature",
    ],
  }),
);

/**
 * =========
 * 4️⃣ ROUTES
 * =========
 */
app.get("/", (c) => {
  return c.text("FFP Workflow Service is running!");
});

app.get("/health", async (c) => {
  try {
    const { error } = await supabase.from("rfq").select("id").limit(1);

    if (error) throw error;

    return c.json({ status: "ok", supabase: "connected" });
  } catch (error: any) {
    logger.error({ error: error.message }, "Supabase health check failed");
    return c.json(
      { status: "error", message: "Supabase connection failed" },
      500,
    );
  }
});

console.log({
  eventKey: process.env.INNGEST_EVENT_KEY,

  // @ts-ignore
  // REQUIRED for verifying Inngest → app requests
  signingKey: process.env.INNGEST_SIGNING_KEY,

  // REQUIRED ONLY for self-hosted Inngest
  baseUrl: process.env.INNGEST_BASE_URL || "https://ffp-inngest.frigate.ai", // undefined in Cloud → OK
});

logger.info(`FFP Workflow Service is running at http://localhost:${port}`);

serve({
  fetch: app.fetch,
  port,
});
