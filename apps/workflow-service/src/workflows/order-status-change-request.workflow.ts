import {
  proxyActivities,
  log,
  defineSignal,
  setHandler,
  condition,
  sleep,
} from "@temporalio/workflow";
import type * as activities from "../activities/order-status-change-request.activities.js";

export type OrderStatusChangeRequest = {
  id: string;
  order_id: string;
  supplier_id: string;
  part_id: string;
  status_to: string;
  status_from: string;
  comments: string | null;
  approved_by: string | null;
  reviwed_at: string | null; // timestamptz → ISO string
  rejection_reason: string | null;
  status: string;
  workflow_id: string | null;
  attachments: string[] | null;
  created_at: string;
  updated_at: string;
  order_parts: {
    id: string;
    rfq_parts: {
      snapshot_2d_url: string;
    };
  };
};

export type OrderStatusChangeRequestWorkflowType = {
  supplierEmail: string;
  requestId: string;
};

export type statusType = "pending" | "approved" | "rejected";

const {
  fetchRequestData,
  sendVerifiersOSCR,
  sendApprove,
  sendReject,
  sendAdminReminder,
} = proxyActivities<typeof activities>({
  startToCloseTimeout: "5 minute",
  retry: {
    initialInterval: "5s",
    maximumAttempts: 3,
  },
});

export const approvalSignal = defineSignal("approve");
export const rejectSignal = defineSignal("reject");

export async function orderStatusChangeRequestWorkflow(
  input: OrderStatusChangeRequestWorkflowType,
) {
  log.info("Starting OrderStatusChangeRequestWorkflow", {
    requestId: input.requestId,
  });

  try {
    const orscData: OrderStatusChangeRequest = await fetchRequestData(
      input.requestId,
    );

    await sendVerifiersOSCR(orscData);

    let status: statusType = "pending";

    setHandler(approvalSignal, () => {
      status = "approved";
    });

    setHandler(rejectSignal, () => {
      status = "rejected";
    });

    // Wait up to 24 hours for a decision
    await Promise.race([condition(() => status !== "pending"), sleep("24h")]);

    if (status === ("pending" as statusType)) {
      log.info("Sending reminder to admins for pending status change request", {
        requestId: input.requestId,
      });
      await sendAdminReminder(orscData);

      // Wait indefinitely after reminder
      await condition(() => status !== "pending");
    }

    if ((status as statusType) === "approved") {
      log.info("Order status change request approved", {
        requestId: input.requestId,
      });
      await sendApprove(orscData, input.supplierEmail);
    } else {
      log.info("Order status change request rejected", {
        requestId: input.requestId,
      });
      await sendReject(orscData, input.supplierEmail);
    }
  } catch (error: any) {
    log.error("OrderStatusChangeRequestWorkflow failed", {
      error: error.message,
    });
    throw error;
  }
}
