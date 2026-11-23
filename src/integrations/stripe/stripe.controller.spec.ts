import { vi, describe, beforeEach, it, expect } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { BadGatewayException, BadRequestException } from '@nestjs/common';
import { StripeController } from './stripe.controller.js';
import { StripeService } from './stripe.service.js';

describe('StripeController', () => {
  let controller: StripeController;

  const mockStripeService = {
    createPayment: vi.fn(),
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [StripeController],
      providers: [
        {
          provide: StripeService,
          useValue: mockStripeService,
        },
      ],
    }).compile();

    controller = module.get<StripeController>(StripeController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should successfully create a payment session and return session details', async () => {
    const session = {
      sessionId: 'cs_test_123',
      url: 'https://checkout.stripe.com/pay/cs_test_123',
    };
    mockStripeService.createPayment.mockResolvedValueOnce(session);

    const result = await controller.createPayment(
      { priceId: 'price_123', quantity: 1 },
      'http://localhost:5173',
    );

    expect(mockStripeService.createPayment).toHaveBeenCalledWith({
      payment: { priceId: 'price_123', quantity: 1 },
      origin: 'http://localhost:5173',
    });
    expect(result).toEqual(session);
  });

  it('should fallback to empty origin string if origin header is undefined', async () => {
    mockStripeService.createPayment.mockResolvedValueOnce({
      sessionId: 'cs_test_456',
      url: 'https://checkout.stripe.com/pay/cs_test_456',
    });

    await controller.createPayment({ priceId: 'price_123', quantity: 1 }, undefined);

    expect(mockStripeService.createPayment).toHaveBeenCalledWith({
      payment: { priceId: 'price_123', quantity: 1 },
      origin: '',
    });
  });

  it('should propagate BadRequestException from StripeService without altering status', async () => {
    mockStripeService.createPayment.mockRejectedValueOnce(
      new BadRequestException('Invalid priceId'),
    );

    await expect(
      controller.createPayment({ priceId: 'price_123', quantity: 1 }, 'http://localhost:5173'),
    ).rejects.toThrow(BadRequestException);
  });

  it('should propagate BadGatewayException from StripeService without rewriting to 400', async () => {
    mockStripeService.createPayment.mockRejectedValueOnce(
      new BadGatewayException('Failed to create Stripe payment session'),
    );

    await expect(
      controller.createPayment({ priceId: 'price_123', quantity: 1 }, 'http://localhost:5173'),
    ).rejects.toThrow(BadGatewayException);
  });
});
