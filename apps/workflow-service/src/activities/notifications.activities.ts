import { pushSocketNotification } from "../lib/socket.js";
import { logger } from "../lib/logger.js";

/**
 * Activity to push a real-time notification via Socket.io.
 */
export async function pushNotificationActivity(data: {
  userId: string;
  title: string;
  message: string;
  type?: string;
  metadata?: any;
}): Promise<{ success: boolean }> {
  try {
    logger.info({ userId: data.userId, title: data.title }, "Pushing socket notification");

    await pushSocketNotification({
      userId: data.userId,
      event: "receiveMessage",
      payload: {
        title: data.title,
        message: data.message,
        type: data.type || "info",
        metadata: data.metadata || {},
        created_at: new Date().toISOString(),
      },
    });

    return { success: true };
  } catch (error: any) {
    logger.error({ error: error.message, userId: data.userId }, "Failed to push socket notification");
    // We don't necessarily want to fail the whole workflow if a notification fails
    return { success: false };
  }
}
