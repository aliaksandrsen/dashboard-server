import { vi, describe, beforeEach, it, expect, type Mock } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import type { Response } from 'express';
import { StripeService } from './stripe.service.js';

describe('StripeService', () => {
  let service: StripeService;

  beforeEach(async () => {
    vi.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [StripeService],
    }).compile();

    service = module.get<StripeService>(StripeService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createProduct', () => {
    it('should create product and price in Stripe and return IDs', async () => {
      const mockProduct = { id: 'prod_test_123', name: 'Coffee Mug' };
      const mockPrice = { id: 'price_test_456', unit_amount: 1999 };

      const stripeProductsCreateSpy = vi
        .spyOn(
          (
            service as unknown as {
              stripe: { products: { create: Mock } };
            }
          ).stripe.products,
          'create',
        )
        .mockResolvedValueOnce(mockProduct);

      const stripePricesCreateSpy = vi
        .spyOn(
          (service as unknown as { stripe: { prices: { create: Mock } } }).stripe.prices,
          'create',
        )
        .mockResolvedValueOnce(mockPrice);

      const result = await service.createProduct({
        name: 'Coffee Mug',
        price: 19.99,
        description: 'Ceramic coffee mug',
      });

      expect(stripeProductsCreateSpy).toHaveBeenCalledWith({
        name: 'Coffee Mug',
        description: 'Ceramic coffee mug',
      });
      expect(stripePricesCreateSpy).toHaveBeenCalledWith({
        product: 'prod_test_123',
        unit_amount: 1999,
        currency: 'usd',
      });
      expect(result).toEqual({
        stripeProductId: 'prod_test_123',
        stripePriceId: 'price_test_456',
      });
    });

    it('should throw InternalServerErrorException when Stripe fails', async () => {
      vi.spyOn(
        (
          service as unknown as {
            stripe: { products: { create: Mock } };
          }
        ).stripe.products,
        'create',
      ).mockRejectedValueOnce(new Error('Stripe API network error'));

      await expect(
        service.createProduct({
          name: 'Fail Product',
          price: 10,
        }),
      ).rejects.toThrow('Stripe service error: Stripe API network error');
    });
  });

  describe('deactivateProduct', () => {
    it('should update product active status to false', async () => {
      const stripeProductsUpdateSpy = vi
        .spyOn(
          (
            service as unknown as {
              stripe: { products: { update: Mock } };
            }
          ).stripe.products,
          'update',
        )
        .mockResolvedValueOnce({ id: 'prod_123', active: false });

      await service.deactivateProduct('prod_123');

      expect(stripeProductsUpdateSpy).toHaveBeenCalledWith('prod_123', {
        active: false,
      });
    });

    it('should catch and log error if deactivation fails without throwing', async () => {
      vi.spyOn(
        (
          service as unknown as {
            stripe: { products: { update: Mock } };
          }
        ).stripe.products,
        'update',
      ).mockRejectedValueOnce(new Error('Update failed'));

      await expect(service.deactivateProduct('prod_123')).resolves.toBeUndefined();
    });
  });

  describe('createPayment', () => {
    it('should create a checkout session and redirect to session.url', async () => {
      const mockSession = { url: 'https://checkout.stripe.com/pay/cs_test123' };
      const sessionsCreateSpy = vi
        .spyOn(
          (
            service as unknown as {
              stripe: { checkout: { sessions: { create: Mock } } };
            }
          ).stripe.checkout.sessions,
          'create',
        )
        .mockResolvedValueOnce(mockSession);

      const statusFn = vi.fn().mockReturnThis();
      const redirectFn = vi.fn();
      const mockRes = {
        status: statusFn,
        redirect: redirectFn,
      } as unknown as Response;

      await service.createPayment({
        payment: { priceId: 'price_123', quantity: 2 },
        origin: 'http://localhost:3000',
        res: mockRes,
      });

      expect(sessionsCreateSpy).toHaveBeenCalledWith({
        line_items: [
          {
            price: 'price_123',
            quantity: 2,
          },
        ],
        mode: 'payment',
        success_url: 'http://localhost:3000/?success=true',
        cancel_url: 'http://localhost:3000/?canceled=true',
      });
      expect(statusFn).toHaveBeenCalledWith(303);
      expect(redirectFn).toHaveBeenCalledWith('https://checkout.stripe.com/pay/cs_test123');
    });

    it('should throw an error if session.url is missing', async () => {
      vi.spyOn(
        (
          service as unknown as {
            stripe: { checkout: { sessions: { create: Mock } } };
          }
        ).stripe.checkout.sessions,
        'create',
      ).mockResolvedValueOnce({ url: null });

      const mockRes = {
        status: vi.fn().mockReturnThis(),
        redirect: vi.fn(),
      } as unknown as Response;

      await expect(
        service.createPayment({
          payment: { priceId: 'price_123', quantity: 1 },
          origin: 'http://localhost:3000',
          res: mockRes,
        }),
      ).rejects.toThrow('Failed to retrieve Stripe session URL');
    });
  });
});
