import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from 'src/auth/auth.guard';
import { RolesGuard } from 'src/auth/roles.guard';
import { Roles } from 'src/auth/roles.decorator';
import { RoleNames } from '../../libs/constants';
import { OrderWorkflowService } from './order-workflow.service';
import {
  AssignWorkflowToOrderDTO,
  CreateOrderWorkflowTemplateDTO,
  UpdateOrderWorkflowInstanceDTO,
} from './order.dto';
import { CurrentUser } from 'src/auth/user.decorator';
import { CurrentUserDto } from 'src/auth/auth.dto';

@Controller('order-workflows')
@UseGuards(AuthGuard, RolesGuard)
export class OrderWorkflowController {
  constructor(private readonly workflowService: OrderWorkflowService) {}

  @Post('templates')
  @Roles(RoleNames.Admin)
  async createTemplate(
    @CurrentUser() user: CurrentUserDto,
    @Body() body: CreateOrderWorkflowTemplateDTO,
  ) {
    body.created_by = user.id;
    return this.workflowService.createOrderWorkflowTemplate(body);
  }

  @Get('templates')
  async getTemplates() {
    return this.workflowService.getOrderWorkflowTemplates();
  }

  @Patch('templates/:id')
  @Roles(RoleNames.Admin)
  async updateTemplate(
    @Param('id') id: string,
    @Body() body: Partial<CreateOrderWorkflowTemplateDTO>,
  ) {
    return this.workflowService.updateOrderWorkflowTemplate(id, body);
  }

  @Get('templates/:id')
  async getTemplate(@Param('id') id: string) {
    return this.workflowService.getOrderWorkflowTemplate(id);
  }

  @Post('assign/:orderId')
  @Roles(RoleNames.Admin)
  async assignWorkflow(
    @Param('orderId') orderId: string,
    @CurrentUser() user: CurrentUserDto,
    @Body() body: AssignWorkflowToOrderDTO,
  ) {
    return this.workflowService.assignWorkflowToOrder(
      orderId,
      body.order_workflow_id,
      user.id,
    );
  }

  @Get('instance/:orderId')
  async getInstance(@Param('orderId') orderId: string) {
    return this.workflowService.getOrderWorkflowInstance(orderId);
  }

  @Patch('instance/:orderId')
  @Roles(RoleNames.Admin)
  async updateInstance(
    @Param('orderId') orderId: string,
    @Body() body: UpdateOrderWorkflowInstanceDTO,
  ) {
    return this.workflowService.updateOrderWorkflowInstance(
      orderId,
      body.phase_snapshot,
    );
  }
}
