import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../utils/prisma.service.js';
import { CreateUserDto, UpdateUserDto, UserQueryDto } from './users.interface.js';
import type { User } from '../../generated/prisma/client.js';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create a new user
   */
  async create(createUserDto: CreateUserDto): Promise<User> {
    const { email, name, address } = createUserDto;
    this.logger.log(`Creating new user with email: ${email}`);

    const user = await this.prisma.user.create({
      data: {
        email,
        name,
        address,
      },
    });

    this.logger.log(`User #${user.id} created successfully`);
    return user;
  }

  /**
   * Find all users with optional pagination, search by name or email, and include orders
   */
  async findAll(query?: UserQueryDto): Promise<User[]> {
    const { skip, take, search } = query ?? {};
    this.logger.log('Fetching users list');

    return await this.prisma.user.findMany({
      skip,
      take,
      where: search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { email: { contains: search, mode: 'insensitive' } },
            ],
          }
        : undefined,
      include: {
        orders: true,
      },
      orderBy: { id: 'asc' },
    });
  }

  /**
   * Find a single user by ID with related orders and products
   */
  async findOne(id: number): Promise<User> {
    this.logger.log(`Fetching user with id ${id}`);

    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        orders: {
          include: {
            products: true,
          },
        },
      },
    });

    if (!user) {
      this.logger.warn(`User #${id} not found`);
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    return user;
  }

  /**
   * Update an existing user (PATCH)
   */
  async update(id: number, updateUserDto: UpdateUserDto): Promise<User> {
    this.logger.log(`Updating user #${id}`);

    const { email, name, address } = updateUserDto;

    const updatedUser = await this.prisma.user.update({
      where: { id },
      data: {
        email,
        name,
        address,
      },
    });

    this.logger.log(`User #${id} updated successfully`);
    return updatedUser;
  }

  /**
   * Delete a user by ID
   */
  async remove(id: number): Promise<User> {
    this.logger.log(`Deleting user #${id}`);

    const deletedUser = await this.prisma.user.delete({
      where: { id },
    });

    this.logger.log(`User #${id} deleted successfully`);
    return deletedUser;
  }
}
