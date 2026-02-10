import { Controller, Post, Body } from '@nestjs/common';
import { TemporalService } from '../temporal/temporal.service';

@Controller('example')
export class ExampleController {
  constructor(private readonly temporalService: TemporalService) {}

  @Post('send-email')
  async sendEmail(@Body() body: any) {
    await this.temporalService.sendEmail({
      to: body.to,
      subject: body.subject,
      text: body.body,
      name: body.name,
      type: body.type,
    });
  }
}
