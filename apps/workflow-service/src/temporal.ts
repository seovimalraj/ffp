import { Connection, Client } from "@temporalio/client";
import { config } from "./config.js";
import { logger } from "./lib/logger.js";

let client: Client | null = null;

export async function getTemporalClient(): Promise<Client> {
  if (client) return client;

  try {
    const connection = await Connection.connect({
      address: config.temporal.address,
    });

    client = new Client({
      connection,
      namespace: config.temporal.namespace,
    });

    // Perform a lightweight check to verify connection is actually alive
    await client.workflowService.getSystemInfo({});

    logger.info(
      {
        address: config.temporal.address,
        namespace: config.temporal.namespace,
      },
      "Successfully connected to Temporal server",
    );
    return client;
  } catch (error: any) {
    logger.error(
      { error: error.message, address: config.temporal.address },
      "Failed to connect to Temporal server",
    );
    throw error;
  }
}
