import { config } from "./config.js";
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { pinoLogger } from "hono-pino";
import { cors } from "hono/cors";
import { Worker, NativeConnection } from "@temporalio/worker";

import { logger } from "./lib/logger.js";
import { supabase } from "./lib/supabase.js";
import { getTemporalClient } from "./temporal.js";
import * as activities from "./activities/email.activities.js";

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
  return c.text("FFP Workflow Service (Worker + API) is running!");
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
      role: "worker-api",
    });
  } catch (error: any) {
    logger.error({ error: error.message }, "Health check failed");
    return c.json({ status: "error", message: "Service unhealthy" }, 500);
  }
});

/**
 * ======================
 * 4️⃣ TEMPORAL WORKER
 * ======================
 */
async function startWorker() {
  try {
    // Establish connection to Temporal server
    const connection = await NativeConnection.connect({
      address: config.temporal.address,
    });

    // Determine the absolute path to the workflow file
    // Note: In development with tsx, we can point to the .ts file
    const worker = await Worker.create({
      connection,
      workflowsPath: new URL("./workflows/index.ts", import.meta.url).pathname,
      activities,
      taskQueue: "quote-tasks", // This matches what NestJS will use to "place" work
    });

    logger.info("Temporal Worker is online and listening for tasks...");
    await worker.run();
  } catch (err: any) {
    logger.error({ err: err.message }, "Temporal Worker failed to start");
  }
}

async function startServer() {
  logger.info("Starting workflow service (Worker mode)...");

  // Start Temporal Worker in background
  startWorker();

  // Start Hono Server (for health checks and potentially direct triggers)
  serve({
    fetch: app.fetch,
    port,
  });

  logger.info(`Server listening on ${port}`);
}

startServer();
