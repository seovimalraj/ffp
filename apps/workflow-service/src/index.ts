import { fileURLToPath } from "node:url";
import { config } from "./config.js";
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { pinoLogger } from "hono-pino";
import { cors } from "hono/cors";
import { Worker, NativeConnection } from "@temporalio/worker";

import { logger } from "./lib/logger.js";
import * as activities from "./activities/index.js";

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

/**
 * ======================
 * 4️⃣ TEMPORAL WORKER
 * ======================
 */
async function startWorker(
  taskQueue: string,
  options: { maxActivities?: number; maxWorkflows?: number } = {},
) {
  try {
    // Establish connection to Temporal server
    const connection = await NativeConnection.connect({
      address: config.temporal.address,
    });

    // Determine the absolute path to the workflow file
    // Note: In development with tsx, we use .ts; in production (dist), we use .js
    const workflowsPath = fileURLToPath(
      new URL(
        import.meta.url.endsWith(".ts")
          ? "./workflows/index.ts"
          : "./workflows/index.js",
        import.meta.url,
      ),
    );

    const worker = await Worker.create({
      connection,
      workflowsPath,
      activities,
      taskQueue,

      maxConcurrentActivityTaskExecutions: options.maxActivities || 3,
      maxConcurrentWorkflowTaskExecutions: options.maxWorkflows || 3,
    });

    logger.info(
      `Temporal Worker [${taskQueue}] is online and listening for tasks...`,
    );
    await worker.run();
  } catch (err: any) {
    logger.error(
      { err: err.message, taskQueue },
      `Temporal Worker [${taskQueue}] failed to start`,
    );
  }
}
async function startServer() {
  logger.info("Starting workflow service (Worker mode)...");

  // Start Temporal Workers in background (one per task queue)
  startWorker("quote-tasks");
  startWorker("cad-tasks", { maxActivities: 2, maxWorkflows: 2 });
  // Start Hono Server (for health checks and potentially direct triggers)
  serve({
    fetch: app.fetch,
    port,
  });

  logger.info(`Server listening on ${port}`);
}

startServer();
