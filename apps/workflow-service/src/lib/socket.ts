import { io, Socket } from "socket.io-client";
import { config } from "../config.js";
import { logger } from "./logger.js";
import { supabase } from "./supabase.js";
import { Tables } from "../constants/index.js";

let socket: Socket | null = null;

/**
 * Initializes and returns a singleton Socket.io client connection to the API.
 */
export function getSocket(): Socket {
  if (socket) return socket;

  const url = config.apiUrl;
  logger.info({ url }, "Initializing Socket.io client to API");

  socket = io(url, {
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
  });

  socket.on("connect", () => {
    logger.info({ id: socket?.id }, "Connected to API Socket Gateway");

    // Join as a system client
    socket?.emit("join", {
      auth: "workflow-service",
      secret: config.internalApiKey,
    });
  });

  socket.on("disconnect", (reason) => {
    logger.warn({ reason }, "Disconnected from API Socket Gateway");
  });

  socket.on("connect_error", (error) => {
    logger.error({ error: error.message }, "Socket connection error");
  });

  return socket;
}

/**
 * Pushes a notification to a specific user via the API's socket gateway.
 */
export async function pushSocketNotification(data: {
  userId: string;
  event?: string;
  payload: any;
}) {
  const s = getSocket();

  if (!s.connected) {
    logger.warn(
      "Socket not connected, attempting to send systemMessage anyway (might be queued)",
    );
  }

  return new Promise<void>((resolve) => {
    const messagePayload = {
      targetUserId: data.userId,
      event: data.event || "receiveMessage",
      payload: data.payload,
      secret: config.internalApiKey,
    };

    // Use a timeout to avoid hanging forever if no ack comes back.
    // The NestJS gateway only sends an ack if handleSystemMessage returns a value.
    const timeout = setTimeout(() => {
      logger.debug("Socket emit completed (no ack expected)");
      resolve();
    }, 2000);

    s.emit("systemMessage", messagePayload, (response: any) => {
      clearTimeout(timeout);
      logger.debug({ response }, "Socket emit acknowledged");
      resolve();
    });
  });
}

/**
 * Creates a persistent notification via the API's internal endpoint.
 * This also triggers a real-time socket notification.
 */
export async function createNotification(data: {
  userId: string;
  organizationId: string;
  title: string;
  message: string;
  type?: string;
  metadata?: any;
}) {
  try {
    const enrichedMetadata = {
      ...(data.metadata || {}),
      title: data.title,
      type: data.type || "info",
    };

    const { data: notification, error } = await supabase
      .from(Tables.Notification)
      .insert([
        {
          user_id: data.userId,
          organization_id: data.organizationId,
          message: data.message,
          meta_data: enrichedMetadata,
          is_read: false,
        },
      ])
      .select()
      .single();

    if (error) {
      logger.error({ error });
      throw error;
    }

    logger.info(
      { notificationId: notification.id },
      "Persistent notification created",
    );

    // Push real-time notification
    await pushSocketNotification({
      userId: data.userId,
      payload: {
        id: notification.id,
        title: data.title,
        message: data.message,
        type: data.type || "info",
        metadata: enrichedMetadata,
        created_at: notification.created_at,
      },
    });

    return notification;
  } catch (error: any) {
    logger.error(
      { error: error.message },
      "Error creating notification via API",
    );
    return null; // Return null instead of throwing to prevent workflow crashes if notification fails
  }
}
