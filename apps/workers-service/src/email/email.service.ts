import { InjectQueue } from '@nestjs/bullmq';
import { BadRequestException, Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';

@Injectable()
export class EmailService {
    constructor(
        @InjectQueue("email") private readonly emailQueue: Queue
    ) {}

    private validateEmail(email: string): boolean {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    private sanitizeInput(input: string): string {
        return input?.trim().slice(0, 1000) || '';
    }

    async sendEmail(to: string, subject: string, text: string, html: string, name: string) {
        if (!to || !this.validateEmail(to)) {
            throw new BadRequestException('Invalid email address');
        }

        if (!subject || subject.trim().length === 0) {
            throw new BadRequestException('Subject is required');
        }

        if (!text && !html) {
            throw new BadRequestException('Email body (text or html) is required');
        }

        await this.emailQueue.add(
            "send-email",
            {
                to: this.sanitizeInput(to),
                subject: this.sanitizeInput(subject),
                text: this.sanitizeInput(text),
                html: this.sanitizeInput(html),
                name: this.sanitizeInput(name),
                sendAt: new Date()
            },
            { attempts: 3, backoff: { type: 'exponential', delay: 2000 } }
        );
    }
}
