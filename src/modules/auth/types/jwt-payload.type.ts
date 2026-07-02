import { Role } from '../../../generated/prisma/enums';

export type JwtPayload = {
  /** User id */
  sub: string;
  email: string;
  role: Role;
};

export type JwtPayloadWithRefreshToken = JwtPayload & { refreshToken: string };
