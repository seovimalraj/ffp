import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { Connection, Client } from '@temporalio/client';
import { ConfigService } from '@nestjs/config';
import { TemporalEvents } from '../../libs/constants';

@Injectable()
export class TemporalService implements OnModuleInit {
  private client: Client;
  private readonly logger = new Logger(TemporalService.name);
  private isConnected = false;
  private readonly maxRetries = 5;
  private readonly baseDelayMs = 1000;

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit() {
    await this.connectWithRetry();
  }

  private async connectWithRetry(attempt = 1): Promise<void> {
    const address = this.configService.get<string>(
      'TEMPORAL_ADDRESS',
      this.configService.get<string>('temporal.address', 'localhost:7233'),
    );
    const namespace = this.configService.get<string>(
      'TEMPORAL_NAMESPACE',
      this.configService.get<string>('temporal.namespace', 'default'),
    );

    try {
      const connection = await Connection.connect({ address });

      this.client = new Client({ connection, namespace });
      this.isConnected = true;

      this.logger.log(
        `Connected to Temporal at ${address} (namespace: ${namespace})`,
      );
    } catch (error) {
      this.isConnected = false;

      if (attempt >= this.maxRetries) {
        this.logger.error(
          `Failed to connect to Temporal after ${this.maxRetries} attempts: ${error.message}`,
        );
        return;
      }

      const delay = this.baseDelayMs * Math.pow(2, attempt - 1);
      this.logger.warn(
        `Temporal connection attempt ${attempt}/${this.maxRetries} failed: ${error.message}. Retrying in ${delay}ms...`,
      );

      await new Promise((resolve) => setTimeout(resolve, delay));
      return this.connectWithRetry(attempt + 1);
    }
  }

  /** Check whether the Temporal client is ready. */
  isHealthy(): boolean {
    return this.isConnected && !!this.client;
  }

  async startQuoteCreatedWorkflow(data: {
    email: string;
    name: string;
    quoteId: string;
  }) {
    try {
      if (!this.client) {
        throw new Error('Temporal client not initialized');
      }

      const handle = await this.client.workflow.start('quoteCreatedWorkflow', {
        taskQueue: 'quote-tasks',
        workflowId: `quote-${data.quoteId}`,
        args: [data],
      });

      this.logger.log(`Started quote workflow: ${handle.workflowId}`);
      return handle;
    } catch (error) {
      this.logger.error('Failed to start quote workflow:', error.message);
      throw error;
    }
  }

  async reviewManualQuoteWorkflow(data: { userId: string; quoteId: string }) {
    try {
      if (!this.client) {
        throw new Error('Temporal client not initialized');
      }

      const handle = await this.client.workflow.start(
        TemporalEvents.ReviewManualQuoteWorkflow,
        {
          taskQueue: 'quote-tasks',
          workflowId: `quote-rmqw-${data.quoteId}`,
          args: [data],
        },
      );

      this.logger.log(`Started quote workflow: ${handle.workflowId}`);
      return handle;
    } catch (error) {
      this.logger.error('Failed to send review:', error.message);
    }
  }

  async sendEmail(data: {
    to: string;
    subject: string;
    text?: string;
    html?: string;
    name?: string;
    type?: 'welcome' | 'general';
  }) {
    try {
      if (!this.client) {
        throw new Error('Temporal client not initialized');
      }

      const handle = await this.client.workflow.start(
        TemporalEvents.SendEmailWorkflow,
        {
          taskQueue: 'quote-tasks',
          workflowId: `email-${Date.now()}-${data.to}`,
          args: [data],
        },
      );

      this.logger.log(`Started email workflow: ${handle.workflowId}`);
      return handle;
    } catch (error) {
      this.logger.error('Failed to start email workflow:', error.message);
      throw error;
    }
  }

  async otpWorkflow(data: { email: string; username: string; code?: string }) {
    try {
      if (!this.client) {
        throw new Error('Temporal client not initialized');
      }

      const handle = await this.client.workflow.start(
        TemporalEvents.OtpWorkflow,
        {
          taskQueue: 'quote-tasks',
          workflowId: `otp-${Date.now()}-${data.email}`,
          args: [data],
        },
      );

      this.logger.log(`Started OTP workflow: ${handle.workflowId}`);
      return handle;
    } catch (error) {
      this.logger.error('Failed to start OTP workflow:', error.message);
      throw error;
    }
  }
}
