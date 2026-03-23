import {
  Body,
  Controller,
  Get,
  Patch,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from 'src/auth/auth.guard';
import { RolesGuard } from 'src/auth/roles.guard';
import { CurrentUser } from 'src/auth/user.decorator';
import { QuoteRequestService } from './quote-request.service';
import { Roles } from 'src/auth/roles.decorator';
import { RoleNames } from '../../libs/constants';
import {
  CreateQuoteRequestDTO,
  DeclineQuoteRequestDTO,
  CancelQuoteRequestDTO,
} from './quote-request.dto';

@Controller('quote-request')
@UseGuards(AuthGuard, RolesGuard)
export class QuoteRequestController {
  constructor(private readonly quoteRequestService: QuoteRequestService) {}

  @Post('')
  @Roles(RoleNames.Admin)
  async createQuoteRequest(@CurrentUser() user: any, @Body() body: CreateQuoteRequestDTO) {
    const data = await this.quoteRequestService.createQuoteRequest(body, user);
    return {
      success: true,
      data,
    };
  }

  @Get('')
  @Roles(RoleNames.Admin, RoleNames.Supplier)
  async getQuoteRequests(
    @CurrentUser() user: any,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '10',
  ) {
    const pLimit = parseInt(limit, 10) || 10;
    const pPage = parseInt(page, 10) || 1;

    const result = await this.quoteRequestService.getQuoteRequests(
      user,
      pPage,
      pLimit,
    );

    return {
      success: true,
      ...result,
    };
  }

  @Get(':id')
  @Roles(RoleNames.Admin, RoleNames.Supplier)
  async getQuoteRequestById(@Param('id') id: string, @CurrentUser() user: any) {
    const data = await this.quoteRequestService.getQuoteRequestById(id, user);
    return {
      success: true,
      data,
    };
  }

  @Get('order/:orderId')
  @Roles(RoleNames.Admin)
  async getQuoteRequestsByOrderId(@Param('orderId') orderId: string) {
    const data = await this.quoteRequestService.getQuoteRequestsByOrderId(orderId);
    return {
      success: true,
      data,
    };
  }

  @Patch(':id/accept')
  @Roles(RoleNames.Admin, RoleNames.Supplier)
  async acceptQuoteRequest(@Param('id') id: string, @CurrentUser() user: any) {
    const data = await this.quoteRequestService.acceptQuoteRequest(id, user);
    return {
      success: true,
      data,
    };
  }

  @Patch(':id/decline')
  @Roles(RoleNames.Admin, RoleNames.Supplier)
  async declineQuoteRequest(
    @Param('id') id: string,
    @CurrentUser() user: any,
    @Body() body: DeclineQuoteRequestDTO,
  ) {
    const data = await this.quoteRequestService.declineQuoteRequest(
      id,
      user,
      body.reason,
    );
    return {
      success: true,
      data,
    };
  }

  @Patch(':id/cancel')
  @Roles(RoleNames.Admin)
  async cancelQuoteRequest(
    @Param('id') id: string,
    @CurrentUser() user: any,
    @Body() body: CancelQuoteRequestDTO,
  ) {
    const data = await this.quoteRequestService.cancelQuoteRequest(
      id,
      user,
      body.reason,
    );
    return {
      success: true,
      data,
    };
  }
}
