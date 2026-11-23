import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { Prisma } from '../../../generated/prisma/client.js';
import { REQUEST_ID_HEADER } from '../middleware/request-id.middleware.js';

export interface ErrorResponseBody {
  statusCode: number;
  error: string;
  message: string | string[];
  path: string;
  timestamp: string;
  requestId?: string;
}

const STATUS_NAMES: Record<number, string> = {
  [HttpStatus.BAD_REQUEST]: 'Bad Request',
  [HttpStatus.UNAUTHORIZED]: 'Unauthorized',
  [HttpStatus.FORBIDDEN]: 'Forbidden',
  [HttpStatus.NOT_FOUND]: 'Not Found',
  [HttpStatus.CONFLICT]: 'Conflict',
  [HttpStatus.TOO_MANY_REQUESTS]: 'Too Many Requests',
  [HttpStatus.INTERNAL_SERVER_ERROR]: 'Internal Server Error',
  [HttpStatus.BAD_GATEWAY]: 'Bad Gateway',
  [HttpStatus.SERVICE_UNAVAILABLE]: 'Service Unavailable',
};

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const requestIdHeader = request.headers?.[REQUEST_ID_HEADER];
    const requestId = Array.isArray(requestIdHeader) ? requestIdHeader[0] : requestIdHeader;
    const path = request.originalUrl || request.url || '';
    const method = request.method?.toUpperCase() || 'GET';

    // Preserve @nestjs/terminus HealthCheckResult payload on 503 Service Unavailable
    if (
      exception instanceof HttpException &&
      exception.getStatus() === HttpStatus.SERVICE_UNAVAILABLE
    ) {
      const exceptionResponse = exception.getResponse();
      if (
        typeof exceptionResponse === 'object' &&
        exceptionResponse !== null &&
        'details' in exceptionResponse
      ) {
        this.logger.warn(
          `[${method} ${path}] 503 Health Check Failed (requestId=${requestId ?? 'n/a'})`,
        );
        response.status(HttpStatus.SERVICE_UNAVAILABLE).json({
          ...(exceptionResponse as Record<string, unknown>),
          path,
          timestamp: new Date().toISOString(),
          ...(requestId ? { requestId } : {}),
        });
        return;
      }
    }

    const resolved = this.resolveException(exception, method);

    if (resolved.statusCode >= 500) {
      this.logger.error(
        `[${method} ${path}] ${resolved.statusCode} (requestId=${requestId ?? 'n/a'})`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    } else {
      this.logger.warn(
        `[${method} ${path}] ${resolved.statusCode} ${resolved.error} (requestId=${requestId ?? 'n/a'})`,
      );
    }

    const body: ErrorResponseBody = {
      statusCode: resolved.statusCode,
      error: resolved.error,
      message: resolved.message,
      path,
      timestamp: new Date().toISOString(),
      ...(requestId ? { requestId } : {}),
    };

    response.status(resolved.statusCode).json(body);
  }

  private resolveException(
    exception: unknown,
    method: string,
  ): {
    statusCode: number;
    error: string;
    message: string | string[];
  } {
    if (exception instanceof HttpException) {
      const statusCode = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'string') {
        return {
          statusCode,
          error: STATUS_NAMES[statusCode] ?? 'Error',
          message: exceptionResponse,
        };
      }

      if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
        const record = exceptionResponse as Record<string, unknown>;
        const message =
          typeof record.message === 'string' || Array.isArray(record.message)
            ? (record.message as string | string[])
            : exception.message;
        const error =
          typeof record.error === 'string' ? record.error : (STATUS_NAMES[statusCode] ?? 'Error');

        return { statusCode, error, message };
      }

      return {
        statusCode,
        error: STATUS_NAMES[statusCode] ?? 'Error',
        message: exception.message,
      };
    }

    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      switch (exception.code) {
        case 'P2002':
          return {
            statusCode: HttpStatus.CONFLICT,
            error: 'Conflict',
            message: 'A record with this unique value already exists.',
          };
        case 'P2003':
          if (method === 'DELETE') {
            return {
              statusCode: HttpStatus.CONFLICT,
              error: 'Conflict',
              message: 'Cannot delete resource because related records exist.',
            };
          }
          return {
            statusCode: HttpStatus.BAD_REQUEST,
            error: 'Bad Request',
            message: 'Referenced record does not exist.',
          };
        case 'P2025':
          if (method === 'POST') {
            return {
              statusCode: HttpStatus.BAD_REQUEST,
              error: 'Bad Request',
              message: 'Referenced record does not exist.',
            };
          }
          return {
            statusCode: HttpStatus.NOT_FOUND,
            error: 'Not Found',
            message: 'Requested record was not found.',
          };
        default:
          return {
            statusCode: HttpStatus.BAD_REQUEST,
            error: 'Bad Request',
            message: 'Database request failed.',
          };
      }
    }

    if (exception instanceof Prisma.PrismaClientValidationError) {
      return {
        statusCode: HttpStatus.BAD_REQUEST,
        error: 'Bad Request',
        message: 'Invalid database query parameters.',
      };
    }

    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      error: 'Internal Server Error',
      message: 'Internal server error',
    };
  }
}
