import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { EnvironmentVariables } from '../../../config/env.validation';
import type { User } from '../../../generated/prisma/client';
import { UsersService } from '../../users/users.service';
import {
  PASSWORD_RESET_TOKEN_TYPE,
  type JwtPayload,
} from '../interfaces/auth.interfaces';

/**
 * Valida el `Authorization: Bearer <jwt>` y carga el usuario en `request.user`.
 * Mismas reglas que get_current_user del legado.
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    config: ConfigService<EnvironmentVariables, true>,
    private readonly usersService: UsersService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: config.get('SECRET_KEY', { infer: true }),
      algorithms: ['HS256'],
      ignoreExpiration: false,
    });
  }

  async validate(payload: JwtPayload): Promise<User> {
    // Los tokens de recuperación (viajan por email) no son sesiones.
    if (payload.type === PASSWORD_RESET_TOKEN_TYPE || !payload.sub) {
      throw new UnauthorizedException('No se pudo validar las credenciales');
    }
    const user = await this.usersService.findByEmail(payload.sub);
    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }
    if (!user.isActive) {
      throw new ForbiddenException('Usuario inactivo');
    }
    return user;
  }
}
