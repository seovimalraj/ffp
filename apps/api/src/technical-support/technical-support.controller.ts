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
import { RoleNames } from '../../libs/constants';
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

  @Post('technical-support/:rfqId')
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
      // Optional: Rollback status if workflow fail?
      // For now, just throw error to let admin know it failed.
      throw new HttpException(
        'Failed to send technical support emails',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
