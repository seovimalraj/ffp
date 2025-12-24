import { Injectable } from '@nestjs/common';
import { ConfigService as NestConfigService } from '@nestjs/config';

@Injectable()
export class AppConfigService {
  constructor(private configService: NestConfigService) {}

  get port(): number {
    return this.configService.get<number>('PORT', 4001);
  }

  get frontendUrl(): string {
    return this.configService.get<string>('FRONTEND_URL')!;
  }

  get supabaseUrl(): string {
    return this.configService.get<string>('SUPABASE_URL')!;
  }

  get supabaseKey(): string {
    return this.configService.get<string>('SUPABASE_KEY')!;
  }

  get nodeEnv(): string {
    return this.configService.get<string>('NODE_ENV', 'development');
  }

  get isDevelopment(): boolean {
    return this.nodeEnv === 'development';
  }

  get isProduction(): boolean {
    return this.nodeEnv === 'production';
  }
}
