import { Body, Controller, Post } from '@nestjs/common';
import { EmailService } from './email.service';

interface SendEmailDto {
    to: string;
    subject: string;
    name: string;
    text?: string;
    html?: string;
}

@Controller('email')
export class EmailController {
    constructor(private readonly emailService: EmailService) {}

    @Post('send')
    async send(@Body() body: SendEmailDto) {
        await this.emailService.sendEmail(
            body.to,
            body.subject,
            body.text || "text",
            body.html || "html",
            body.name
        );
        return { message: 'Email queued for sending' };
    }
}
