import { BaseEmailTemplate } from "../constants/email-templates/base.template.js";
import { Tables } from "../constants/index.js";
import { config } from "../config.js";
import { sendEmail, type SendEmailDetails } from "../lib/email.js";
import { renderEmail } from "../lib/render-email.js";
import { supabase } from "../lib/supabase.js";
import { logger } from "../lib/logger.js";

const defaultUserSelect = "email id organization_id name role";
const QuoteReadyTemplate = (quoteId: string, name: string = "Customer") => `
        <mj-text>
          Hi ${name},
        </mj-text>

        <mj-text padding-top="10px">
          Great news! Our team has finished reviewing your manual quote request.
          You can now view the pricing and lead times on your dashboard.
        </mj-text>

        <mj-text padding-top="10px">
          To proceed, please review the quote and choose your preferred lead time to finalize the order.
        </mj-text>

        <mj-button href="${config.frontendUrl}/portal/quotes/${quoteId}" padding-top="18px">
          Review Quote
        </mj-button>

        <mj-text padding-top="18px">
          Want to explore more? Visit the platform to see active parts, responses,
          and updates in real time.
        </mj-text>

        <mj-text padding-top="18px">
          Need help or have questions about your quote? Just reply to this email —
          our team is happy to help.
        </mj-text>

        <mj-text padding-top="18px">
          Best regards,<br /><br />
          <b>Frigate Team</b><br />
          Fast Parts Platform
        </mj-text>
`;
interface User {
  email: string;
  name: string;
  id: string;
  organization_id?: string;
  role?: string;
}

export async function getUser(
  userId: string,
  select: string = defaultUserSelect,
): Promise<User> {
  try {
    const { data, error } = await supabase
      .from(Tables.UserTable)
      .select(select)
      .eq("id", userId)
      .single();

    if (error) {
      throw new Error(`Database error: ${error.message}`);
    }

    if (!data) {
      throw new Error(`User with ID ${userId} not found`);
    }

    return data as any as User;
  } catch (error: any) {
    logger.error({ error: error.message, userId }, "Failed to get user");
    throw error;
  }
}

export async function sendNotficationMailForManualQuoteReview(
  userEmail: string,
  quoteId: string,
  userName: string = "Customer",
) {
  // Let errors bubble up so Temporal retry policy takes effect
  const mjmlContent = BaseEmailTemplate(
    QuoteReadyTemplate(quoteId, userName),
    "Quote Review Complete",
  );

  const htmlContent = renderEmail(mjmlContent);

  const customerEmail: SendEmailDetails = {
    to: userEmail,
    subject: `Your quote is ready for review`,
    html: htmlContent,
  };

  return await sendEmail(customerEmail);
}
