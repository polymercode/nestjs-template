import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { Cache } from 'cache-manager';
import { Prisma, User } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

const userCacheKey = (id: string) => `user:${id}`;

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
  ) {}

  create(data: Prisma.UserCreateInput): Promise<User> {
    return this.prisma.user.create({ data });
  }

  findAll(): Promise<User[]> {
    return this.prisma.user.findMany({ orderBy: { createdAt: 'desc' } });
  }

  findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { email } });
  }

  findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { id } });
  }

  /** Cache-aside lookup: served from Redis on repeat calls, invalidated on any write. */
  async findByIdOrFail(id: string): Promise<User> {
    const cached = await this.cache.get<User>(userCacheKey(id));
    if (cached) {
      return cached;
    }

    const user = await this.findById(id);
    if (!user) {
      throw new NotFoundException(`User ${id} not found`);
    }

    await this.cache.set(userCacheKey(id), user);
    return user;
  }

  async update(id: string, data: Prisma.UserUpdateInput): Promise<User> {
    const user = await this.prisma.user.update({ where: { id }, data });
    await this.cache.del(userCacheKey(id));
    return user;
  }

  async setRefreshToken(id: string, refreshTokenHash: string | null): Promise<User> {
    const user = await this.prisma.user.update({
      where: { id },
      data: { refreshToken: refreshTokenHash },
    });
    await this.cache.del(userCacheKey(id));
    return user;
  }
}
