import {
  Body,
  Controller,
  HttpException,
  HttpStatus,
  Logger,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { RoleNames, Tables } from '../../libs/constants';
import { AuthGuard } from 'src/auth/auth.guard';
import { RolesGuard } from 'src/auth/roles.guard';
import { SupabaseService } from 'src/supabase/supabase.service';
import { Roles } from 'src/auth/roles.decorator';
import { CurrentUser } from 'src/auth/user.decorator';
import { CurrentUserDto } from 'src/auth/auth.dto';
import { TemporalService } from 'src/temporal/temporal.service';

@Controller('technical-support')
@UseGuards(AuthGuard, RolesGuard)
export class TechnicalSupportController {
  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly temporalService: TemporalService,
    private readonly logger: Logger,
  ) {}

  @Post('production-request')
  @Roles(RoleNames.Customer)
  async createProductionRequest(
    @CurrentUser() currentUser: CurrentUserDto,
    @Body()
    body: {
      projectName: string;
      projectDescription: string;
      services: string[];
    },
  ) {
    const client = this.supabaseService.getClient();

    const { data, error } = await client
      .from(Tables.ProductionOrderRequest)
      .insert({
        project_name: body.projectName,
        project_description: body.projectDescription,
        manufacturing_services: body.services,
        organization_id: currentUser.organizationId,
      })
      .select()
      .single();

    if (error) {
      this.logger.error(
        { error, userId: currentUser.id },
        'Failed to create production order request',
      );
      throw new HttpException(
        error.message || 'Failed to create production request',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    // Trigger email workflow (fire-and-forget, don't block the response)
    try {
      await this.temporalService.startProductionRequestWorkflow({
        requestCode: data.code,
        customerEmail: currentUser.email,
        customerName: currentUser.name,
        projectName: body.projectName,
        projectDescription: body.projectDescription,
        services: body.services,
      });
    } catch (workflowError) {
      this.logger.error(
        { workflowError, requestCode: data.code },
        'Failed to start production request email workflow',
      );
      // Don't fail the request — the DB record was created successfully
    }

    return {
      success: true,
      productionRequest: data,
    };
  }

  @Post(':rfqId')
  @Roles(RoleNames.Customer)
  async sendTechnicalSupportRequest(
    @Param('rfqId') rfqId: string,
    @CurrentUser() currentUser: CurrentUserDto,
    @Body()
    body: {
      quoteCode: string;
      phone: string;
      email: string;
      text: string;
    },
  ) {
    try {
      await this.temporalService.technicalSupportWorkflow({
        userId: currentUser.id,
        organizationId: currentUser.organizationId,
        quoteId: rfqId,
        email: body.email,
        phone: body.phone,
        text: body.text,

        customerName: currentUser.name,
        quoteCode: body.quoteCode,
      });
    } catch (temporalError) {
      this.logger.error('Failed to start Temporal workflow', temporalError);
      throw new HttpException(
        'Failed to send technical support emails',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
