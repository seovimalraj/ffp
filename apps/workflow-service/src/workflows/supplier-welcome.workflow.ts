import { proxyActivities, log } from "@temporalio/workflow";

import type * as activities from "../activities/supplier-welcome.activities.js";

const { sendSupplierWelcomeEmail } = proxyActivities<typeof activities>({
  startToCloseTimeout: "1 minute",
  retry: {
    initialInterval: "5s",
    maximumAttempts: 3,
  },
});

export async function supplierWelcomeWorkflow(data: {
  email: string;
  username: string;
  organizationName: string;
  password?: string;
}) {
  log.info("Starting supplierWelcomeWorkflow", {
    email: data.email,
    username: data.username,
    organizationName: data.organizationName,
  });

  await sendSupplierWelcomeEmail(
    data.email,
    data.username,
    data.organizationName,
    data.password,
  );

  log.info(`supplierWelcomeWorkflow completed successfully`, {
    email: data.email,
  });
}
