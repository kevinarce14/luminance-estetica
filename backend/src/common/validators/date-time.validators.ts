import { ValidateBy, type ValidationOptions } from 'class-validator';

const CALENDAR_DATE = /^\d{4}-\d{2}-\d{2}$/;
const CLOCK_TIME = /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/;
/** ISO 8601 con fecha y hora, con o sin offset ("2026-10-22T10:00:00-03:00", "...Z", sin zona). */
const ISO_DATE_TIME =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,6})?)?(Z|[+-]\d{2}:\d{2})?$/;

/** Fecha de calendario real "YYYY-MM-DD" (rechaza 2026-02-30). */
export function IsCalendarDate(options?: ValidationOptions): PropertyDecorator {
  return ValidateBy(
    {
      name: 'isCalendarDate',
      validator: {
        validate: (value: unknown) =>
          typeof value === 'string' &&
          CALENDAR_DATE.test(value) &&
          new Date(`${value}T00:00:00Z`).toISOString().startsWith(value),
        defaultMessage: () =>
          'La fecha debe tener el formato YYYY-MM-DD y ser válida',
      },
    },
    options,
  );
}

/** Hora "HH:MM" o "HH:MM:SS". */
export function IsClockTime(options?: ValidationOptions): PropertyDecorator {
  return ValidateBy(
    {
      name: 'isClockTime',
      validator: {
        validate: (value: unknown) =>
          typeof value === 'string' && CLOCK_TIME.test(value),
        defaultMessage: () => 'La hora debe tener el formato HH:MM',
      },
    },
    options,
  );
}

/** Fecha y hora ISO 8601. Sin offset se interpreta como UTC (convención del legado). */
export function IsIsoDateTime(options?: ValidationOptions): PropertyDecorator {
  return ValidateBy(
    {
      name: 'isIsoDateTime',
      validator: {
        validate: (value: unknown) =>
          typeof value === 'string' &&
          ISO_DATE_TIME.test(value) &&
          !Number.isNaN(parseIsoDateTime(value).getTime()),
        defaultMessage: () =>
          'La fecha debe ser ISO 8601 (ej. 2026-10-22T10:00:00-03:00)',
      },
    },
    options,
  );
}

/** Parsea un ISO 8601 validado por @IsIsoDateTime: sin zona = UTC. */
export function parseIsoDateTime(value: string): Date {
  const hasZone = /(Z|[+-]\d{2}:\d{2})$/.test(value);
  return new Date(hasZone ? value : `${value}Z`);
}
