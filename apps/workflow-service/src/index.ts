import { config } from "./config.js";
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { pinoLogger } from "hono-pino";
import { inngest } from "./client.js";
import { functions } from "./functions/index.js";
import { serve as serveInngest } from "inngest/hono";
import { logger } from "./lib/logger.js";

import { supabase } from "./lib/supabase.js";

const app = new Hono();
const port = config.port;

import { cors } from "hono/cors";

// ...

app.use(
  pinoLogger({
    pino: logger,
  }),
);

app.use(
  "/*",
  cors({
    origin: (origin) => {
      if (config.allowedOrigins.includes("*")) return origin;
      if (config.allowedOrigins.includes(origin)) return origin;
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

app.get("/", (c) => {
  return c.text("FFP Workflow Service is running!");
});

app.get("/health", async (c) => {
  try {
    const { data: _data, error } = await supabase
      .from("rfq")
      .select("count")
      .limit(1);
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

app.on(
  ["GET", "PUT", "POST"],
  "/api/inngest",
  serveInngest({
    client: inngest,
    functions,
    servePath: "/api/inngest",
  }),
);

logger.info(`FFP Workflow Service is running at http://localhost:${port}`);

serve({
  fetch: app.fetch,
  port,
});
