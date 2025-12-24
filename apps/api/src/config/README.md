# Configuration Module

This directory contains environment variable validation and configuration management for API-v2.

## Files

- **env.validation.ts** - Validates environment variables on startup using class-validator
- **config.service.ts** - Type-safe configuration service for accessing env vars
- **configuration.ts** - Configuration factory (optional, for complex setups)

## Usage

### In Services/Controllers

```typescript
import { ConfigService } from '@nestjs/config';

constructor(private configService: ConfigService) {}

const port = this.configService.get<number>('PORT');
const supabaseUrl = this.configService.get<string>('SUPABASE_URL');
```

### Using AppConfigService (Type-safe)

```typescript
import { AppConfigService } from './config/config.service';

constructor(private config: AppConfigService) {}

const port = this.config.port; // Type-safe, no need for generics
const isDev = this.config.isDevelopment;
```

## Validation

On startup, all required environment variables are validated:
- PORT must be a number
- FRONTEND_URL must be a valid URL
- SUPABASE_URL must be a valid URL
- SUPABASE_KEY must be a string

If validation fails, the app will not start and will show detailed error messages.

## Adding New Variables

1. Add to `.env` and `.env.example`
2. Add validation rule to `EnvironmentVariables` class in `env.validation.ts`
3. Add getter to `AppConfigService` in `config.service.ts`
