import { Injectable } from '@nestjs/common';
import { compare, hash } from 'bcryptjs';
import { createHash } from 'node:crypto';

/** Costo de bcrypt: el mismo que usa passlib en el backend FastAPI. */
const BCRYPT_ROUNDS = 12;

/**
 * Hashing de contraseñas con bcrypt. Los hashes son compatibles con los de passlib
 * ($2b$), así que los usuarios creados en FastAPI siguen pudiendo iniciar sesión.
 */
@Injectable()
export class PasswordService {
  hash(plainPassword: string): Promise<string> {
    return hash(plainPassword, BCRYPT_ROUNDS);
  }

  /** Las cuentas creadas con Google no tienen contraseña (hash vacío): nunca verifican. */
  async verify(plainPassword: string, passwordHash: string): Promise<boolean> {
    if (!passwordHash) {
      return false;
    }
    return compare(plainPassword, passwordHash);
  }

  /**
   * Huella corta del hash actual. Va dentro del token de recuperación: al cambiar la
   * contraseña la huella cambia y el token deja de servir (un solo uso). Misma fórmula
   * que el legado, así los links emitidos por FastAPI siguen siendo válidos.
   */
  fingerprint(passwordHash: string): string {
    return createHash('sha256')
      .update(passwordHash, 'utf8')
      .digest('hex')
      .slice(0, 16);
  }
}
