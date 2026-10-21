import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { RegisterDto } from './register.dto';
import { ResetPasswordDto } from './reset-password.dto';

async function errorsOf<T extends object>(
  dto: new () => T,
  body: Record<string, unknown>,
): Promise<string[]> {
  const errors = await validate(plainToInstance(dto, body));
  return errors.flatMap((error) => Object.values(error.constraints ?? {}));
}

const validRegister = {
  email: '  Lucia@Example.com ',
  full_name: 'Lucía Prueba',
  phone: '+54 11 4444-7788',
  password: 'Clave1234',
};

describe('RegisterDto', () => {
  it('acepta un registro válido y normaliza el email', async () => {
    await expect(errorsOf(RegisterDto, validRegister)).resolves.toEqual([]);
    expect(plainToInstance(RegisterDto, validRegister).email).toBe(
      'lucia@example.com',
    );
  });

  it('el teléfono es opcional y puede venir vacío (el formulario lo envía así)', async () => {
    await expect(
      errorsOf(RegisterDto, { ...validRegister, phone: '' }),
    ).resolves.toEqual([]);
    await expect(
      errorsOf(RegisterDto, { ...validRegister, phone: undefined }),
    ).resolves.toEqual([]);
  });

  it('aplica la política de contraseñas del legado', async () => {
    await expect(
      errorsOf(RegisterDto, { ...validRegister, password: 'clave1234' }),
    ).resolves.toEqual([
      'La contraseña debe contener al menos una letra mayúscula',
    ]);
    await expect(
      errorsOf(RegisterDto, { ...validRegister, password: 'CLAVE1234' }),
    ).resolves.toEqual([
      'La contraseña debe contener al menos una letra minúscula',
    ]);
    await expect(
      errorsOf(RegisterDto, { ...validRegister, password: 'ClaveSinNum' }),
    ).resolves.toEqual(['La contraseña debe contener al menos un número']);
    await expect(
      errorsOf(RegisterDto, { ...validRegister, password: 'Cl4ve' }),
    ).resolves.toEqual(['La contraseña debe tener entre 8 y 100 caracteres']);
  });

  it('valida email, nombre y teléfono', async () => {
    const errors = await errorsOf(RegisterDto, {
      email: 'no-es-email',
      full_name: 'L',
      phone: '11-abc',
      password: 'Clave1234',
    });
    expect(errors).toEqual(
      expect.arrayContaining([
        'El email no es válido',
        'El nombre debe tener entre 2 y 255 caracteres',
        'El teléfono debe contener solo números',
        'El teléfono debe tener al menos 8 dígitos',
      ]),
    );
  });
});

describe('ResetPasswordDto', () => {
  it('tolera espacios y saltos de línea en el código pegado desde el email', async () => {
    const dto = plainToInstance(ResetPasswordDto, {
      token: ' eyJhbGciOi\n  JIUzI1NiJ9 ',
      new_password: 'NuevaClave9',
    });
    expect(dto.token).toBe('eyJhbGciOiJIUzI1NiJ9');
    await expect(validate(dto)).resolves.toEqual([]);
  });
});
