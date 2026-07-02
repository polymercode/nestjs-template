import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Role } from '../../generated/prisma/enums';
import { PrismaService } from '../../prisma/prisma.service';
import { UsersService } from './users.service';

describe('UsersService', () => {
  let service: UsersService;

  const user = {
    id: '00000000-0000-4000-8000-000000000001',
    email: 'jane@example.com',
    password: 'hashed',
    name: 'Jane',
    role: Role.USER,
    refreshToken: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const prisma = {
    user: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  };

  const cache = {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: PrismaService, useValue: prisma },
        { provide: CACHE_MANAGER, useValue: cache },
      ],
    }).compile();

    service = module.get(UsersService);
  });

  it('creates a user', async () => {
    prisma.user.create.mockResolvedValue(user);

    await expect(service.create({ email: user.email, password: 'hashed' })).resolves.toEqual(user);
    expect(prisma.user.create).toHaveBeenCalledWith({
      data: { email: user.email, password: 'hashed' },
    });
  });

  it('finds a user by email', async () => {
    prisma.user.findUnique.mockResolvedValue(user);

    await expect(service.findByEmail(user.email)).resolves.toEqual(user);
    expect(prisma.user.findUnique).toHaveBeenCalledWith({ where: { email: user.email } });
  });

  describe('findByIdOrFail', () => {
    it('throws NotFoundException for a missing user', async () => {
      cache.get.mockResolvedValue(undefined);
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.findByIdOrFail('missing-id')).rejects.toThrow(NotFoundException);
    });

    it('returns and caches a user on a cache miss', async () => {
      cache.get.mockResolvedValue(undefined);
      prisma.user.findUnique.mockResolvedValue(user);

      await expect(service.findByIdOrFail(user.id)).resolves.toEqual(user);
      expect(cache.set).toHaveBeenCalledWith(`user:${user.id}`, user);
    });

    it('returns the cached user without hitting the database', async () => {
      cache.get.mockResolvedValue(user);

      await expect(service.findByIdOrFail(user.id)).resolves.toEqual(user);
      expect(prisma.user.findUnique).not.toHaveBeenCalled();
    });
  });

  it('stores a refresh token hash and invalidates the cache', async () => {
    prisma.user.update.mockResolvedValue(user);

    await service.setRefreshToken(user.id, 'hash');

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: user.id },
      data: { refreshToken: 'hash' },
    });
    expect(cache.del).toHaveBeenCalledWith(`user:${user.id}`);
  });

  it('updates a user and invalidates the cache', async () => {
    prisma.user.update.mockResolvedValue(user);

    await service.update(user.id, { name: 'New Name' });

    expect(cache.del).toHaveBeenCalledWith(`user:${user.id}`);
  });
});
