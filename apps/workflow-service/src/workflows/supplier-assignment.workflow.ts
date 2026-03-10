import { proxyActivities, log } from "@temporalio/workflow";
import type * as activities from "../activities/supplier-assignment.activities.js";

const { getOrderCode, sendSupplierAssignmentEmail } = proxyActivities<
  typeof activities
>({
  startToCloseTimeout: "1 minute",
  retry: {
    initialInterval: "5s",
    maximumAttempts: 3,
  },
});

export type SupplierAssignmentWorkflowInput = {
  orderId: string;
  supplierEmail: string;
};

export async function supplierAssignmentWorkflow(
  input: SupplierAssignmentWorkflowInput,
) {
  log.info("Starting SupplierAssignmentWorkflow", {
    orderId: input.orderId,
    supplierEmail: input.supplierEmail,
  });

  try {
    // 1. Get order code
    const orderCode = await getOrderCode(input.orderId);

    // 2. Send email to supplier
    await sendSupplierAssignmentEmail({
      supplierEmail: input.supplierEmail,
      orderCode: orderCode,
      orderId: input.orderId,
    });

    log.info("SupplierAssignmentWorkflow completed successfully", {
      orderId: input.orderId,
      orderCode: orderCode,
    });

    return {
      success: true,
      orderCode: orderCode,
    };
  } catch (err: any) {
    log.error("SupplierAssignmentWorkflow failed", { error: err.message });
    throw err;
  }
}
