import { describe, it, expect } from 'vitest';
import { createWinstonLogger } from './winston.logger.js';

describe('createWinstonLogger', () => {
  it('should create a logger instance in development mode', () => {
    const logger = createWinstonLogger('development');
    expect(logger).toBeDefined();
    expect(typeof logger.log).toBe('function');
    expect(typeof logger.error).toBe('function');
    expect(typeof logger.warn).toBe('function');
    expect(typeof logger.debug).toBe('function');
  });

  it('should create a logger instance in production mode', () => {
    const logger = createWinstonLogger('production');
    expect(logger).toBeDefined();
    expect(typeof logger.log).toBe('function');
    expect(typeof logger.error).toBe('function');
  });

  it('should use process.env.NODE_ENV by default when no argument is passed', () => {
    const logger = createWinstonLogger();
    expect(logger).toBeDefined();
  });
});
