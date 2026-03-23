import {
  Injectable,
  OnModuleInit,
  Logger,
  InternalServerErrorException,
} from '@nestjs/common';
import { Connection, Client } from '@temporalio/client';
import { ConfigService } from '@nestjs/config';
import { TaskQueues, TemporalEvents } from '../../libs/constants';

@Injectable()
export class TemporalService implements OnModuleInit {
  private client: Client;
  private readonly logger = new Logger(TemporalService.name);
  private isConnected = false;
  private readonly maxRetries = process.env.NODE_ENV === 'development' ? 1 : 15;
  private readonly baseDelayMs = 2000;

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
        taskQueue: TaskQueues.CoreTaskQueue,
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

  async startProcessPartGeometryWorkflow(data: {
    partId: string;
    filename: string;
    fileUrl: string;
  }) {
    try {
      if (!this.client) {
        throw new Error('Temporal client not initialized');
      }

      const handle = await this.client.workflow.start(
        TemporalEvents.CADProcessingWorkflow,
        {
          taskQueue: TaskQueues.CADTaskQueue,
          workflowId: `cad-process-${data.partId}`,
          args: [data],
        },
      );

      this.logger.log(`Started CAD workflow: ${handle.workflowId}`);
      return handle;
    } catch (error) {
      this.logger.error(
        'Failed to start CAD processing workflow:',
        error.message,
      );
      throw new InternalServerErrorException({ error });
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
          taskQueue: TaskQueues.CoreTaskQueue,
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
    type?: 'welcome' | 'general' | 'document';
    metadata?: Record<string, string>;
    attachments?: {
      filename: string;
      path?: string;
      content?: string;
      cid?: string;
    }[];
  }) {
    try {
      if (!this.client) {
        throw new Error('Temporal client not initialized');
      }

      const handle = await this.client.workflow.start(
        TemporalEvents.SendEmailWorkflow,
        {
          taskQueue: TaskQueues.CoreTaskQueue,
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
          taskQueue: TaskQueues.CoreTaskQueue,
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

  async technicalSupportWorkflow(data: {
    userId: string;
    organizationId: string;
    quoteId?: string;
    email: string;
    phone: string;
    text: string;

    // Email Params
    customerName: string;
    quoteCode?: string;
  }) {
    try {
      if (!this.client) {
        throw new Error('Temporal client not initialized');
      }

      const handle = await this.client.workflow.start(
        TemporalEvents.TechnicalSupportWorkflow,
        {
          taskQueue: TaskQueues.CoreTaskQueue,
          workflowId: `ts-${Date.now()}-${data.email}`,
          args: [data],
        },
      );

      return handle;
    } catch (error) {
      this.logger.error(
        'Failed to start TechnicalSupport workflow:',
        error.message,
      );
      throw error;
    }
  }

  async startOrderPartStatusChangeWorkflow(data: {
    orderId: string;
    orderPartId: string;
    prevStatus: string;
    currentStatus: string;
    notes?: string;
    documents?: string[];
  }) {
    try {
      if (!this.client) {
        throw new Error('Temporal client not initialized');
      }

      const handle = await this.client.workflow.start(
        TemporalEvents.OrderPartStatusChangeWorkflow,
        {
          taskQueue: TaskQueues.CoreTaskQueue,
          workflowId: `order-part-status-${data.orderPartId}-${Date.now()}`,
          args: [data],
        },
      );

      this.logger.log(
        `Started Order Part Status Change workflow: ${handle.workflowId}`,
      );
      return handle;
    } catch (error) {
      this.logger.error(
        'Failed to start Order Part Status Change workflow:',
        error.message,
      );
      throw error;
    }
  }

  async startProductionRequestWorkflow(data: {
    requestCode: string;
    customerEmail: string;
    customerName: string;
    projectName: string;
    projectDescription: string;
    services: string[];
  }) {
    try {
      if (!this.client) {
        throw new Error('Temporal client not initialized');
      }

      const handle = await this.client.workflow.start(
        TemporalEvents.ProductionRequestWorkflow,
        {
          taskQueue: TaskQueues.CoreTaskQueue,
          workflowId: `production-req-${Date.now()}-${data.requestCode}`,
          args: [data],
        },
      );

      this.logger.log(
        `Started Production Request workflow: ${handle.workflowId}`,
      );
      return handle;
    } catch (error) {
      this.logger.error(
        'Failed to start Production Request workflow:',
        error.message,
      );
      throw error;
    }
  }

  async startSupplierAssignmentWorkflow(data: {
    orderId: string;
    supplierEmail: string;
  }) {
    try {
      if (!this.client) {
        throw new Error('Temporal client not initialized');
      }

      const handle = await this.client.workflow.start(
        TemporalEvents.SupplierAssignmentWorkflow,
        {
          taskQueue: TaskQueues.CoreTaskQueue,
          workflowId: `supplier-assign-${data.orderId}-${Date.now()}`,
          args: [data],
        },
      );

      this.logger.log(
        `Started supplier assignment workflow: ${handle.workflowId}`,
      );
      return handle;
    } catch (error) {
      this.logger.error(
        'Failed to start supplier assignment workflow:',
        error.message,
      );
      throw error;
    }
  }

  async startOrderStatusChangeRequestWorkflow(data: {
    supplierEmail: string;
    requestId: string;
  }) {
    try {
      if (!this.client) {
        throw new Error('Temporal client not initialized');
      }

      const handle = await this.client.workflow.start(
        TemporalEvents.OrderStatusChangeRequestWorkflow,
        {
          taskQueue: TaskQueues.CoreTaskQueue,
          workflowId: `oscr-${data.requestId}`,
          args: [data],
        },
      );

      this.logger.log(
        `Started Order Status Change Request workflow: ${handle.workflowId}`,
      );
      return handle;
    } catch (error) {
      this.logger.error(
        'Failed to start Order Status Change Request workflow:',
        error.message,
      );
      throw error;
    }
  }

  async signalOrderStatusChangeRequestWorkflow(
    workflowId: string,
    signal: 'approve' | 'reject',
  ) {
    try {
      if (!this.client) {
        throw new Error('Temporal client not initialized');
      }

      const handle = this.client.workflow.getHandle(workflowId);
      await handle.signal(signal);

      this.logger.log(`Signaled workflow ${workflowId} with ${signal}`);
    } catch (error) {
      this.logger.error(
        `Failed to signal workflow ${workflowId}:`,
        error.message,
      );
      throw error;
    }
  }

  async startSupplierWelcomeWorkflow(data: {
    email: string;
    username: string;
    password?: string;
    organizationName: string;
  }) {
    try {
      if (!this.client) {
        throw new Error('Temporal client not initialized');
      }

      const handle = await this.client.workflow.start(
        TemporalEvents.SupplierWelcomeWorkflow,
        {
          taskQueue: TaskQueues.CoreTaskQueue,
          workflowId: `supplier-welcome-${Date.now()}-${data.email}`,
          args: [data],
        },
      );

      this.logger.log(
        `Started supplier welcome workflow: ${handle.workflowId}`,
      );
      return handle;
    } catch (error) {
      this.logger.error(
        'Failed to start supplier welcome workflow:',
        error.message,
      );
      throw error;
    }
  }

  async startQuoteRequestWorkflow(quoteRequestId: string) {
    try {
      if (!this.client) {
        throw new Error('Temporal client not initialized');
      }

      const handle = await this.client.workflow.start(
        TemporalEvents.QuoteRequestWorkflow,
        {
          taskQueue: TaskQueues.CoreTaskQueue,
          workflowId: `quote-request-${quoteRequestId}`,
          args: [quoteRequestId],
        },
      );

      this.logger.log(`Started quote request workflow: ${handle.workflowId}`);
      return handle;
    } catch (error) {
      this.logger.error(
        'Failed to start quote request workflow:',
        error.message,
      );
    }
  }

  async signalQuoteRequestWorkflow(
    workflowId: string,
    status: 'accepted' | 'declined',
  ) {
    try {
      if (!this.client) {
        throw new Error('Temporal client not initialized');
      }

      const handle = this.client.workflow.getHandle(workflowId);
      await handle.signal('quoteResponse', { status });

      this.logger.log(
        `Signaled quote request workflow ${workflowId} with ${status}`,
      );
    } catch (error) {
      this.logger.warn(
        `Failed to signal quote request workflow ${workflowId}: ${error.message}`,
      );
    }
  }
}
