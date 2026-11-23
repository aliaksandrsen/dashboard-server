import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  type ArgumentsHost,
  BadRequestException,
  HttpException,
  HttpStatus,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Prisma } from '../../../generated/prisma/client.js';
import { AllExceptionsFilter } from './all-exceptions.filter.js';
import { REQUEST_ID_HEADER } from '../middleware/request-id.middleware.js';

describe('AllExceptionsFilter', () => {
  let filter: AllExceptionsFilter;
  const jsonMock = vi.fn();
  const statusMock = vi.fn().mockReturnValue({ json: jsonMock });

  const createHost = (method = 'POST', url = '/v1/users', requestId = 'req-123'): ArgumentsHost =>
    ({
      switchToHttp: () => ({
        getResponse: () => ({ status: statusMock }),
        getRequest: () => ({
          method,
          originalUrl: url,
          headers: { [REQUEST_ID_HEADER]: requestId },
        }),
      }),
    }) as unknown as ArgumentsHost;

  beforeEach(() => {
    vi.clearAllMocks();
    filter = new AllExceptionsFilter();
  });

  it('formats standard NestJS HttpException with validation array messages', () => {
    const exception = new BadRequestException(['email must be an email']);
    filter.catch(exception, createHost('POST', '/v1/users', 'req-1'));

    expect(statusMock).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(jsonMock).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 400,
        error: 'Bad Request',
        message: ['email must be an email'],
        path: '/v1/users',
        requestId: 'req-1',
        timestamp: expect.any(String),
      }),
    );
  });

  it('formats HttpException with string response', () => {
    const exception = new HttpException('Forbidden action', HttpStatus.FORBIDDEN);
    filter.catch(exception, createHost('GET', '/v1/admin', 'req-2'));

    expect(statusMock).toHaveBeenCalledWith(HttpStatus.FORBIDDEN);
    expect(jsonMock).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 403,
        error: 'Forbidden',
        message: 'Forbidden action',
      }),
    );
  });

  it('preserves @nestjs/terminus 503 health check details payload', () => {
    const terminusPayload = {
      status: 'error',
      info: { database: { status: 'up' } },
      error: { cache: { status: 'down', message: 'Redis down' } },
      details: {
        database: { status: 'up' },
        cache: { status: 'down', message: 'Redis down' },
      },
    };
    const exception = new ServiceUnavailableException(terminusPayload);
    filter.catch(exception, createHost('GET', '/health', 'req-health'));

    expect(statusMock).toHaveBeenCalledWith(HttpStatus.SERVICE_UNAVAILABLE);
    expect(jsonMock).toHaveBeenCalledWith(
      expect.objectContaining({
        ...terminusPayload,
        path: '/health',
        requestId: 'req-health',
        timestamp: expect.any(String),
      }),
    );
  });

  it('maps Prisma P2002 to 409 Conflict', () => {
    const err = new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
      code: 'P2002',
      clientVersion: '7.10.1',
    });
    filter.catch(err, createHost('POST', '/v1/users'));

    expect(statusMock).toHaveBeenCalledWith(HttpStatus.CONFLICT);
    expect(jsonMock).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 409,
        error: 'Conflict',
      }),
    );
  });

  it('maps Prisma P2003 to 409 Conflict on DELETE and 400 Bad Request on POST', () => {
    const err = new Prisma.PrismaClientKnownRequestError('Foreign key constraint failed', {
      code: 'P2003',
      clientVersion: '7.10.1',
    });

    filter.catch(err, createHost('DELETE', '/v1/users/1'));
    expect(statusMock).toHaveBeenLastCalledWith(HttpStatus.CONFLICT);

    filter.catch(err, createHost('POST', '/v1/orders'));
    expect(statusMock).toHaveBeenLastCalledWith(HttpStatus.BAD_REQUEST);
  });

  it('maps Prisma P2025 to 404 Not Found on PATCH/DELETE and 400 Bad Request on POST', () => {
    const err = new Prisma.PrismaClientKnownRequestError('Record not found', {
      code: 'P2025',
      clientVersion: '7.10.1',
    });

    filter.catch(err, createHost('PATCH', '/v1/users/999'));
    expect(statusMock).toHaveBeenLastCalledWith(HttpStatus.NOT_FOUND);

    filter.catch(err, createHost('DELETE', '/v1/users/999'));
    expect(statusMock).toHaveBeenLastCalledWith(HttpStatus.NOT_FOUND);

    filter.catch(err, createHost('POST', '/v1/orders'));
    expect(statusMock).toHaveBeenLastCalledWith(HttpStatus.BAD_REQUEST);
  });

  it('maps PrismaClientValidationError to 400 Bad Request', () => {
    const err = new Prisma.PrismaClientValidationError('Invalid field', {
      clientVersion: '7.10.1',
    });
    filter.catch(err, createHost('GET', '/v1/users'));

    expect(statusMock).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
  });

  it('maps unknown errors to 500 without leaking internal error messages', () => {
    filter.catch(new Error('SELECT * FROM secret_table failed'), createHost('GET', '/v1/users'));

    expect(statusMock).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(jsonMock).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 500,
        error: 'Internal Server Error',
        message: 'Internal server error',
      }),
    );
  });
});
