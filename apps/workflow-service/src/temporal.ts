import { Connection, Client } from "@temporalio/client";
import { config } from "./config.js";
import { logger } from "./lib/logger.js";

let client: Client | null = null;
export async function getTemporalClient(): Promise<Client> {
  if (client) return client;

  while (true) {
    try {
      const connection = await Connection.connect({
        address: config.temporal.address,
      });

      client = new Client({
        connection,
        namespace: config.temporal.namespace,
      });

      await client.workflowService.getSystemInfo({});
      logger.info("Connected to Temporal");
      return client;
    } catch (err: any) {
      logger.error({ err: err.message }, "Temporal connect failed, retrying");
      await new Promise((r) => setTimeout(r, 3000));
    }
  }
}
