import { vi, describe, beforeEach, it, expect } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { HttpException, HttpStatus } from '@nestjs/common';
import type { Response } from 'express';
import { StripeController } from './stripe.controller.js';
import { StripeService } from './stripe.service.js';

describe('StripeController', () => {
  let controller: StripeController;

  const mockStripeService = {
    createPayment: vi.fn(),
  };

  const mockResponse = {
    status: vi.fn().mockReturnThis(),
    redirect: vi.fn(),
  } as unknown as Response;

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

  it('should successfully create a payment session', async () => {
    mockStripeService.createPayment.mockResolvedValueOnce(undefined);

    await controller.createPayment(
      { priceId: 'price_123', quantity: 1 },
      'http://localhost:3000',
      mockResponse,
    );

    expect(mockStripeService.createPayment).toHaveBeenCalledWith({
      payment: { priceId: 'price_123', quantity: 1 },
      res: mockResponse,
      origin: 'http://localhost:3000',
    });
  });

  it('should fallback to empty origin string if origin header is undefined', async () => {
    mockStripeService.createPayment.mockResolvedValueOnce(undefined);

    await controller.createPayment({ priceId: 'price_123', quantity: 1 }, undefined, mockResponse);

    expect(mockStripeService.createPayment).toHaveBeenCalledWith({
      payment: { priceId: 'price_123', quantity: 1 },
      res: mockResponse,
      origin: '',
    });
  });

  it('should throw HttpException when service throws an error', async () => {
    mockStripeService.createPayment.mockRejectedValueOnce(new Error('Stripe error'));

    await expect(
      controller.createPayment(
        { priceId: 'price_123', quantity: 1 },
        'http://localhost:3000',
        mockResponse,
      ),
    ).rejects.toThrow(
      new HttpException('An error occurred while creating the payment', HttpStatus.BAD_REQUEST),
    );
  });
});
