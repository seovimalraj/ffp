import { Injectable, Logger } from '@nestjs/common';
import { inngest } from './client';

// You can copy these types from inngest-service/src/types/events.ts
// Or create a shared package for types
type WorkflowEvents = {
  'test/hello.world': {
    message?: string;
  };
  'rfq/quote.created': {
    quoteId: string;
    userId: string;
    data?: Record<string, any>;
  };
  'system/email.send': {
    to: string;
    subject: string;
    body: string;
    name: string;
    type?: string;
  };
  'rfq/manual-quote.approval': {
    userId: string;
    quoteId: string;
  };
  // Add more event types as needed
};

type WorkflowEventName = keyof WorkflowEvents;

@Injectable()
export class InngestService {
  private readonly logger = new Logger(InngestService.name);

  /**
   * Send a typed event to the Inngest workflow service
   * @param eventName - The name of the event
   * @param data - The event payload (type-checked based on event name)
   */
  async sendEvent<T extends WorkflowEventName>(
    eventName: T,
    data: WorkflowEvents[T],
  ) {
    try {
      await inngest.send({
        name: eventName,
        data,
      });
      this.logger.log(`Event sent: ${eventName}`);
    } catch (error) {
      this.logger.error(`Failed to send event ${eventName}:`, error);
      throw error;
    }
  }

  /**
   * Send multiple events to the Inngest workflow service
   * @param events - Array of events to send
   */
  async sendEvents(
    events: Array<{ name: string; data: any; id?: string; ts?: number }>,
  ) {
    try {
      await inngest.send(events);
      this.logger.log(`Sent ${events.length} events`);
    } catch (error) {
      this.logger.error(`Failed to send events:`, error);
      throw error;
    }
  }
}
