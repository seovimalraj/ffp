import { test as base, Page } from "@playwright/test";
import { SupabaseClient } from "@supabase/supabase-js";

export interface TestUser {
  email: string;
  password: string;
  orgId: string;
  token: string;
}

// Dummy implementation for E2E testing
export const test = base.extend<{
  adminUser: TestUser;
  portalUser: TestUser;
  supabase: SupabaseClient;
}>({
  adminUser: async (_, use) => {
    await use({
      email: "admin@example.com",
      password: "admin123",
      orgId: "mock-org-id",
      token: "mock-admin-token",
    });
  },
  portalUser: async (_, use) => {
    await use({
      email: "user@example.com",
      password: "user123",
      orgId: "mock-org-id",
      token: "mock-user-token",
    });
  },
  supabase: async (_, use) => {
    const mockSupabase = {
      auth: {
        signInWithPassword: async () => ({
          data: { session: null },
          error: null,
        }),
      },
      from: () => ({
        select: () => ({
          eq: () => ({
            single: async () => ({ data: null, error: null }),
          }),
        }),
      }),
    } as any;
    await use(mockSupabase);
  },
});

/* PREVIOUS IMPLEMENTATION (Commented for reference)
// Extend base test with auth and helpers
export const test = base.extend<{
  adminUser: TestUser;
  portalUser: TestUser;
  supabase: SupabaseClient;
}>({
  // Provide admin user
  adminUser: async ({}, use: (user: TestUser) => Promise<void>) => {
    const user = {
      email: process.env.ADMIN_EMAIL || "admin@example.com",
      password: process.env.ADMIN_PASSWORD || "admin123",
      orgId: "",
      token: "",
    };

    // Get auth token
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_ANON_KEY!,
    );

    const {
      data: { session },
      error,
    } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: user.password,
    });

    if (error) throw error;
    user.token = session!.access_token;
    user.orgId = session!.user.user_metadata.org_id;

    await use(user);
  },

  // Provide portal user
  portalUser: async ({}, use: (user: TestUser) => Promise<void>) => {
    const user = {
      email: process.env.PORTAL_EMAIL || "user@example.com",
      password: process.env.PORTAL_PASSWORD || "user123",
      orgId: "",
      token: "",
    };

    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_ANON_KEY!,
    );

    const {
      data: { session },
      error,
    } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: user.password,
    });

    if (error) throw error;
    user.token = session!.access_token;
    user.orgId = session!.user.user_metadata.org_id;

    await use(user);
  },

  // Provide Supabase client
  supabase: async ({}, use: (client: SupabaseClient) => Promise<void>) => {
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_ANON_KEY!,
    );
    await use(supabase);
  },
});
*/

// Helpers for file uploads
export const uploadFile = async (
  page: Page,
  selector: string,
  filePath: string,
) => {
  const [fileChooser] = await Promise.all([
    page.waitForEvent("filechooser"),
    page.click(selector),
  ]);
  await fileChooser.setFiles(filePath);
};

// Helper to wait for quote status
export const waitForQuoteStatus = async (
  supabase: SupabaseClient,
  quoteId: string,
  status: string,
  timeoutMs = 30000,
) => {
  const startTime = Date.now();
  while (Date.now() - startTime < timeoutMs) {
    const { data: quote } = await supabase
      .from("quotes")
      .select("status")
      .eq("id", quoteId)
      .single();

    if (quote?.status === status) {
      return true;
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  return false;
};

export { expect } from "@playwright/test";
