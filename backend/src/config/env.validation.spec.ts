import { NodeEnv, parseFrontendOrigins, validateEnv } from './env.validation';

const REQUIRED = { DATABASE_URL: 'postgresql://x', SECRET_KEY: 'secreto' };

describe('validateEnv', () => {
  it('aplica los valores por defecto y convierte PORT a número', () => {
    const env = validateEnv({ ...REQUIRED, PORT: '4000' });
    expect(env).toMatchObject({
      NODE_ENV: NodeEnv.Development,
      PORT: 4000,
      FRONTEND_URL: 'http://localhost:5173',
      ACCESS_TOKEN_EXPIRE_MINUTES: 1440,
    });
  });

  it('no arranca sin DATABASE_URL ni SECRET_KEY', () => {
    expect(() => validateEnv({})).toThrow(/DATABASE_URL es obligatoria/);
    expect(() => validateEnv({})).toThrow(/SECRET_KEY es obligatoria/);
  });

  it('rechaza un NODE_ENV desconocido', () => {
    expect(() => validateEnv({ ...REQUIRED, NODE_ENV: 'staging' })).toThrow(
      /NODE_ENV/,
    );
  });

  it('FRONTEND_URL admite varios orígenes separados por coma', () => {
    expect(
      parseFrontendOrigins('https://a.vercel.app/ , http://localhost:5173,'),
    ).toEqual(['https://a.vercel.app', 'http://localhost:5173']);
  });
});
