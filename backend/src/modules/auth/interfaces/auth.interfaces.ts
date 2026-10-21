/** Respuesta de login, Google y registro con token (schema Token de FastAPI). */
export interface AuthToken {
  access_token: string;
  token_type: 'bearer';
}

/** Respuesta de GET /api/auth/google/config. */
export interface GoogleAuthConfig {
  enabled: boolean;
  client_id: string | null;
}

export const PASSWORD_RESET_TOKEN_TYPE = 'password_reset';

/**
 * Payload de los JWT (mismo formato que python-jose en el legado): `sub` es el email.
 * Los tokens de recuperación agregan `type` y la huella `pwd` de la contraseña.
 */
export interface JwtPayload {
  sub: string;
  type?: typeof PASSWORD_RESET_TOKEN_TYPE;
  pwd?: string;
  exp?: number;
  iat?: number;
}

/** Datos verificados del id_token de Google. */
export interface GoogleIdentity {
  email: string;
  name: string;
  emailVerified: boolean;
}
