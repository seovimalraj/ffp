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

// Module-level flag to prevent multiple signOut calls
let isSigningOut = false;

// Request interceptor to add bearer token
apiClient.interceptors.request.use(
  async (config) => {
    try {
      const session = await getSession();

      if (session) {
        // Send the actual JWT access token (not user.id) as the Bearer token.
        // The backend AuthGuard verifies this with jwtService.verify().
        const accessToken = session.accessToken;
        if (accessToken) {
          config.headers.Authorization = `Bearer ${accessToken}`;
        }
        // Also send session data as fallback for routes that accept it
        if (session.user) {
          config.headers["X-Session-Data"] = JSON.stringify(session.user);
        }
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

// Response interceptor for error handling
apiClient.interceptors.response.use(
  (response: AxiosResponse) => {
    return response;
  },
  (error) => {
    if (
      error.response?.status === 401 &&
      !isSigningOut &&
      typeof window !== "undefined"
    ) {
      console.error("Unauthorized request - redirecting to login");
      isSigningOut = true;
      const returnUrl = window.location.pathname + window.location.search;
      useMetaStore.getState().setRedirectUrl(returnUrl);
      signOut({
        callbackUrl: `/signin?returnUrl=${encodeURIComponent(returnUrl)}`,
      }).finally(() => {
        // Reset flag after signOut completes (or fails) so future sessions work
        isSigningOut = false;
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
