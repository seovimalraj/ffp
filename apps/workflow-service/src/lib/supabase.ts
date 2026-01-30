import { createClient } from "@supabase/supabase-js";
import { config } from "../config.js";

if (!config.supabase.url || !config.supabase.anonKey) {
  throw new Error("Missing Supabase configuration");
}

export const supabase = createClient(
  config.supabase.url!,
  config.supabase.anonKey!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  },
);
