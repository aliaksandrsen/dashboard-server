import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateIf,
  validateSync,
} from 'class-validator';

export enum Environment {
  Development = 'development',
  Production = 'production',
  Test = 'test',
}

export class EnvironmentVariables {
  @IsOptional()
  @IsEnum(Environment)
  NODE_ENV: Environment = Environment.Development;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(65535)
  PORT: number = 3000;

  @IsString()
  @IsNotEmpty()
  DATABASE_URL!: string;

  @ValidateIf((env: EnvironmentVariables) => env.NODE_ENV === Environment.Production)
  @IsString()
  @IsNotEmpty()
  STRIPE_SECRET_KEY?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  STRIPE_SYNC_CRON: string = '5 00 * * *';

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  STRIPE_SYNC_TIMEZONE: string = 'America/New_York';

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  REDIS_HOST: string = 'localhost';

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(65535)
  REDIS_PORT: number = 6379;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  REDIS_URL?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  FRONTEND_URL?: string;

  @IsOptional()
  @IsInt()
  @Min(1000)
  THROTTLE_TTL_MS: number = 60_000;

  @IsOptional()
  @IsInt()
  @Min(1)
  THROTTLE_LIMIT: number = 100;
}

export function validateEnv(config: Record<string, unknown>): EnvironmentVariables {
  const sanitizedConfig: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(config)) {
    if (typeof value === 'string' && value.trim() === '') {
      continue;
    }
    sanitizedConfig[key] = value;
  }

  const validatedConfig = plainToInstance(EnvironmentVariables, sanitizedConfig, {
    enableImplicitConversion: true,
    exposeDefaultValues: true,
  });

  const errors = validateSync(validatedConfig, {
    skipMissingProperties: false,
  });

  if (errors.length > 0) {
    const details = errors
      .map((err) => {
        const constraints = err.constraints ? Object.values(err.constraints).join(', ') : 'invalid';
        return `${err.property}: ${constraints}`;
      })
      .join('; ');

    throw new Error(`Invalid environment configuration: ${details}`);
  }

  return validatedConfig;
}
