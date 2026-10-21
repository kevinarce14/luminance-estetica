import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import type { User } from '../../../generated/prisma/client';
import { AdminGuard } from './admin.guard';

function contextWith(user?: Partial<User>): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  } as unknown as ExecutionContext;
}

describe('AdminGuard', () => {
  const guard = new AdminGuard();

  it('deja pasar a un administrador', () => {
    expect(guard.canActivate(contextWith({ isAdmin: true }))).toBe(true);
  });

  it('rechaza a un cliente con 403', () => {
    expect(() => guard.canActivate(contextWith({ isAdmin: false }))).toThrow(
      new ForbiddenException('No tienes permisos de administrador'),
    );
  });

  it('rechaza si no hay usuario autenticado', () => {
    expect(() => guard.canActivate(contextWith())).toThrow(ForbiddenException);
  });
});
