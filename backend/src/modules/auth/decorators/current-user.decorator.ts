import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import type { User } from '../../../generated/prisma/client';

export interface AuthenticatedRequest extends Request {
  user?: User;
}

/** Usuario autenticado que JwtStrategy dejó en `request.user`. Usar junto a @Authenticated(). */
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): User => {
    const { user } = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!user) {
      throw new Error(
        '@CurrentUser() requiere @Authenticated() o @AdminOnly()',
      );
    }
    return user;
  },
);
