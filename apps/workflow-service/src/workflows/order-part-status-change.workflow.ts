import { proxyActivities, log } from "@temporalio/workflow";
import type * as activities from "../activities/index.js";

const {
  checkOrderCompletion,
  fetchEssentials,
  sendOrderStatusChangeEmail,
  sendOrderCompletionEmail,
  pushNotificationActivity,
} = proxyActivities<typeof activities>({
  startToCloseTimeout: "1 minute",
  retry: {
    initialInterval: "5s",
    maximumAttempts: 3,
  },
});

export interface OrderPartStatusChangeInput {
  orderId: string;
  orderPartId: string;
  prevStatus: string;
  currentStatus: string;
  notes?: string;
  documents?: string[];
}

/**
 * Workflow to handle part status changes and order completion notifications.
 */
export async function orderPartStatusChangeWorkflow(
  input: OrderPartStatusChangeInput,
) {
  const {
    orderId,
    orderPartId,
    prevStatus,
    currentStatus,
    notes = "",
    documents = [],
  } = input;

  log.info("Starting orderPartStatusChangeWorkflow", {
    orderId,
    orderPartId,
    currentStatus,
  });

  // 1. Check if the entire order is completed
  const { allPartsCompleted, parts, currentPart } = await checkOrderCompletion(
    orderId,
    orderPartId,
  );

  if (!currentPart) {
    const errorMsg = `Part ${orderPartId} not found in order ${orderId}`;
    log.error(errorMsg);
    throw new Error(errorMsg);
  }

  // 2. Fetch shipping and contact details
  const essentials = await fetchEssentials(orderId);
  const shippingDetails = essentials.shippingData as any;

  if (!shippingDetails || !shippingDetails.address_snapshot) {
    const errorMsg = `Shipping essentials or address snapshot not found for order ${orderId}`;
    log.error(errorMsg);
    throw new Error(errorMsg);
  }

  const userId = (essentials as any).userId;

  // 3. Send appropriate notifications
  if (allPartsCompleted) {
    log.info("Order fully completed. Sending overall completion email.", {
      orderId,
    });
    await sendOrderCompletionEmail(
      essentials.order_code,
      parts,
      shippingDetails,
      documents,
    );

    // Push socket notification for order completion
    if (userId) {
      await pushNotificationActivity({
        userId,
        title: "Order Completed",
        message: `Your order #${essentials.order_code} has been fully shipped!`,
        type: "success",
        metadata: { orderId },
      });
    }
  } else {
    log.info("Sending part status change notification.", {
      orderPartId,
      partName: currentPart.part_name,
      status: currentStatus,
    });

    // Handle potential array or object from Supabase join
    const rfqParts = currentPart.rfq_parts as any;
    const partImageUrl = Array.isArray(rfqParts)
      ? rfqParts[0]?.snapshot_2d_url
      : rfqParts?.snapshot_2d_url || null;

    await sendOrderStatusChangeEmail(
      essentials.order_code,
      currentPart.part_name,
      partImageUrl,
      prevStatus,
      currentStatus,
      shippingDetails,
      notes,
      documents,
    );

    // Push socket notification for status change
    if (userId) {
      await pushNotificationActivity({
        userId,
        title: "Production Update",
        message: `${currentPart.part_name} has moved to ${currentStatus}.`,
        type: "info",
        metadata: { orderId, orderPartId },
      });
    }
  }

  log.info("orderPartStatusChangeWorkflow completed successfully", {
    orderId,
    allPartsCompleted,
  });
}
