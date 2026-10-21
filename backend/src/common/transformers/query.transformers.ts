import type { TransformFnParams } from 'class-transformer';

/** Query string → boolean ("true"/"1" y "false"/"0"); el resto queda para que lo rechace @IsBoolean. */
export function toBoolean({ value }: TransformFnParams): unknown {
  if (value === 'true' || value === '1' || value === true) return true;
  if (value === 'false' || value === '0' || value === false) return false;
  return value;
}

/** Recorta y pasa a minúsculas (emails, categorías). */
export function toTrimmedLowercase({ value }: TransformFnParams): unknown {
  return typeof value === 'string' ? value.trim().toLowerCase() : value;
}
