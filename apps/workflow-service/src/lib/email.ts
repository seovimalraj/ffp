import nodemailer from "nodemailer";
import { config } from "../config.js";
import { logger } from "./logger.js";
import {
  WelcomeTemplate,
  TechnicalSupportTemplate,
} from "../constants/email-templates/index.js";
import { renderEmail } from "./render-email.js";
import { getOrderDocumentTemplate } from "../constants/email-templates/order-document.template.js";

const transporter = nodemailer.createTransport({
  host: config.email.smtpHost,
  port: config.email.smtpPort,
  secure: false,
  requireTLS: true,
  auth: {
    user: config.email.smtpUser,
    pass: config.email.smtpPassword,
  },
  connectionTimeout: 5000,
  socketTimeout: 5000,
});

export interface AttachmentType {
  filename: string;
  path?: string;
  content?: string;
  cid?: string;
}

export interface SendEmailDetails {
  to: string;
  subject: string;
  text?: string;
  html?: string;
  name?: string;
  type?: "welcome" | "general" | "document" | "tech-support";
  attachments?: AttachmentType[];
  metadata?: Record<string, string>;
}

export const sendEmail = async ({
  to,
  subject,
  text,
  html,
  name,
  type,
  attachments,
  metadata,
}: SendEmailDetails) => {
  try {
    let finalHtml = html;

    if (type) {
      let mjml: string | undefined;

      switch (type) {
        case "welcome":
          mjml = WelcomeTemplate(name);
          break;
        case "document":
          mjml = getOrderDocumentTemplate(
            metadata?.orderId || "",
            metadata?.username || "",
          );
          break;
        case "tech-support":
          mjml = TechnicalSupportTemplate(
            metadata?.username || "",
            metadata?.userEmail || "",
            metadata?.phoneNumber || "",
            metadata?.quoteId || metadata?.orderId || "",
            metadata?.quoteCode || "",
          );
          break;
      }

      if (mjml) {
        finalHtml = renderEmail(mjml);
      }
    }

    console.log({
      host: config.email.smtpHost,
      port: config.email.smtpPort,
      secure: config.email.smtpPort === 2587,
      auth: {
        user: config.email.smtpUser,
        pass: config.email.smtpPassword,
      },
      connectionTimeout: 5000,
      socketTimeout: 5000,
    });

    const mailOptions = {
      from: config.email.smtpFrom,
      to,
      subject,
      text,
      html: finalHtml || text,
      replyTo: config.email.smtpFrom,
      ...(attachments && { attachments: attachments }),
    };

    const result = await transporter.sendMail(mailOptions);
    logger.info({ messageId: result.messageId, to }, "Email sent successfully");
    return { result: result, message: `Email sent to ${to}` };
  } catch (error: any) {
    logger.error({ error: error.message, to }, "Failed to send email");
    throw error;
  }
};
