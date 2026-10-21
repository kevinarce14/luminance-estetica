import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import type { AuthenticatedRequest } from '../decorators/current-user.decorator';

/** Restringe al rol administrador (`is_admin`). Va siempre después de JwtAuthGuard. */
@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const { user } = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!user?.isAdmin) {
      throw new ForbiddenException('No tienes permisos de administrador');
    }
    return true;
  }
}
