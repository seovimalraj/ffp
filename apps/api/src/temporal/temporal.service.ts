import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { Connection, Client } from '@temporalio/client';
import { ConfigService } from '@nestjs/config';
import { TemporalEvents } from '../../libs/constants';

@Injectable()
export class TemporalService implements OnModuleInit {
  private client: Client;
  private readonly logger = new Logger(TemporalService.name);

  constructor(private configService: ConfigService) {}

  async onModuleInit() {
    try {
      const connection = await Connection.connect({
        address: this.configService.get<string>(
          'temporal.address',
          '172.17.0.1:7233',
        ),
      });

      this.client = new Client({
        connection,
        namespace: this.configService.get<string>(
          'temporal.namespace',
          'default',
        ),
      });

      this.logger.log('Connected to Temporal');
    } catch (error) {
      this.logger.error('Failed to connect to Temporal:', error.message);
    }
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

  async otpWorkflow(data: { email: string; username: string }) {
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
