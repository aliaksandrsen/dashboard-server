import { vi, describe, beforeEach, it, expect } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { UsersService } from './users.service.js';
import { PrismaService } from '../utils/prisma.service.js';
import { Prisma, User } from '../../generated/prisma/client.js';

describe('UsersService', () => {
  let service: UsersService;

  const mockPrisma = {
    user: {
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  };

  const sampleUser: User = {
    id: 1,
    email: 'john@example.com',
    name: 'John Doe',
    address: '123 Main St',
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create and return a new user', async () => {
      mockPrisma.user.create.mockResolvedValueOnce(sampleUser);

      const dto = {
        email: 'john@example.com',
        name: 'John Doe',
        address: '123 Main St',
      };
      const result = await service.create(dto);

      expect(mockPrisma.user.create).toHaveBeenCalledWith({
        data: dto,
      });
      expect(result).toEqual(sampleUser);
    });

    it('should throw BadRequestException when email already exists (P2002)', async () => {
      const p2002Error = new Prisma.PrismaClientKnownRequestError(
        'Unique constraint failed',
        {
          code: 'P2002',
          clientVersion: '7.10.1',
        },
      );
      mockPrisma.user.create.mockRejectedValueOnce(p2002Error);

      await expect(
        service.create({
          email: 'duplicate@example.com',
          name: 'Duplicate',
          address: '123 St',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw InternalServerErrorException on unexpected error', async () => {
      mockPrisma.user.create.mockRejectedValueOnce(new Error('DB failure'));

      await expect(
        service.create({
          email: 'test@example.com',
          name: 'Test',
          address: '123 St',
        }),
      ).rejects.toThrow(InternalServerErrorException);
    });
  });

  describe('findAll', () => {
    it('should return all users without query', async () => {
      mockPrisma.user.findMany.mockResolvedValueOnce([sampleUser] as never);

      const result = await service.findAll();

      expect(mockPrisma.user.findMany).toHaveBeenCalledWith({
        skip: undefined,
        take: undefined,
        where: undefined,
        include: { orders: true },
        orderBy: { id: 'asc' },
      });
      expect(result).toEqual([sampleUser]);
    });

    it('should query users with pagination and search filter', async () => {
      mockPrisma.user.findMany.mockResolvedValueOnce([sampleUser] as never);

      const query = { skip: 10, take: 5, search: 'john' };
      const result = await service.findAll(query);

      expect(mockPrisma.user.findMany).toHaveBeenCalledWith({
        skip: 10,
        take: 5,
        where: {
          OR: [
            { name: { contains: 'john', mode: 'insensitive' } },
            { email: { contains: 'john', mode: 'insensitive' } },
          ],
        },
        include: { orders: true },
        orderBy: { id: 'asc' },
      });
      expect(result).toEqual([sampleUser]);
    });
  });

  describe('findOne', () => {
    it('should return a user if found', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce(sampleUser);

      const result = await service.findOne(1);

      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: 1 },
        include: {
          orders: {
            include: {
              products: true,
            },
          },
        },
      });
      expect(result).toEqual(sampleUser);
    });

    it('should throw NotFoundException if user not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce(null);

      await expect(service.findOne(999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('should update and return the user', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce(sampleUser);
      const updatedUser = { ...sampleUser, name: 'Updated Name' };
      mockPrisma.user.update.mockResolvedValueOnce(updatedUser);

      const result = await service.update(1, { name: 'Updated Name' });

      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: {
          email: undefined,
          name: 'Updated Name',
          address: undefined,
        },
      });
      expect(result).toEqual(updatedUser);
    });

    it('should throw NotFoundException if updating non-existent user', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce(null);

      await expect(service.update(999, { name: 'New' })).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException if update violates unique email', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce(sampleUser);
      const p2002Error = new Prisma.PrismaClientKnownRequestError(
        'Unique constraint failed',
        {
          code: 'P2002',
          clientVersion: '7.10.1',
        },
      );
      mockPrisma.user.update.mockRejectedValueOnce(p2002Error);

      await expect(
        service.update(1, { email: 'already-used@example.com' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw InternalServerErrorException on update error', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce(sampleUser);
      mockPrisma.user.update.mockRejectedValueOnce(new Error('fail'));

      await expect(service.update(1, { name: 'Fail' })).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  describe('remove', () => {
    it('should delete and return the user', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce(sampleUser);
      mockPrisma.user.delete.mockResolvedValueOnce(sampleUser);

      const result = await service.remove(1);

      expect(mockPrisma.user.delete).toHaveBeenCalledWith({ where: { id: 1 } });
      expect(result).toEqual(sampleUser);
    });

    it('should throw NotFoundException if removing non-existent user', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce(null);

      await expect(service.remove(999)).rejects.toThrow(NotFoundException);
    });

    it('should throw InternalServerErrorException on deletion failure', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce(sampleUser);
      mockPrisma.user.delete.mockRejectedValueOnce(new Error('fail'));

      await expect(service.remove(1)).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });
});
