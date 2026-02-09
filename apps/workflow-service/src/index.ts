import { config } from "./config.js";
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { pinoLogger } from "hono-pino";
import { cors } from "hono/cors";

import { logger } from "./lib/logger.js";
import { supabase } from "./lib/supabase.js";
import { getTemporalClient } from "./temporal.js";

const app = new Hono();
const port = config.port;

/**
 * ==========================
 * 1️⃣ LOGGER
 * ==========================
 */
app.use(
  pinoLogger({
    pino: logger,
  }),
);

/**
 * ======================
 * 2️⃣ CORS
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
    allowHeaders: ["Content-Type", "Authorization"],
  }),
);

/**
 * =========
 * 3️⃣ ROUTES
 * =========
 */
app.get("/", (c) => {
  return c.text("FFP Workflow Service is running!");
});

app.get("/health", async (c) => {
  try {
    const { error } = await supabase.from("rfq").select("id").limit(1);

    if (error) throw error;

    // Check Temporal connection health
    const client = await getTemporalClient();
    await client.workflowService.getSystemInfo({});

    return c.json({
      status: "ok",
      supabase: "connected",
      temporal: "connected",
    });
  } catch (error: any) {
    logger.error({ error: error.message }, "Health check failed");
    return c.json({ status: "error", message: "Service unhealthy" }, 500);
  }
});

async function startServer() {
  logger.info("Starting workflow service...");

  // do not block server startup forever
  connectTemporalInBackground();

  serve({
    fetch: app.fetch,
    port,
  });

  logger.info(`Server listening on ${port}`);
}

async function connectTemporalInBackground() {
  while (true) {
    try {
      await getTemporalClient();
      logger.info("Temporal connected");
      break;
    } catch (err: any) {
      logger.error({ err: err.message }, "Temporal not ready, retrying in 3s");
      await new Promise((r) => setTimeout(r, 3000));
    }
  }
}

startServer();
