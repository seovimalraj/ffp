import { Tables } from "../constants/index.js";
import { sendEmail } from "../lib/email.js";
import { logger } from "../lib/logger.js";
import { renderEmail } from "../lib/render-email.js";
import { supabase } from "../lib/supabase.js";

export type OSCRType = {};

export async function fetchRequestData(requestId: string) {
  try {
    const { data: orscData, error: orscError } = await supabase
      .from(Tables.OrderStatusChangeRequests)
      .select("*")
      .eq("id", requestId)
      .single();

    if (orscError) {
      throw orscError;
    }
    return orscData;
  } catch (error) {
    logger.error({ error }, "Failed to get OrderStatusChangeRequest");
    throw error;
  }
}

export async function sendVerfiersOSCR(requestId: string) {
  try {
    // 1. Fetch Admin/Verifier Email
    const { data: configData, error: configError } = await supabase
      .from(Tables.SystemConfig)
      .select("value")
      .eq("key", "verifier_email_multi")
      .single();

    if (configError || !configData?.value) {
      logger.error(
        { configError },
        "Failed to fetch verifier_email_multi from system_config",
      );
      throw configError || new Error("Config verifier_email_multi not found");
    }

    let adminEmails: string[] = [];
    try {
      adminEmails = JSON.parse(configData.value);
      if (!Array.isArray(adminEmails)) adminEmails = [configData.value];
    } catch (_e) {
      adminEmails = [configData.value];
    }
  } catch (error) {
    logger.error({ error }, "Error while sending emails to verifiers");
    throw error;
  }
}
