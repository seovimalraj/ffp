"use client";

import { SidebarProvider } from "@/components/Layouts/sidebar/sidebar-context";
import { ThemeProvider } from "next-themes";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { SessionProvider } from "next-auth/react";
import type { Session } from "next-auth"
import { PermissionsProvider } from "@/providers/permissions-provider";

/**
 * Step 13: React Query Configuration
 * Optimized for pricing caching and optimistic updates
 */
function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Consider data fresh for 1 minute
        staleTime: 60_000,
        // Keep unused data in cache for 10 minutes
        gcTime: 10 * 60_000,
        // Retry failed requests once
        retry: 1,
        // Don't refetch on window focus (pricing is deterministic)
        refetchOnWindowFocus: false,
        // Don't refetch on reconnect (will use stale data)
        refetchOnReconnect: false,
      },
      mutations: {
        // Don't retry mutations
        retry: 0,
      },
    },
  });
}

export default function Providers({ session, children }: { session: Session | null, children: React.ReactNode }) {
  // Create a stable query client instance per component mount
  // This ensures SSR compatibility
  const [queryClient] = useState(() => makeQueryClient());

  return (
    <SessionProvider session={session}>
      <PermissionsProvider>
        <QueryClientProvider client={queryClient}>
          <ThemeProvider defaultTheme="light" attribute="class">
            <SidebarProvider>{children}</SidebarProvider>
          </ThemeProvider>
        </QueryClientProvider>
      </PermissionsProvider>
    </SessionProvider>
  );
}
