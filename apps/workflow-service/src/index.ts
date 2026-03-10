import { fileURLToPath } from "node:url";
import { config } from "./config.js";
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { pinoLogger } from "hono-pino";
import { cors } from "hono/cors";
import { Worker, NativeConnection } from "@temporalio/worker";

import { logger } from "./lib/logger.js";
import * as activities from "./activities/index.js";

/**
 * =========================
 * 1️⃣ APP SETUP
 * =========================
 */

const app = new Hono();
const port = config.port;

/**
 * =========================
 * 2️⃣ LOGGER
 * =========================
 */

app.use(
  pinoLogger({
    pino: logger,
  }),
);

/**
 * =========================
 * 3️⃣ CORS
 * =========================
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
 * =========================
 * 4️⃣ ROUTES
 * =========================
 */

app.get("/", (c) => {
  return c.text("FFP Workflow Service (Worker + API) is running!");
});

app.get("/health", (c) => {
  return c.json({
    status: "ok",
    service: "workflow-service",
  });
});

/**
 * =========================
 * 5️⃣ TEMPORAL CONNECTION
 * =========================
 */

let temporalConnection: NativeConnection | null = null;

async function getTemporalConnection() {
  if (!temporalConnection) {
    temporalConnection = await NativeConnection.connect({
      address: config.temporal.address,
    });

    logger.info("Connected to Temporal server");
  }

  return temporalConnection;
}

/**
 * =========================
 * 6️⃣ WORKER STARTUP
 * =========================
 */

async function startWorker(
  taskQueue: string,
  options: { maxActivities?: number; maxWorkflows?: number } = {},
) {
  try {
    const connection = await getTemporalConnection();

    const workflowsPath = fileURLToPath(
      new URL(
        process.env.NODE_ENV === "production"
          ? "./workflows/index.js"
          : "./workflows/index.ts",
        import.meta.url,
      ),
    );

    const worker = await Worker.create({
      connection,
      workflowsPath,
      activities,
      taskQueue,

      maxConcurrentActivityTaskExecutions: options.maxActivities ?? 3,
      maxConcurrentWorkflowTaskExecutions: options.maxWorkflows ?? 3,
    });

    logger.info({ taskQueue }, "Temporal worker started and polling for tasks");

    await worker.run();
  } catch (err: any) {
    logger.error({ err, taskQueue }, "Temporal worker failed to start");

    throw err;
  }
}

/**
 * =========================
 * 7️⃣ WORKER CONFIG
 * =========================
 */

const workers = [
  {
    name: "quote-tasks",
    options: {
      maxActivities: 4,
      maxWorkflows: 4,
    },
  },
  {
    name: "cad-tasks",
    options: {
      maxActivities: 2,
      maxWorkflows: 2,
    },
  },
];

/**
 * =========================
 * 8️⃣ SERVER START
 * =========================
 */

async function startServer() {
  logger.info("Starting workflow service (Worker + API mode)...");

  // Start workers
  for (const worker of workers) {
    startWorker(worker.name, worker.options).catch((err) => {
      logger.error({ err, worker: worker.name }, "Worker crashed");
    });
  }

  // Start HTTP server
  serve({
    fetch: app.fetch,
    port,
  });

  logger.info({ port }, "HTTP server started");
}

/**
 * =========================
 * 9️⃣ GRACEFUL SHUTDOWN
 * =========================
 */

process.on("SIGTERM", () => {
  logger.info("SIGTERM received. Shutting down service.");
  process.exit(0);
});

process.on("SIGINT", () => {
  logger.info("SIGINT received. Shutting down service.");
  process.exit(0);
});

/**
 * =========================
 * 🔟 BOOT
 * =========================
 */

startServer();
