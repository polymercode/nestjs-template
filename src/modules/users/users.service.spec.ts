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

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [UsersService, { provide: PrismaService, useValue: prisma }],
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

  it('findByIdOrFail throws NotFoundException for a missing user', async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    await expect(service.findByIdOrFail('missing-id')).rejects.toThrow(NotFoundException);
  });

  it('stores a refresh token hash', async () => {
    prisma.user.update.mockResolvedValue(user);

    await service.setRefreshToken(user.id, 'hash');

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: user.id },
      data: { refreshToken: 'hash' },
    });
  });
});
