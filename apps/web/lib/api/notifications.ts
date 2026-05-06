import { apiClient } from "./index";

export interface Notification {
  id: string;
  user_id: string;
  organization_id: string;
  title: string;
  message: string;
  type: "info" | "success" | "warning" | "error";
  is_read: boolean;
  metadata: any;
  created_at: string;
}

export const NotificationsAPI = {
  getNotifications: async (limit = 20, offset = 0): Promise<Notification[]> => {
    const response = await apiClient.get("/notifications", {
      params: { limit, offset },
    });
    return response.data;
  },

  getUnreadCount: async (): Promise<{ count: number }> => {
    const response = await apiClient.get("/notifications/unread-count");
    return response.data;
  },

  markAsRead: async (id: string): Promise<{ success: boolean }> => {
    const response = await apiClient.patch(`/notifications/${id}/read`);
    return response.data;
  },

  markAllAsRead: async (): Promise<{ success: boolean }> => {
    const response = await apiClient.patch("/notifications/mark-all-read");
    return response.data;
  },
};
