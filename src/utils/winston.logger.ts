import type { LoggerService } from '@nestjs/common';
import { WinstonModule, utilities as nestWinstonModuleUtilities } from 'nest-winston';
import { format, transports } from 'winston';

/**
 * Creates a Winston-backed NestJS LoggerService.
 * - Outputs readable Nest-like logs to the Console.
 * - Writes structured JSON logs to `./logs/server.log` (compatible with Datadog, Grafana Loki, ELK).
 * - Sets log level based on environment ('info' in production, 'debug' in development/test).
 */
export function createWinstonLogger(
  nodeEnv: string | undefined = process.env.NODE_ENV,
): LoggerService {
  const isProduction = nodeEnv === 'production';
  const level = isProduction ? 'info' : 'debug';

  return WinstonModule.createLogger({
    level,
    exitOnError: false,
    transports: [
      new transports.Console({
        format: format.combine(
          format.timestamp(),
          format.ms(),
          nestWinstonModuleUtilities.format.nestLike('DashboardServer', {
            colors: !isProduction,
            prettyPrint: true,
          }),
        ),
      }),
      new transports.File({
        filename: './logs/server.log',
        format: format.combine(format.timestamp(), format.json()),
      }),
    ],
  });
}
