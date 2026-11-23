import { describe, it, expect, vi } from 'vitest';
import type { NextFunction, Request, Response } from 'express';
import { REQUEST_ID_HEADER, RequestIdMiddleware } from './request-id.middleware.js';

describe('RequestIdMiddleware', () => {
  const middleware = new RequestIdMiddleware();

  it('generates a UUID when x-request-id header is absent', () => {
    const req = { headers: {} } as unknown as Request;
    const setHeader = vi.fn();
    const res = { setHeader } as unknown as Response;
    const next = vi.fn() as unknown as NextFunction;

    middleware.use(req, res, next);

    const assignedId = req.headers[REQUEST_ID_HEADER] as string;
    expect(assignedId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
    expect(setHeader).toHaveBeenCalledWith(REQUEST_ID_HEADER, assignedId);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('preserves a valid incoming x-request-id header', () => {
    const req = {
      headers: { [REQUEST_ID_HEADER]: '  req-trace-123  ' },
    } as unknown as Request;
    const setHeader = vi.fn();
    const res = { setHeader } as unknown as Response;
    const next = vi.fn() as unknown as NextFunction;

    middleware.use(req, res, next);

    expect(req.headers[REQUEST_ID_HEADER]).toBe('req-trace-123');
    expect(setHeader).toHaveBeenCalledWith(REQUEST_ID_HEADER, 'req-trace-123');
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('replaces overly long x-request-id headers with a generated UUID', () => {
    const req = {
      headers: { [REQUEST_ID_HEADER]: 'x'.repeat(200) },
    } as unknown as Request;
    const setHeader = vi.fn();
    const res = { setHeader } as unknown as Response;
    const next = vi.fn() as unknown as NextFunction;

    middleware.use(req, res, next);

    const assignedId = req.headers[REQUEST_ID_HEADER] as string;
    expect(assignedId).not.toBe('x'.repeat(200));
    expect(assignedId.length).toBeLessThanOrEqual(36);
    expect(setHeader).toHaveBeenCalledWith(REQUEST_ID_HEADER, assignedId);
  });
});
