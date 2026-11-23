import { vi, describe, beforeEach, afterEach, it, expect, type Mock } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { BadGatewayException, BadRequestException } from '@nestjs/common';
import Stripe from 'stripe';
import { StripeService } from './stripe.service.js';

describe('StripeService', () => {
  let service: StripeService;
  const originalNodeEnv = process.env.NODE_ENV;
  const originalStripeKey = process.env.STRIPE_SECRET_KEY;
  const originalFrontendUrl = process.env.FRONTEND_URL;

  beforeEach(async () => {
    vi.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [StripeService],
    }).compile();

    service = module.get<StripeService>(StripeService);
  });

  afterEach(() => {
    if (originalNodeEnv === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = originalNodeEnv;
    }

    if (originalStripeKey === undefined) {
      delete process.env.STRIPE_SECRET_KEY;
    } else {
      process.env.STRIPE_SECRET_KEY = originalStripeKey;
    }

    if (originalFrontendUrl === undefined) {
      delete process.env.FRONTEND_URL;
    } else {
      process.env.FRONTEND_URL = originalFrontendUrl;
    }
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should fail fast in production when STRIPE_SECRET_KEY is missing', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.STRIPE_SECRET_KEY;

    expect(() => new StripeService()).toThrow(
      'STRIPE_SECRET_KEY environment variable is required in production',
    );
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
    it('should create a checkout session and return sessionId and url', async () => {
      const mockSession = {
        id: 'cs_test_123',
        url: 'https://checkout.stripe.com/pay/cs_test123',
      };
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

      const result = await service.createPayment({
        payment: { priceId: 'price_123', quantity: 2 },
        origin: 'http://localhost:5173',
      });

      expect(sessionsCreateSpy).toHaveBeenCalledWith({
        line_items: [
          {
            price: 'price_123',
            quantity: 2,
          },
        ],
        mode: 'payment',
        success_url: 'http://localhost:5173/?success=true',
        cancel_url: 'http://localhost:5173/?canceled=true',
      });
      expect(result).toEqual({
        sessionId: 'cs_test_123',
        url: 'https://checkout.stripe.com/pay/cs_test123',
      });
    });

    it('should fallback to localhost:5173 when origin is empty', async () => {
      const sessionsCreateSpy = vi
        .spyOn(
          (
            service as unknown as {
              stripe: { checkout: { sessions: { create: Mock } } };
            }
          ).stripe.checkout.sessions,
          'create',
        )
        .mockResolvedValueOnce({
          id: 'cs_fallback',
          url: 'https://checkout.stripe.com/pay/cs_fallback',
        });

      await service.createPayment({
        payment: { priceId: 'price_123', quantity: 1 },
        origin: '',
      });

      expect(sessionsCreateSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          success_url: expect.stringMatching(/\/\?success=true$/),
          cancel_url: expect.stringMatching(/\/\?canceled=true$/),
        }),
      );
    });

    it('should throw BadRequestException when origin is not in allowlist', async () => {
      process.env.FRONTEND_URL = 'https://app.example.com';

      const sessionsCreateSpy = vi.spyOn(
        (
          service as unknown as {
            stripe: { checkout: { sessions: { create: Mock } } };
          }
        ).stripe.checkout.sessions,
        'create',
      );

      await expect(
        service.createPayment({
          payment: { priceId: 'price_123', quantity: 1 },
          origin: 'https://evil.example',
        }),
      ).rejects.toThrow(BadRequestException);

      expect(sessionsCreateSpy).not.toHaveBeenCalled();
    });

    it('should throw BadGatewayException if session.url is missing', async () => {
      vi.spyOn(
        (
          service as unknown as {
            stripe: { checkout: { sessions: { create: Mock } } };
          }
        ).stripe.checkout.sessions,
        'create',
      ).mockResolvedValueOnce({ id: 'cs_missing', url: null });

      await expect(
        service.createPayment({
          payment: { priceId: 'price_123', quantity: 1 },
          origin: 'http://localhost:5173',
        }),
      ).rejects.toThrow(BadGatewayException);
    });

    it('should throw BadRequestException when Stripe returns StripeInvalidRequestError', async () => {
      const invalidRequestError = new Stripe.errors.StripeInvalidRequestError({
        type: 'invalid_request_error',
        message: 'No such price: price_bad',
      });

      vi.spyOn(
        (
          service as unknown as {
            stripe: { checkout: { sessions: { create: Mock } } };
          }
        ).stripe.checkout.sessions,
        'create',
      ).mockRejectedValueOnce(invalidRequestError);

      await expect(
        service.createPayment({
          payment: { priceId: 'price_bad', quantity: 1 },
          origin: 'http://localhost:5173',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadGatewayException on unexpected upstream Stripe errors', async () => {
      vi.spyOn(
        (
          service as unknown as {
            stripe: { checkout: { sessions: { create: Mock } } };
          }
        ).stripe.checkout.sessions,
        'create',
      ).mockRejectedValueOnce(new Error('Upstream timeout'));

      await expect(
        service.createPayment({
          payment: { priceId: 'price_123', quantity: 1 },
          origin: 'http://localhost:5173',
        }),
      ).rejects.toThrow(BadGatewayException);
    });
  });

  describe('listInvoices', () => {
    it('should paginate through all Stripe invoice pages using starting_after', async () => {
      const invoicesListSpy = vi
        .spyOn(
          (
            service as unknown as {
              stripe: { invoices: { list: Mock } };
            }
          ).stripe.invoices,
          'list',
        )
        .mockResolvedValueOnce({
          data: [{ id: 'in_1' }, { id: 'in_2' }],
          has_more: true,
        })
        .mockResolvedValueOnce({
          data: [{ id: 'in_3' }],
          has_more: false,
        });

      const result = await service.listInvoices({
        status: 'paid',
        created: { gte: 1700000000 },
      });

      expect(invoicesListSpy).toHaveBeenNthCalledWith(1, {
        limit: 100,
        status: 'paid',
        created: { gte: 1700000000 },
      });
      expect(invoicesListSpy).toHaveBeenNthCalledWith(2, {
        limit: 100,
        status: 'paid',
        created: { gte: 1700000000 },
        starting_after: 'in_2',
      });
      expect(result).toEqual([{ id: 'in_1' }, { id: 'in_2' }, { id: 'in_3' }]);
    });

    it('should propagate errors from stripe.invoices.list', async () => {
      vi.spyOn(
        (
          service as unknown as {
            stripe: { invoices: { list: Mock } };
          }
        ).stripe.invoices,
        'list',
      ).mockRejectedValueOnce(new Error('Stripe API unreachable'));

      await expect(service.listInvoices({ status: 'paid' })).rejects.toThrow(
        'Stripe API unreachable',
      );
    });
  });
});
