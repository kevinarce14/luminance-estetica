import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
} from '@nestjs/common';
import type { MessageResponse } from '../../common/interfaces/message-response.interface';
import {
  toUserResponse,
  type UserResponse,
} from '../users/interfaces/user-response.interface';
import { AuthService } from './auth.service';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { GoogleLoginDto } from './dto/google-login.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import type { AuthToken, GoogleAuthConfig } from './interfaces/auth.interfaces';

/** Rutas públicas de autenticación (mismo contrato que /api/auth de FastAPI). */
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  async register(@Body() body: RegisterDto): Promise<UserResponse> {
    return toUserResponse(await this.authService.register(body));
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body() body: LoginDto): Promise<AuthToken> {
    return this.authService.login(body);
  }

  @Get('google/config')
  getGoogleConfig(): GoogleAuthConfig {
    return this.authService.getGoogleConfig();
  }

  @Post('google')
  @HttpCode(HttpStatus.OK)
  loginWithGoogle(@Body() body: GoogleLoginDto): Promise<AuthToken> {
    return this.authService.loginWithGoogle(body.credential);
  }

  /** `password-reset` es la ruta que usa el frontend; `forgot-password` es un alias. */
  @Post(['password-reset', 'forgot-password'])
  @HttpCode(HttpStatus.OK)
  requestPasswordReset(
    @Body() body: ForgotPasswordDto,
  ): Promise<MessageResponse> {
    return this.authService.requestPasswordReset(body);
  }

  /** `password-reset/confirm` es la ruta que usa el frontend; `reset-password` es un alias. */
  @Post(['password-reset/confirm', 'reset-password'])
  @HttpCode(HttpStatus.OK)
  confirmPasswordReset(
    @Body() body: ResetPasswordDto,
  ): Promise<MessageResponse> {
    return this.authService.confirmPasswordReset(body);
  }
}
