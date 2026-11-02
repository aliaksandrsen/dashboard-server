import { vi, describe, beforeEach, it, expect } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { UsersController } from './users.controller.js';
import { UsersService } from './users.service.js';
import { User } from '../../generated/prisma/client.js';

describe('UsersController', () => {
  let controller: UsersController;

  const mockUsersService = {
    create: vi.fn(),
    findAll: vi.fn(),
    findOne: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
  };

  const sampleUser: User = {
    id: 1,
    email: 'test@example.com',
    name: 'Test User',
    address: 'Sample Address',
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        {
          provide: UsersService,
          useValue: mockUsersService,
        },
      ],
    }).compile();

    controller = module.get<UsersController>(UsersController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should create a user', async () => {
    mockUsersService.create.mockResolvedValueOnce(sampleUser);
    const dto = {
      email: 'test@example.com',
      name: 'Test User',
      address: 'Sample Address',
    };

    const result = await controller.create(dto);

    expect(mockUsersService.create).toHaveBeenCalledWith(dto);
    expect(result).toEqual(sampleUser);
  });

  it('should findAll users', async () => {
    mockUsersService.findAll.mockResolvedValueOnce([sampleUser]);
    const query = { skip: 0, take: 10 };

    const result = await controller.findAll(query);

    expect(mockUsersService.findAll).toHaveBeenCalledWith(query);
    expect(result).toEqual([sampleUser]);
  });

  it('should findOne user', async () => {
    mockUsersService.findOne.mockResolvedValueOnce(sampleUser);

    const result = await controller.findOne(1);

    expect(mockUsersService.findOne).toHaveBeenCalledWith(1);
    expect(result).toEqual(sampleUser);
  });

  it('should update a user', async () => {
    const updated = { ...sampleUser, name: 'New Name' };
    mockUsersService.update.mockResolvedValueOnce(updated);

    const result = await controller.update(1, { name: 'New Name' });

    expect(mockUsersService.update).toHaveBeenCalledWith(1, {
      name: 'New Name',
    });
    expect(result).toEqual(updated);
  });

  it('should remove a user', async () => {
    mockUsersService.remove.mockResolvedValueOnce(sampleUser);

    const result = await controller.remove(1);

    expect(mockUsersService.remove).toHaveBeenCalledWith(1);
    expect(result).toEqual(sampleUser);
  });
});
