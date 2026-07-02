import { ConflictException, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import { Role } from '../../generated/prisma/enums';
import { UsersService } from '../users/users.service';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  let service: AuthService;

  const user = {
    id: '00000000-0000-4000-8000-000000000001',
    email: 'jane@example.com',
    password: '',
    name: 'Jane',
    role: Role.USER,
    refreshToken: null as string | null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const usersService = {
    findByEmail: jest.fn(),
    findById: jest.fn(),
    create: jest.fn(),
    setRefreshToken: jest.fn(),
  };

  const jwtService = {
    signAsync: jest.fn().mockResolvedValue('signed-token'),
  };

  const configService = {
    getOrThrow: jest.fn().mockReturnValue('test-secret-at-least-16-chars'),
    get: jest.fn().mockReturnValue('15m'),
  };

  beforeAll(async () => {
    user.password = await bcrypt.hash('Str0ngP@ssword', 4);
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: usersService },
        { provide: JwtService, useValue: jwtService },
        { provide: ConfigService, useValue: configService },
      ],
    }).compile();

    service = module.get(AuthService);
  });

  describe('register', () => {
    it('throws ConflictException when the email is taken', async () => {
      usersService.findByEmail.mockResolvedValue(user);

      await expect(
        service.register({ email: user.email, password: 'Str0ngP@ssword' }),
      ).rejects.toThrow(ConflictException);
    });

    it('hashes the password and returns a token pair', async () => {
      usersService.findByEmail.mockResolvedValue(null);
      usersService.create.mockResolvedValue(user);
      usersService.setRefreshToken.mockResolvedValue(user);

      const tokens = await service.register({
        email: user.email,
        password: 'Str0ngP@ssword',
        name: 'Jane',
      });

      expect(tokens).toEqual({ accessToken: 'signed-token', refreshToken: 'signed-token' });
      const created = usersService.create.mock.calls[0][0];
      expect(created.password).not.toBe('Str0ngP@ssword');
      expect(await bcrypt.compare('Str0ngP@ssword', created.password)).toBe(true);
      expect(usersService.setRefreshToken).toHaveBeenCalledWith(user.id, expect.any(String));
    });
  });

  describe('login', () => {
    it('throws UnauthorizedException for an unknown email', async () => {
      usersService.findByEmail.mockResolvedValue(null);

      await expect(service.login({ email: 'nobody@example.com', password: 'x' })).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('throws UnauthorizedException for a wrong password', async () => {
      usersService.findByEmail.mockResolvedValue(user);

      await expect(service.login({ email: user.email, password: 'wrong' })).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('returns a token pair for valid credentials', async () => {
      usersService.findByEmail.mockResolvedValue(user);
      usersService.setRefreshToken.mockResolvedValue(user);

      const tokens = await service.login({ email: user.email, password: 'Str0ngP@ssword' });

      expect(tokens).toEqual({ accessToken: 'signed-token', refreshToken: 'signed-token' });
    });
  });

  describe('refreshTokens', () => {
    it('throws ForbiddenException when no refresh token is stored', async () => {
      usersService.findById.mockResolvedValue({ ...user, refreshToken: null });

      await expect(service.refreshTokens(user.id, 'anything')).rejects.toThrow(ForbiddenException);
    });

    it('throws ForbiddenException when the token does not match the stored hash', async () => {
      usersService.findById.mockResolvedValue({
        ...user,
        refreshToken: await bcrypt.hash('other-token', 4),
      });

      await expect(service.refreshTokens(user.id, 'stolen-token')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('rotates tokens when the refresh token matches', async () => {
      usersService.findById.mockResolvedValue({
        ...user,
        refreshToken: await bcrypt.hash('valid-refresh', 4),
      });
      usersService.setRefreshToken.mockResolvedValue(user);

      const tokens = await service.refreshTokens(user.id, 'valid-refresh');

      expect(tokens).toEqual({ accessToken: 'signed-token', refreshToken: 'signed-token' });
      expect(usersService.setRefreshToken).toHaveBeenCalled();
    });
  });

  describe('logout', () => {
    it('clears the stored refresh token', async () => {
      usersService.setRefreshToken.mockResolvedValue(user);

      await service.logout(user.id);

      expect(usersService.setRefreshToken).toHaveBeenCalledWith(user.id, null);
    });
  });
});
