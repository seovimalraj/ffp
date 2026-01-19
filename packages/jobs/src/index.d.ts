export declare const QueueNames: {
    readonly EMAIL: "email";
};
export declare const EmailJobNames: {
    readonly SEND_WELCOME_EMAIL: "send-welcome-email";
    readonly SEND_QUOTE_NOTIFICATION: "send-quote-notification";
};
export interface SendWelcomeEmailData {
    email: string;
    name: string;
}
export interface SendQuoteNotificationData {
    email: string;
    quoteId: string;
    amount: string;
}
