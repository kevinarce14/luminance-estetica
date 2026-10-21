import { Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/** Exige un JWT válido. Los errores de la estrategia (404, 403) se propagan tal cual. */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  handleRequest<TUser>(
    err: unknown,
    user: TUser | false,
    info: unknown,
  ): TUser {
    if (err instanceof Error) {
      throw err;
    }
    if (!user) {
      const missingToken =
        info instanceof Error && info.message === 'No auth token';
      throw new UnauthorizedException(
        missingToken ? 'No autenticado' : 'Token inválido o expirado',
      );
    }
    return user;
  }
}
