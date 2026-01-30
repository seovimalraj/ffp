/**
 * Event types for the workflow service
 * These types ensure type safety when sending events from the API
 */

export type WorkflowEvents = {
  "test/hello.world": {
    message?: string;
  };

  "rfq/quote.created": {
    quoteId: string;
    userId: string;
    data?: Record<string, any>;
  };

  "rfq/quote.updated": {
    quoteId: string;
    userId: string;
    changes: Record<string, any>;
  };

  "rfq/quote.deleted": {
    quoteId: string;
    userId: string;
  };

  "order/payment.completed": {
    orderId: string;
    userId: string;
    amount: number;
    currency: string;
  };

  "user/account.verified": {
    userId: string;
    email: string;
  };
};

export type WorkflowEventName = keyof WorkflowEvents;

export type WorkflowEventData<T extends WorkflowEventName> = WorkflowEvents[T];
