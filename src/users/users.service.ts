import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../utils/prisma.service.js';
import {
  CreateUserDto,
  UpdateUserDto,
  UserQueryDto,
} from './users.interface.js';
import { User, Prisma } from '../../generated/prisma/client.js';

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

    try {
      const user = await this.prisma.user.create({
        data: {
          email,
          name,
          address,
        },
      });

      this.logger.log(`User #${user.id} created successfully`);
      return user;
    } catch (err: unknown) {
      this.logger.error('Failed to create user', err);
      if (err instanceof Prisma.PrismaClientKnownRequestError) {
        if (err.code === 'P2002') {
          throw new BadRequestException(
            'A user with this email already exists.',
          );
        }
      }
      throw new InternalServerErrorException('Failed to create user');
    }
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

    // Verify user exists first
    await this.findOne(id);

    const { email, name, address } = updateUserDto;

    try {
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
    } catch (err: unknown) {
      this.logger.error(`Failed to update user #${id}`, err);
      if (err instanceof Prisma.PrismaClientKnownRequestError) {
        if (err.code === 'P2002') {
          throw new BadRequestException(
            'A user with this email already exists.',
          );
        }
      }
      throw new InternalServerErrorException('Failed to update user');
    }
  }

  /**
   * Delete a user by ID
   */
  async remove(id: number): Promise<User> {
    this.logger.log(`Deleting user #${id}`);

    // Verify user exists first
    await this.findOne(id);

    try {
      const deletedUser = await this.prisma.user.delete({
        where: { id },
      });

      this.logger.log(`User #${id} deleted successfully`);
      return deletedUser;
    } catch (err: unknown) {
      this.logger.error(`Failed to delete user #${id}`, err);
      throw new InternalServerErrorException('Failed to delete user');
    }
  }
}
