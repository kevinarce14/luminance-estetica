import {
  addDays,
  formatForHumans,
  timeColumnToString,
  timeStringToColumn,
  toZonedParts,
  weekdayOf,
  zonedDayRange,
  zonedTimeToUtc,
  zonedToday,
} from './zoned-time';

const BUENOS_AIRES = 'America/Argentina/Buenos_Aires';

describe('zoned-time (America/Argentina/Buenos_Aires, -03:00)', () => {
  it('convierte una hora del studio a UTC y vuelve', () => {
    const utc = zonedTimeToUtc('2026-10-22', '09:00', BUENOS_AIRES);
    expect(utc.toISOString()).toBe('2026-10-22T12:00:00.000Z');
    expect(toZonedParts(utc, BUENOS_AIRES)).toEqual({
      date: '2026-10-22',
      time: '09:00:00',
    });
  });

  it('las 23:30 del studio ya son el día siguiente en UTC', () => {
    expect(
      zonedTimeToUtc('2026-10-22', '23:30:00', BUENOS_AIRES).toISOString(),
    ).toBe('2026-10-23T02:30:00.000Z');
  });

  it('"hoy" es la fecha del studio, no la de UTC', () => {
    const lateNightUtc = new Date('2026-10-23T02:30:00Z');
    expect(zonedToday(BUENOS_AIRES, lateNightUtc)).toBe('2026-10-22');
  });

  it('el día del studio va de 03:00Z a 03:00Z del día siguiente', () => {
    const { start, end } = zonedDayRange('2026-10-22', BUENOS_AIRES);
    expect(start.toISOString()).toBe('2026-10-22T03:00:00.000Z');
    expect(end.toISOString()).toBe('2026-10-23T03:00:00.000Z');
  });

  it('respeta zonas con horario de verano (Madrid, cambio de octubre)', () => {
    expect(
      zonedTimeToUtc('2026-07-01', '10:00', 'Europe/Madrid').toISOString(),
    ).toBe('2026-07-01T08:00:00.000Z');
    expect(
      zonedTimeToUtc('2026-12-01', '10:00', 'Europe/Madrid').toISOString(),
    ).toBe('2026-12-01T09:00:00.000Z');
  });

  it('día de la semana con la convención 0=Domingo … 6=Sábado', () => {
    expect(weekdayOf('2026-10-25')).toBe(0); // domingo
    expect(weekdayOf('2026-10-26')).toBe(1); // lunes
    expect(weekdayOf('2026-10-31')).toBe(6); // sábado
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
  });

  it('columnas @db.Time ida y vuelta', () => {
    expect(timeColumnToString(timeStringToColumn('09:30'))).toBe('09:30:00');
  });

  it('formatea fechas para los emails en la hora del studio', () => {
    expect(
      formatForHumans(new Date('2026-10-22T13:00:00Z'), BUENOS_AIRES),
    ).toBe('jueves, 22 de octubre de 2026, 10:00 hs');
  });
});
