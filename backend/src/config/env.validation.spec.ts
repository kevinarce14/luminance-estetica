import { NodeEnv, validateEnv } from './env.validation';

describe('validateEnv', () => {
  it('aplica los valores por defecto y convierte PORT a número', () => {
    const env = validateEnv({ DATABASE_URL: 'postgresql://x', PORT: '4000' });
    expect(env).toMatchObject({
      NODE_ENV: NodeEnv.Development,
      PORT: 4000,
      FRONTEND_URL: 'http://localhost:5173',
    });
  });

  it('no arranca sin DATABASE_URL', () => {
    expect(() => validateEnv({})).toThrow(/DATABASE_URL/);
  });

  it('rechaza un NODE_ENV desconocido', () => {
    expect(() =>
      validateEnv({ DATABASE_URL: 'postgresql://x', NODE_ENV: 'staging' }),
    ).toThrow(/NODE_ENV/);
  });
});
