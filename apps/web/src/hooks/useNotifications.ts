import { useState, useEffect, useCallback, useRef } from "react";
import { useSession } from "next-auth/react";
import { NotificationsAPI, Notification } from "@/lib/api/notifications";
import { useSocket } from "@/components/store/socket-store";
import { notify } from "@/lib/toast";

export function useNotifications() {
  const { data: session } = useSession();
  const socket = useSocket();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const listenerAttached = useRef(false);

  const fetchNotifications = useCallback(async () => {
    if (!session?.user?.id) return;
    try {
      setLoading(true);
      const [list, countData] = await Promise.all([
        NotificationsAPI.getNotifications(20, 0),
        NotificationsAPI.getUnreadCount(),
      ]);
      setNotifications(list);
      setUnreadCount(countData.count);
    } catch (error) {
      console.error("Failed to fetch notifications:", error);
    } finally {
      setLoading(false);
    }
  }, [session?.user?.id]);

  const markAsRead = async (id: string) => {
    try {
      await NotificationsAPI.markAsRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)),
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (error) {
      console.error("Failed to mark notification as read:", error);
    }
  };

  const markAllAsRead = async () => {
    try {
      await NotificationsAPI.markAllAsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch (error) {
      console.error("Failed to mark all as read:", error);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  useEffect(() => {
    if (!socket || !session?.user?.id) return;

    const handleNewNotification = (data: any) => {
      const notificationId = data.id || Math.random().toString();

      setNotifications((prev) => {
        if (prev.some((n) => n.id === notificationId)) return prev;

        const newNotification: Notification = {
          id: notificationId,
          user_id: session.user.id,
          organization_id: "",
          title: data.title || "New Notification",
          message: data.message || "",
          type: data.type || "info",
          is_read: false,
          metadata: data.metadata || data.meta_data || {},
          created_at: data.created_at || new Date().toISOString(),
        };

        notify.info(newNotification.title, newNotification.message);
        setUnreadCount((count) => count + 1);

        return [newNotification, ...prev].slice(0, 50);
      });
    };

    socket.on("receiveMessage", handleNewNotification);

    return () => {
      socket.off("receiveMessage", handleNewNotification);
    };
  }, [socket, session?.user?.id]);
  return {
    notifications,
    unreadCount,
    loading,
    markAsRead,
    markAllAsRead,
    refresh: fetchNotifications,
  };
}
