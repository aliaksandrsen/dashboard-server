import { BadRequestException } from '@nestjs/common';

export const DEFAULT_ALLOWED_ORIGINS = ['http://localhost:5173', 'http://127.0.0.1:5173'] as const;

export function normalizeOrigin(origin: string): string {
  return origin.trim().replace(/\/+$/, '');
}

export function getAllowedOrigins(
  frontendUrl: string | undefined = process.env.FRONTEND_URL,
): string[] {
  if (!frontendUrl?.trim()) {
    return [...DEFAULT_ALLOWED_ORIGINS];
  }

  const parsed = frontendUrl
    .split(',')
    .map((origin) => normalizeOrigin(origin))
    .filter((origin) => origin.length > 0);

  return parsed.length > 0 ? parsed : [...DEFAULT_ALLOWED_ORIGINS];
}

/**
 * Resolves a safe redirect origin against the configured allowlist to prevent Open Redirect attacks.
 * - If no Origin header is provided, falls back to the primary configured frontend origin.
 * - If an Origin header is provided, it must match one of the configured allowed origins.
 */
export function resolveAllowedOrigin(
  origin: string | undefined,
  allowedOrigins: readonly string[] = getAllowedOrigins(),
): string {
  const fallbackOrigin = allowedOrigins[0] ?? DEFAULT_ALLOWED_ORIGINS[0];
  const normalized = origin ? normalizeOrigin(origin) : '';

  if (!normalized) {
    return fallbackOrigin;
  }

  if (!allowedOrigins.includes(normalized)) {
    throw new BadRequestException('Origin is not allowed');
  }

  return normalized;
}
