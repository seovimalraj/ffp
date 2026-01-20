import { Logger, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthController } from './auth.controller';
import { AuthGuard } from './auth.guard';
import { SupabaseModule } from '../supabase/supabase.module';
import { BullModule } from '@nestjs/bullmq';
import { EmailService } from 'src/email/email.service';

@Module({
  imports: [
    SupabaseModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: configService.get<string>('JWT_EXPIRES_IN', '15m'),
        },
      }),
      inject: [ConfigService],
    }),
    BullModule.registerQueue({
      name: 'email',
    }),
  ],
  controllers: [AuthController],
  providers: [AuthGuard, Logger, EmailService],
  exports: [JwtModule, AuthGuard],
})
export class AuthModule {}
