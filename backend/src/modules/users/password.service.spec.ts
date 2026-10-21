import { PasswordService } from './password.service';

/** Hash generado por passlib (backend FastAPI) para la contraseña "Clave1234". */
const PASSLIB_HASH =
  '$2b$12$DSGUzDb8M8DS48vsbjARf.kh7XOZOOSl27OBepMPSmASluci3MqZy';

describe('PasswordService', () => {
  const passwords = new PasswordService();

  it('hashea con bcrypt costo 12 y verifica', async () => {
    const hashed = await passwords.hash('Clave1234');
    expect(hashed).toMatch(/^\$2[aby]\$12\$/);
    await expect(passwords.verify('Clave1234', hashed)).resolves.toBe(true);
    await expect(passwords.verify('Otra1234', hashed)).resolves.toBe(false);
  });

  it('verifica los hashes existentes de passlib (usuarios creados en FastAPI)', async () => {
    await expect(passwords.verify('Clave1234', PASSLIB_HASH)).resolves.toBe(
      true,
    );
  });

  it('una cuenta de Google (hash vacío) nunca verifica', async () => {
    await expect(passwords.verify('', '')).resolves.toBe(false);
  });

  it('la huella coincide con la del legado (password_fingerprint)', () => {
    expect(passwords.fingerprint(PASSLIB_HASH)).toBe('ae5c0b4903ead645');
  });
});
