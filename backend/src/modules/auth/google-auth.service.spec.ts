import {
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { EnvironmentVariables } from '../../config/env.validation';
import { GoogleAuthService } from './google-auth.service';

function serviceWith(clientId?: string): GoogleAuthService {
  const config = {
    get: () => clientId,
  } as unknown as ConfigService<EnvironmentVariables, true>;
  return new GoogleAuthService(config);
}

describe('GoogleAuthService', () => {
  it('sin GOOGLE_CLIENT_ID el login con Google está deshabilitado (503)', async () => {
    const service = serviceWith('   ');
    expect(service.getClientId()).toBeNull();
    await expect(service.verify('cualquier-token')).rejects.toThrow(
      new ServiceUnavailableException(
        'Google OAuth no está configurado en el servidor',
      ),
    );
  });

  it('expone el Client ID sin espacios', () => {
    expect(serviceWith(' abc.apps.googleusercontent.com ').getClientId()).toBe(
      'abc.apps.googleusercontent.com',
    );
  });

  it('un credential que no es un JWT es inválido (401) sin consultar a Google', async () => {
    await expect(
      serviceWith('abc.apps.googleusercontent.com').verify('no-es-un-jwt'),
    ).rejects.toThrow(new UnauthorizedException('Token de Google inválido'));
  });
});
