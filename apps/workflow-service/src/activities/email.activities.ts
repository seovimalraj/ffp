import { sendEmail, type SendEmailDetails } from "../lib/email.js";

/**
 * Activity to send an email using the established email library.
 * This is the "work" part of the workflow.
 */
export async function sendEmailActivity(
  details: SendEmailDetails,
): Promise<any> {
  return await sendEmail(details);
}
