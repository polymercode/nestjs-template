import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { JwtPayload } from '../../modules/auth/types/jwt-payload.type';

/**
 * Injects the authenticated user's JWT payload (or a single field of it)
 * into a controller parameter: `@CurrentUser() user` or `@CurrentUser('sub') id`.
 */
export const CurrentUser = createParamDecorator(
  (field: keyof JwtPayload | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<{ user: JwtPayload }>();
    return field ? request.user?.[field] : request.user;
  },
);
