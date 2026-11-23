import { describe, it, expect, afterEach } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import {
  DEFAULT_ALLOWED_ORIGINS,
  getAllowedOrigins,
  normalizeOrigin,
  resolveAllowedOrigin,
} from './origin.util.js';

describe('origin.util', () => {
  const originalFrontendUrl = process.env.FRONTEND_URL;

  afterEach(() => {
    if (originalFrontendUrl === undefined) {
      delete process.env.FRONTEND_URL;
    } else {
      process.env.FRONTEND_URL = originalFrontendUrl;
    }
  });

  describe('normalizeOrigin', () => {
    it('trims whitespace and removes trailing slashes', () => {
      expect(normalizeOrigin('  https://app.example.com///  ')).toBe('https://app.example.com');
    });
  });

  describe('getAllowedOrigins', () => {
    it('returns default allowed origins when FRONTEND_URL is not set', () => {
      expect(getAllowedOrigins(undefined)).toEqual([...DEFAULT_ALLOWED_ORIGINS]);
      expect(getAllowedOrigins('   ')).toEqual([...DEFAULT_ALLOWED_ORIGINS]);
    });

    it('parses and normalizes comma-separated origins', () => {
      expect(
        getAllowedOrigins(' https://app.example.com/ , https://admin.example.com/// , '),
      ).toEqual(['https://app.example.com', 'https://admin.example.com']);
    });
  });

  describe('resolveAllowedOrigin', () => {
    const allowlist = ['https://app.example.com', 'https://admin.example.com'];

    it('falls back to primary configured origin when header is missing or empty', () => {
      expect(resolveAllowedOrigin(undefined, allowlist)).toBe('https://app.example.com');
      expect(resolveAllowedOrigin('', allowlist)).toBe('https://app.example.com');
      expect(resolveAllowedOrigin('   ', allowlist)).toBe('https://app.example.com');
    });

    it('returns normalized origin when present in allowlist', () => {
      expect(resolveAllowedOrigin('https://admin.example.com/', allowlist)).toBe(
        'https://admin.example.com',
      );
    });

    it('throws BadRequestException for untrusted origins to prevent open redirects', () => {
      expect(() => resolveAllowedOrigin('https://evil.example', allowlist)).toThrow(
        BadRequestException,
      );
      expect(() => resolveAllowedOrigin('https://app.example.com.evil.com', allowlist)).toThrow(
        BadRequestException,
      );
    });
  });
});
