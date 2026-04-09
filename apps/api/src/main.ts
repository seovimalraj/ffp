import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';
import { ValidationPipe, Logger } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);
  const logger = new Logger('Bootstrap');

  app.use(helmet());
  const allowedOrigins = configService.get<string>('ALLOWED_ORIGINS');
  const origins = allowedOrigins 
    ? allowedOrigins.split(',').map(o => o.trim()).filter(Boolean)
    : [configService.get<string>('FRONTEND_URL')!];

  app.enableCors({
    origin: origins,
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const port = configService.get<number>('PORT', 4001);
  await app.listen(port);

  logger.log(`🚀 API-v2 running on http://localhost:${port}`);
}
bootstrap();
