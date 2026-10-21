import { INestApplication, UnauthorizedException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { sign } from 'jsonwebtoken';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { MailService } from '../src/mail/mail.service';
import { GoogleAuthService } from '../src/modules/auth/google-auth.service';
import type { GoogleIdentity } from '../src/modules/auth/interfaces/auth.interfaces';
import { PasswordService } from '../src/modules/users/password.service';
import { PrismaService } from '../src/prisma/prisma.service';

/**
 * Autenticación y usuarios contra la base real (requiere `npm run db:migrate`).
 * Email y Google se reemplazan por dobles de prueba: nada sale a internet.
 */

const EMAIL_DOMAIN = '@e2e-auth.example.com';
let sequence = 0;
function uniqueEmail(prefix: string): string {
  sequence += 1;
  return `${prefix}.${Date.now()}${sequence}${EMAIL_DOMAIN}`;
}

/** Credential falso "google:<email>:<nombre>[:unverified]" que acepta el doble de Google. */
const fakeGoogle = {
  getClientId: () => process.env.GOOGLE_CLIENT_ID ?? null,
  verify: (credential: string): Promise<GoogleIdentity> => {
    const [prefix, email, name, flag] = credential.split(':');
    if (prefix !== 'google' || !email) {
      return Promise.reject(
        new UnauthorizedException('Token de Google inválido'),
      );
    }
    return Promise.resolve({
      email,
      name,
      emailVerified: flag !== 'unverified',
    });
  },
};

const mail = {
  sendWelcome: jest.fn(() => Promise.resolve(true)),
  sendPasswordReset: jest.fn(() => Promise.resolve(true)),
  sendPasswordChanged: jest.fn(() => Promise.resolve(true)),
};

interface TokenBody {
  access_token: string;
  token_type: string;
}

interface UserBody {
  id: number;
  email: string;
  full_name: string;
  phone: string | null;
  is_active: boolean;
  is_admin: boolean;
  created_at: string;
}

describe('Autenticación y usuarios (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let adminToken: string;

  const http = () => request(app.getHttpServer());
  const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

  async function register(
    overrides: Partial<Record<string, string>> = {},
  ): Promise<{ user: UserBody; email: string; password: string }> {
    const body = {
      email: uniqueEmail('cliente'),
      full_name: 'Lucía Prueba',
      phone: '11 4444-7788',
      password: 'Clave1234',
      ...overrides,
    };
    const response = await http()
      .post('/api/auth/register')
      .send(body)
      .expect(201);
    return {
      user: response.body as UserBody,
      email: body.email,
      password: body.password,
    };
  }

  /** Login como lo hace el frontend: form-urlencoded con `username`. */
  async function login(email: string, password: string): Promise<string> {
    const response = await http()
      .post('/api/auth/login')
      .type('form')
      .send({ username: email, password })
      .expect(200);
    return (response.body as TokenBody).access_token;
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(MailService)
      .useValue(mail)
      .overrideProvider(GoogleAuthService)
      .useValue(fakeGoogle)
      .compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();

    prisma = app.get(PrismaService);
    await prisma.user.deleteMany({
      where: { email: { endsWith: EMAIL_DOMAIN } },
    });

    const adminEmail = uniqueEmail('admin');
    await prisma.user.create({
      data: {
        email: adminEmail,
        fullName: 'Admin E2E',
        hashedPassword: await app.get(PasswordService).hash('Admin1234'),
        isAdmin: true,
      },
    });
    adminToken = await login(adminEmail, 'Admin1234');
  });

  beforeEach(() => jest.clearAllMocks());

  afterAll(async () => {
    await prisma.user.deleteMany({
      where: { email: { endsWith: EMAIL_DOMAIN } },
    });
    await app.close();
  });

  describe('POST /api/auth/register', () => {
    it('crea la cuenta (201), normaliza el email y nunca expone el hash', async () => {
      const email = uniqueEmail('Registro').toUpperCase();
      const response = await http()
        .post('/api/auth/register')
        .send({
          email: `  ${email} `,
          full_name: 'Lucía Prueba',
          phone: '',
          password: 'Clave1234',
        })
        .expect(201);

      expect(response.body).toEqual({
        id: expect.any(Number) as number,
        email: email.toLowerCase(),
        full_name: 'Lucía Prueba',
        phone: '',
        is_active: true,
        is_admin: false,
        created_at: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/) as string,
      });
      expect(mail.sendWelcome).toHaveBeenCalledWith(
        email.toLowerCase(),
        'Lucía Prueba',
      );
    });

    it('rechaza un email ya registrado (sin importar mayúsculas)', async () => {
      const { email } = await register();
      const response = await http()
        .post('/api/auth/register')
        .send({
          email: email.toUpperCase(),
          full_name: 'Otra Persona',
          password: 'Clave1234',
        })
        .expect(400);
      expect((response.body as { message: string }).message).toBe(
        'El email ya está registrado',
      );
    });

    it('valida con 422 y mensajes en español (como FastAPI)', async () => {
      const response = await http()
        .post('/api/auth/register')
        .send({ email: 'no-es-email', full_name: 'Lu', password: 'debil' })
        .expect(422);
      expect((response.body as { message: string[] }).message).toEqual(
        expect.arrayContaining([
          'El email no es válido',
          'La contraseña debe tener entre 8 y 100 caracteres',
          'La contraseña debe contener al menos una letra mayúscula',
          'La contraseña debe contener al menos un número',
        ]),
      );

      await http()
        .post('/api/auth/register')
        .send({
          email: uniqueEmail('extra'),
          full_name: 'Lucía',
          password: 'Clave1234',
          is_admin: true,
        })
        .expect(422);
    });
  });

  describe('POST /api/auth/login', () => {
    it('form-urlencoded (OAuth2) y JSON devuelven un bearer token', async () => {
      const { email, password } = await register();
      const form = await http()
        .post('/api/auth/login')
        .type('form')
        .send({ username: email, password, grant_type: 'password', scope: '' })
        .expect(200);
      expect(form.body).toEqual({
        access_token: expect.any(String) as string,
        token_type: 'bearer',
      });

      await http()
        .post('/api/auth/login')
        .send({ username: email.toUpperCase(), password })
        .expect(200);
    });

    it('credenciales inválidas: 401 con el mismo mensaje exista o no el email', async () => {
      const { email } = await register();
      for (const username of [email, uniqueEmail('inexistente')]) {
        const response = await http()
          .post('/api/auth/login')
          .type('form')
          .send({ username, password: 'Incorrecta1' })
          .expect(401);
        expect((response.body as { message: string }).message).toBe(
          'Email o contraseña incorrectos',
        );
      }
    });
  });

  describe('GET /api/users/me y tokens', () => {
    it('devuelve el perfil del usuario del token', async () => {
      const { user, email, password } = await register();
      const token = await login(email, password);
      const response = await http()
        .get('/api/users/me')
        .set(bearer(token))
        .expect(200);
      expect(response.body).toEqual(user);
    });

    it('401 sin token, con token inválido o expirado', async () => {
      const noToken = await http().get('/api/users/me').expect(401);
      expect((noToken.body as { message: string }).message).toBe(
        'No autenticado',
      );

      const invalid = await http()
        .get('/api/users/me')
        .set(bearer('no-es-un-jwt'))
        .expect(401);
      expect((invalid.body as { message: string }).message).toBe(
        'Token inválido o expirado',
      );

      const { email } = await register();
      const expired = sign(
        { sub: email, exp: Math.floor(Date.now() / 1000) - 60 },
        process.env.SECRET_KEY ?? '',
      );
      await http().get('/api/users/me').set(bearer(expired)).expect(401);
    });

    it('acepta los JWT con el formato del legado (sub = email, HS256)', async () => {
      const { email } = await register();
      const legacyToken = sign({ sub: email }, process.env.SECRET_KEY ?? '', {
        algorithm: 'HS256',
        expiresIn: '1h',
      });
      await http().get('/api/users/me').set(bearer(legacyToken)).expect(200);
    });

    it('PUT /api/users/me actualiza nombre y teléfono', async () => {
      const { email, password } = await register();
      const token = await login(email, password);
      const response = await http()
        .put('/api/users/me')
        .set(bearer(token))
        .send({ full_name: 'Lucía Actualizada', phone: '+54 11 5555-0000' })
        .expect(200);
      expect(response.body).toMatchObject({
        full_name: 'Lucía Actualizada',
        phone: '+54 11 5555-0000',
      });

      await http()
        .put('/api/users/me')
        .set(bearer(token))
        .send({ phone: '123' })
        .expect(422);
    });
  });

  describe('Google', () => {
    it('GET /api/auth/google/config expone el Client ID público', async () => {
      const response = await http().get('/api/auth/google/config').expect(200);
      expect(response.body).toEqual({
        enabled: true,
        client_id: 'test-client-id.apps.googleusercontent.com',
      });
    });

    it('crea la cuenta en el primer acceso y la cuenta no tiene contraseña', async () => {
      const email = uniqueEmail('google');
      const response = await http()
        .post('/api/auth/google')
        .send({ credential: `google:${email}:Valentina Google` })
        .expect(200);
      const { access_token: token } = response.body as TokenBody;

      const me = await http()
        .get('/api/users/me')
        .set(bearer(token))
        .expect(200);
      expect(me.body).toMatchObject({ email, full_name: 'Valentina Google' });
      expect(mail.sendWelcome).toHaveBeenCalledTimes(1);

      const passwordLogin = await http()
        .post('/api/auth/login')
        .type('form')
        .send({ username: email, password: 'Cualquiera1' })
        .expect(401);
      expect((passwordLogin.body as { message: string }).message).toBe(
        'Esta cuenta usa inicio de sesión con Google',
      );
    });

    it('un usuario existente entra con Google a su misma cuenta', async () => {
      const { user, email } = await register();
      const response = await http()
        .post('/api/auth/google')
        .send({ credential: `google:${email}:Otro Nombre` })
        .expect(200);
      const me = await http()
        .get('/api/users/me')
        .set(bearer((response.body as TokenBody).access_token))
        .expect(200);
      expect((me.body as UserBody).id).toBe(user.id);
      expect(mail.sendWelcome).toHaveBeenCalledTimes(1); // solo el del registro
    });

    it('rechaza tokens inválidos y emails sin verificar', async () => {
      await http()
        .post('/api/auth/google')
        .send({ credential: 'basura' })
        .expect(401);
      const unverified = await http()
        .post('/api/auth/google')
        .send({ credential: `google:${uniqueEmail('nv')}:Nadie:unverified` })
        .expect(400);
      expect((unverified.body as { message: string }).message).toBe(
        'El email de Google no está verificado',
      );
    });
  });

  describe('Recuperación de contraseña', () => {
    function lastResetToken(): string {
      const calls = mail.sendPasswordReset.mock.calls as unknown as Array<
        [string, string, string]
      >;
      return calls[calls.length - 1][2];
    }

    it('flujo completo con token de un solo uso', async () => {
      const { email } = await register();
      const requested = await http()
        .post('/api/auth/password-reset')
        .send({ email })
        .expect(200);
      expect(requested.body).toEqual({
        message:
          'Si el email existe, recibirás instrucciones para resetear tu contraseña',
      });
      const token = lastResetToken();

      // El token del email no sirve como sesión.
      await http().get('/api/users/me').set(bearer(token)).expect(401);

      const confirmed = await http()
        .post('/api/auth/password-reset/confirm')
        .send({ token: ` ${token}\n`, new_password: 'NuevaClave9' })
        .expect(200);
      expect(confirmed.body).toEqual({
        message: 'Contraseña actualizada exitosamente',
      });
      expect(mail.sendPasswordChanged).toHaveBeenCalledWith(
        email,
        'Lucía Prueba',
      );

      await login(email, 'NuevaClave9');
      await http()
        .post('/api/auth/login')
        .type('form')
        .send({ username: email, password: 'Clave1234' })
        .expect(401);

      const reused = await http()
        .post('/api/auth/password-reset/confirm')
        .send({ token, new_password: 'OtraClave9' })
        .expect(400);
      expect((reused.body as { message: string }).message).toBe(
        'El código es inválido o expiró. Solicitá uno nuevo.',
      );
    });

    it('misma respuesta para emails inexistentes o de Google, sin enviar nada', async () => {
      const googleEmail = uniqueEmail('google-reset');
      await http()
        .post('/api/auth/google')
        .send({ credential: `google:${googleEmail}:Google Reset` })
        .expect(200);

      for (const email of [uniqueEmail('nadie'), googleEmail]) {
        const response = await http()
          .post('/api/auth/password-reset')
          .send({ email })
          .expect(200);
        expect((response.body as { message: string }).message).toMatch(
          /^Si el email existe/,
        );
      }
      expect(mail.sendPasswordReset).not.toHaveBeenCalled();
    });

    it('los alias /forgot-password y /reset-password funcionan igual', async () => {
      const { email } = await register();
      await http()
        .post('/api/auth/forgot-password')
        .send({ email })
        .expect(200);
      await http()
        .post('/api/auth/reset-password')
        .send({ token: lastResetToken(), new_password: 'AliasClave9' })
        .expect(200);
      await login(email, 'AliasClave9');

      await http()
        .post('/api/auth/reset-password')
        .send({ token: 'token-que-no-es-valido', new_password: 'AliasClave9' })
        .expect(400);
    });
  });

  describe('Administración de usuarios', () => {
    it('un cliente no accede a las rutas de admin (403)', async () => {
      const { email, password } = await register();
      const token = await login(email, password);
      const response = await http()
        .get('/api/users')
        .set(bearer(token))
        .expect(403);
      expect((response.body as { message: string }).message).toBe(
        'No tienes permisos de administrador',
      );
      await http().get('/api/users').expect(401);
    });

    it('lista, consulta, desactiva y promueve usuarios', async () => {
      const { user, email, password } = await register();

      const list = await http()
        .get('/api/users')
        .query({ is_admin: false, limit: 100 })
        .set(bearer(adminToken))
        .expect(200);
      const users = list.body as UserBody[];
      expect(users.every((item) => !item.is_admin)).toBe(true);

      await http()
        .get(`/api/users/${user.id}`)
        .set(bearer(adminToken))
        .expect(200);
      await http()
        .get('/api/users/999999999')
        .set(bearer(adminToken))
        .expect(404);
      await http().get('/api/users/abc').set(bearer(adminToken)).expect(422);

      const token = await login(email, password);
      const disabled = await http()
        .put(`/api/users/${user.id}/toggle-active`)
        .set(bearer(adminToken))
        .expect(200);
      expect((disabled.body as UserBody).is_active).toBe(false);
      await http()
        .post('/api/auth/login')
        .type('form')
        .send({ username: email, password })
        .expect(403);
      const inactive = await http()
        .get('/api/users/me')
        .set(bearer(token))
        .expect(403);
      expect((inactive.body as { message: string }).message).toBe(
        'Usuario inactivo',
      );

      const promoted = await http()
        .put(`/api/users/${user.id}/make-admin`)
        .set(bearer(adminToken))
        .expect(200);
      expect((promoted.body as UserBody).is_admin).toBe(true);
      await http()
        .put(`/api/users/${user.id}/make-admin`)
        .set(bearer(adminToken))
        .expect(400);
    });

    it('el admin no puede desactivarse a sí mismo', async () => {
      const me = await http()
        .get('/api/users/me')
        .set(bearer(adminToken))
        .expect(200);
      const response = await http()
        .put(`/api/users/${(me.body as UserBody).id}/toggle-active`)
        .set(bearer(adminToken))
        .expect(400);
      expect((response.body as { message: string }).message).toBe(
        'No puedes desactivar tu propia cuenta',
      );
    });
  });
});
