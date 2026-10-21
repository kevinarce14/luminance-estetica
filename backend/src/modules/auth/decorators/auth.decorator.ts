import { applyDecorators, UseGuards } from '@nestjs/common';
import { AdminGuard } from '../guards/admin.guard';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';

/** Ruta para cualquier usuario autenticado (401 sin token válido). */
export function Authenticated(): MethodDecorator & ClassDecorator {
  return applyDecorators(UseGuards(JwtAuthGuard));
}

/** Ruta solo para administradores (401 sin token, 403 si no es admin). */
export function AdminOnly(): MethodDecorator & ClassDecorator {
  return applyDecorators(UseGuards(JwtAuthGuard, AdminGuard));
}
