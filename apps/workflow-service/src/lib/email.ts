import nodemailer from "nodemailer";
import { config } from "../config.js";
import { logger } from "./logger.js";
import { WelcomeTemplate } from "../constants/email-templates/welcome-email.template.js";
import { renderEmail } from "./render-email.js";

const transporter = nodemailer.createTransport({
  host: config.email.smtpHost,
  port: config.email.smtpPort,
  secure: config.email.smtpPort === 465,
  auth: {
    user: config.email.smtpUser,
    pass: config.email.smtpPassword,
  },
  connectionTimeout: 5000,
  socketTimeout: 5000,
});

export interface SendEmailDetails {
  to: string;
  subject: string;
  text?: string;
  html?: string;
  name?: string;
  type?: "welcome" | "general";
  metadata?: Record<string, string>;
}

export const sendEmail = async ({
  to,
  subject,
  text,
  html,
  name,
  type,
}: SendEmailDetails) => {
  try {
    let finalHtml = html;

    if (type && type === "welcome") {
      const mjml = WelcomeTemplate(name);
      finalHtml = renderEmail(mjml);
    }

    const mailOptions = {
      from: config.email.smtpFrom,
      to,
      subject,
      text,
      html: finalHtml || text,
      replyTo: config.email.smtpFrom,
    };

    const result = await transporter.sendMail(mailOptions);
    logger.info({ messageId: result.messageId, to }, "Email sent successfully");
    return { result: result, message: `Email sent to ${to}` };
  } catch (error: any) {
    logger.error({ error: error.message, to }, "Failed to send email");
    throw error;
  }
};
