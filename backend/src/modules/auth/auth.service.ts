import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { MessageResponse } from '../../common/interfaces/message-response.interface';
import { Prisma, type User } from '../../generated/prisma/client';
import { MailService } from '../../mail/mail.service';
import { PasswordService } from '../users/password.service';
import { UsersService } from '../users/users.service';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { GoogleAuthService } from './google-auth.service';
import {
  PASSWORD_RESET_TOKEN_TYPE,
  type AuthToken,
  type GoogleAuthConfig,
  type JwtPayload,
} from './interfaces/auth.interfaces';

const PASSWORD_RESET_EXPIRES_IN_SECONDS = 60 * 60;
const PASSWORD_RESET_REQUESTED_MESSAGE =
  'Si el email existe, recibirás instrucciones para resetear tu contraseña';
const INVALID_RESET_TOKEN_MESSAGE =
  'El código es inválido o expiró. Solicitá uno nuevo.';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly passwords: PasswordService,
    private readonly jwtService: JwtService,
    private readonly googleAuth: GoogleAuthService,
    private readonly mail: MailService,
  ) {}

  async register(dto: RegisterDto): Promise<User> {
    if (await this.usersService.findByEmail(dto.email)) {
      throw new BadRequestException('El email ya está registrado');
    }
    let user: User;
    try {
      user = await this.usersService.create({
        email: dto.email,
        fullName: dto.full_name,
        phone: dto.phone,
        password: dto.password,
      });
    } catch (error) {
      // Dos registros simultáneos con el mismo email: lo frena el índice único.
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new BadRequestException('El email ya está registrado');
      }
      throw error;
    }
    // Los emails no bloquean la respuesta ni la hacen fallar (MailService nunca lanza).
    void this.mail.sendWelcome(user.email, user.fullName);
    return user;
  }

  async login(dto: LoginDto): Promise<AuthToken> {
    const user = await this.usersService.findByEmail(dto.username);

    // Cuentas creadas con Google: no tienen contraseña, se explica cómo ingresar.
    if (user && !user.hashedPassword) {
      throw new UnauthorizedException(
        'Esta cuenta usa inicio de sesión con Google',
      );
    }
    if (
      !user ||
      !(await this.passwords.verify(dto.password, user.hashedPassword))
    ) {
      throw new UnauthorizedException('Email o contraseña incorrectos');
    }
    if (!user.isActive) {
      throw new ForbiddenException('Usuario inactivo');
    }
    return this.issueAccessToken(user);
  }

  getGoogleConfig(): GoogleAuthConfig {
    const clientId = this.googleAuth.getClientId();
    return { enabled: clientId !== null, client_id: clientId };
  }

  /** Login o alta automática con Google (la cuenta queda sin contraseña). */
  async loginWithGoogle(credential: string): Promise<AuthToken> {
    const identity = await this.googleAuth.verify(credential);
    const email = identity.email.trim().toLowerCase();
    if (!email) {
      throw new BadRequestException('No se pudo obtener el email desde Google');
    }
    if (!identity.emailVerified) {
      throw new BadRequestException('El email de Google no está verificado');
    }

    let user = await this.usersService.findByEmail(email);
    if (!user) {
      user = await this.usersService.create({
        email,
        fullName: identity.name,
        password: null,
      });
      void this.mail.sendWelcome(user.email, user.fullName);
    } else if (!user.isActive) {
      throw new ForbiddenException('Tu cuenta está desactivada');
    }
    return this.issueAccessToken(user);
  }

  /**
   * Envía el link de recuperación. Responde siempre lo mismo para no revelar qué
   * emails existen (cuentas inexistentes, inactivas o solo de Google no reciben nada).
   */
  async requestPasswordReset(dto: ForgotPasswordDto): Promise<MessageResponse> {
    const user = await this.usersService.findByEmail(dto.email);
    if (user?.isActive && user.hashedPassword) {
      const token = await this.jwtService.signAsync(
        {
          sub: user.email,
          type: PASSWORD_RESET_TOKEN_TYPE,
          pwd: this.passwords.fingerprint(user.hashedPassword),
        } satisfies JwtPayload,
        { expiresIn: PASSWORD_RESET_EXPIRES_IN_SECONDS },
      );
      void this.mail.sendPasswordReset(user.email, user.fullName, token);
    }
    return { message: PASSWORD_RESET_REQUESTED_MESSAGE };
  }

  /** Cambia la contraseña con el token del email. De un solo uso: la huella deja de coincidir. */
  async confirmPasswordReset(dto: ResetPasswordDto): Promise<MessageResponse> {
    const payload = await this.verifyResetToken(dto.token);
    const user = payload
      ? await this.usersService.findByEmail(payload.sub)
      : null;
    if (
      !payload ||
      !user?.isActive ||
      !user.hashedPassword ||
      this.passwords.fingerprint(user.hashedPassword) !== payload.pwd
    ) {
      throw new BadRequestException(INVALID_RESET_TOKEN_MESSAGE);
    }

    await this.usersService.updatePassword(user.id, dto.new_password);
    this.logger.log(`Contraseña actualizada para ${user.email}`);
    void this.mail.sendPasswordChanged(user.email, user.fullName);
    return { message: 'Contraseña actualizada exitosamente' };
  }

  private async issueAccessToken(user: User): Promise<AuthToken> {
    const payload: JwtPayload = { sub: user.email };
    return {
      access_token: await this.jwtService.signAsync(payload),
      token_type: 'bearer',
    };
  }

  private async verifyResetToken(
    token: string,
  ): Promise<(JwtPayload & { pwd: string }) | null> {
    try {
      const payload = await this.jwtService.verifyAsync<JwtPayload>(token);
      if (
        payload.type !== PASSWORD_RESET_TOKEN_TYPE ||
        !payload.sub ||
        !payload.pwd
      ) {
        return null;
      }
      return { ...payload, pwd: payload.pwd };
    } catch {
      return null;
    }
  }
}
