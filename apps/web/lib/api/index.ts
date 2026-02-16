import axios, { AxiosInstance, AxiosResponse } from "axios";
import { getSession, signOut } from "next-auth/react";
import { useMetaStore } from "@/components/store/title-store";

console.log(
  process.env.NEXT_PUBLIC_NEST_API,
  process.env.NEXT_PUBLIC_API_URL || "/api",
);

// Create axios instance
const apiClient: AxiosInstance = axios.create({
  baseURL:
    process.env.NEXT_PUBLIC_NEST_API ||
    process.env.NEXT_PUBLIC_API_URL ||
    "/api",
  timeout: 10000,
  headers: {
    "Content-Type": "application/json",
  },
});

// Request interceptor to add bearer token
apiClient.interceptors.request.use(
  async (config) => {
    try {
      const session = await getSession();

      if (session?.user?.id) {
        config.headers.Authorization = `Bearer ${session.user.id}`;
        // Also send session data as backup
        config.headers["X-Session-Data"] = JSON.stringify(session.user);
      }

      return config;
    } catch (error) {
      console.error("Error getting session for API request:", error);
      return config;
    }
  },
  (error) => {
    return Promise.reject(error);
  },
);

// Module-level sign-out guard to prevent multiple concurrent sign-out redirects
let isSigningOut = false;

// Response interceptor for error handling
apiClient.interceptors.response.use(
  (response: AxiosResponse) => {
    return response;
  },
  (error) => {
    if (
      error.response?.status === 401 &&
      !isSigningOut &&
      globalThis.window !== undefined
    ) {
      console.error("Unauthorized request - redirecting to login");
      isSigningOut = true;
      const returnUrl = globalThis.location.pathname + globalThis.location.search;
      useMetaStore.getState().setRedirectUrl(returnUrl);
      signOut({
        callbackUrl: `/signin?returnUrl=${encodeURIComponent(returnUrl)}`,
      });
    }

    console.error("API Error:", {
      status: error.response?.status,
      message: error.response?.data?.message || error.message,
      url: error.config?.url,
    });

    return Promise.reject(error);
  },
);

export { apiClient, apiClient as api };
