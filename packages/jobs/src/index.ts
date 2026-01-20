export const QueueNames = {
  EMAIL: "email",
} as const;

export const EmailJobNames = {
  SEND_WELCOME_EMAIL: "send-welcome-email",
  SEND_QUOTE_NOTIFICATION: "send-quote-notification",
} as const;

export interface SendWelcomeEmailData {
  email: string;
  name: string;
}

export interface SendQuoteNotificationData {
  email: string;
  quoteId: string;
  amount: string;
}
