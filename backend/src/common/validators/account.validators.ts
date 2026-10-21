import { applyDecorators } from '@nestjs/common';
import {
  IsOptional,
  IsString,
  Length,
  MaxLength,
  ValidateBy,
  ValidateIf,
} from 'class-validator';

export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 100;

/**
 * Regla por expresión regular con nombre propio. Se evita apilar varios @Matches:
 * class-validator agrupa los errores por nombre y solo conservaría el último mensaje.
 */
function MatchesRule(
  name: string,
  pattern: RegExp,
  message: string,
): PropertyDecorator {
  return ValidateBy({
    name,
    validator: {
      validate: (value: unknown) =>
        typeof value === 'string' && pattern.test(value),
      defaultMessage: () => message,
    },
  });
}

/**
 * Política de contraseñas del legado (registro y reseteo):
 * 8 a 100 caracteres, con mayúscula, minúscula y número.
 */
export function IsAccountPassword(): PropertyDecorator {
  return applyDecorators(
    IsString({ message: 'La contraseña es obligatoria' }),
    Length(PASSWORD_MIN_LENGTH, PASSWORD_MAX_LENGTH, {
      message: `La contraseña debe tener entre ${PASSWORD_MIN_LENGTH} y ${PASSWORD_MAX_LENGTH} caracteres`,
    }),
    MatchesRule(
      'passwordUppercase',
      /\p{Lu}/u,
      'La contraseña debe contener al menos una letra mayúscula',
    ),
    MatchesRule(
      'passwordLowercase',
      /\p{Ll}/u,
      'La contraseña debe contener al menos una letra minúscula',
    ),
    MatchesRule(
      'passwordDigit',
      /\d/,
      'La contraseña debe contener al menos un número',
    ),
  );
}

/**
 * Teléfono opcional (vacío permitido, como en el legado): solo dígitos, espacios,
 * guiones, paréntesis y "+", con al menos 8 dígitos.
 */
export function IsContactPhone(): PropertyDecorator {
  return applyDecorators(
    IsOptional(),
    ValidateIf((_object, value) => value !== ''),
    IsString({ message: 'El teléfono debe ser texto' }),
    MaxLength(50, {
      message: 'El teléfono no puede superar los 50 caracteres',
    }),
    MatchesRule(
      'phoneCharacters',
      /^[\d\s()+-]+$/,
      'El teléfono debe contener solo números',
    ),
    MatchesRule(
      'phoneMinDigits',
      /^(?:\D*\d){8}/,
      'El teléfono debe tener al menos 8 dígitos',
    ),
  );
}
