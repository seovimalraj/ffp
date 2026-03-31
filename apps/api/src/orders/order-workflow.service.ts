import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { Tables } from '../../libs/constants';
import { SupabaseService } from 'src/supabase/supabase.service';
import { CreateOrderWorkflowTemplateDTO } from './order.dto';
import { phasesSchema } from './order.validation';
import { v4 as uuid } from 'uuid';

@Injectable()
export class OrderWorkflowService {
  private readonly logger = new Logger(OrderWorkflowService.name);

  constructor(private readonly supabaseService: SupabaseService) {}

  async createOrderWorkflowTemplate(params: CreateOrderWorkflowTemplateDTO) {
    const client = this.supabaseService.getClient();
    const parsed = phasesSchema.safeParse(params.phases);

    if (!parsed.success) {
      throw new BadRequestException('Phases has structural issues');
    }

    const { data, error } = await client
      .from(Tables.OrderWorkflowTemplates)
      .insert({
        id: uuid(),
        ...params,
      })
      .select()
      .single();

    if (error) {
      this.logger.error(
        { error },
        'Error while creating Order Workflow Template',
      );
      throw new InternalServerErrorException(error);
    }

    return {
      data,
      success: true,
    };
  }

  async updateOrderWorkflowTemplate(
    id: string,
    params: Partial<CreateOrderWorkflowTemplateDTO>,
  ) {
    const client = this.supabaseService.getClient();

    if (params.phases) {
      const parsed = phasesSchema.safeParse(params.phases);
      if (!parsed.success) {
        throw new BadRequestException('Phases has structural issues');
      }
    }

    const { data, error } = await client
      .from(Tables.OrderWorkflowTemplates)
      .update(params)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      this.logger.error(
        { error },
        'Error while updating Order Workflow Template',
      );
      throw new InternalServerErrorException(error);
    }

    return {
      data,
      success: true,
    };
  }

  async getOrderWorkflowTemplates() {
    const client = this.supabaseService.getClient();

    const { data, error } = await client
      .from(Tables.OrderWorkflowTemplates)
      .select('id, name, description, is_active');

    if (error) {
      this.logger.error(
        { error },
        'Error while fetching Order Workflow Templates',
      );
      throw new InternalServerErrorException(error);
    }

    return { data, success: true };
  }

  async getOrderWorkflowTemplate(id: string) {
    const client = this.supabaseService.getClient();

    const { data, error } = await client
      .from(Tables.OrderWorkflowTemplates)
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      this.logger.error(
        { error },
        'Error while fetching Order Workflow Template',
      );
      throw new InternalServerErrorException(error);
    }

    return {
      data,
      success: true,
    };
  }

  async assignWorkflowToOrder(
    orderId: string,
    workflowId: string,
    assignedBy: string,
  ) {
    const client = this.supabaseService.getClient();

    // 1. Get the template
    const template = await this.getOrderWorkflowTemplate(workflowId);

    // 2. Insert the instance
    const { data, error } = await client
      .from(Tables.OrderWorkflowInstances)
      .insert({
        order_id: orderId,
        order_workflow_id: workflowId,
        phase_snapshot: template.data.phases,
        assigned_by: assignedBy,
      })
      .select()
      .single();

    if (error) {
      this.logger.error({ error }, 'Error while assigning workflow to order');
      throw new InternalServerErrorException(error);
    }

    return { data, success: true };
  }

  async getOrderWorkflowInstance(orderId: string) {
    const client = this.supabaseService.getClient();

    const { data, error } = await client
      .from(Tables.OrderWorkflowInstances)
      .select('*, order_workflow_templates(name)')
      .eq('order_id', orderId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return { data: null, success: true };
      }
      this.logger.error(
        { error },
        'Error while fetching Order Workflow Instance',
      );
      throw new InternalServerErrorException(error);
    }

    return { data, success: true };
  }

  async updateOrderWorkflowInstance(orderId: string, phaseSnapshot: any) {
    const client = this.supabaseService.getClient();

    const parsed = phasesSchema.safeParse(phaseSnapshot);
    if (!parsed.success) {
      throw new BadRequestException('Phases has structural issues');
    }

    const { data, error } = await client
      .from(Tables.OrderWorkflowInstances)
      .update({
        phase_snapshot: phaseSnapshot,
      })
      .eq('order_id', orderId)
      .select()
      .single();

    if (error) {
      this.logger.error(
        { error },
        'Error while updating Order Workflow Instance',
      );
      throw new InternalServerErrorException(error);
    }

    return { data, success: true };
  }
}
