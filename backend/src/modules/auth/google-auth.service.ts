import {
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OAuth2Client } from 'google-auth-library';
import type { EnvironmentVariables } from '../../config/env.validation';
import type { GoogleIdentity } from './interfaces/auth.interfaces';

/**
 * Verifica los id_token de Google Identity Services: firma (claves públicas de Google,
 * cacheadas por la librería), expiración y que el `aud` sea el Client ID de esta app.
 */
@Injectable()
export class GoogleAuthService {
  private readonly client = new OAuth2Client();

  constructor(
    private readonly config: ConfigService<EnvironmentVariables, true>,
  ) {}

  /** Client ID público, o null si el login con Google está deshabilitado. */
  getClientId(): string | null {
    return this.config.get('GOOGLE_CLIENT_ID', { infer: true })?.trim() || null;
  }

  async verify(credential: string): Promise<GoogleIdentity> {
    const clientId = this.getClientId();
    if (!clientId) {
      throw new ServiceUnavailableException(
        'Google OAuth no está configurado en el servidor',
      );
    }

    let payload;
    try {
      const ticket = await this.client.verifyIdToken({
        idToken: credential,
        audience: clientId,
      });
      payload = ticket.getPayload();
    } catch {
      throw new UnauthorizedException('Token de Google inválido');
    }
    if (!payload) {
      throw new UnauthorizedException('Token de Google inválido');
    }

    const email = payload.email ?? '';
    return {
      email,
      name: payload.name || email.split('@')[0],
      emailVerified: payload.email_verified === true,
    };
  }
}
