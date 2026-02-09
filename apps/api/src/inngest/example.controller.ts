// Example: How to use InngestService in your controllers

import { Controller, Post, Body } from '@nestjs/common';
import { InngestService } from '../inngest/inngest.service';

@Controller('example')
export class ExampleController {
  constructor(private readonly inngestService: InngestService) {}

  @Post('create-quote')
  async createQuote(@Body() body: any) {
    // Your business logic here
    const quote = { id: 'quote-123', ...body };

    // Send event to Inngest workflow service
    await this.inngestService.sendEvent('rfq/quote.created', {
      quoteId: quote.id,
      userId: 'user-123',
      data: quote,
    });

    return { success: true, quote };
  }

  @Post('bulk-action')
  async bulkAction(@Body() _body: any) {
    await this.inngestService.sendEvents([
      {
        name: 'rfq/quote.created',
        data: { quoteId: '1', userId: 'user-1' },
      },
      {
        name: 'rfq/quote.created',
        data: { quoteId: '2', userId: 'user-2' },
      },
    ]);

    return { success: true };
  }

  @Post('send-email')
  async sendEmail(@Body() body: any) {
    await this.inngestService.sendEvent('system/email.send', {
      to: body.to,
      subject: body.subject,
      body: body.body,
      name: body.name,
      type: body.type,
    });
  }
}
