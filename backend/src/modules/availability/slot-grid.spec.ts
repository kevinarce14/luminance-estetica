import { zonedTimeToUtc } from '../../common/time/zoned-time';
import { buildSlotGrid, type SlotGridInput } from './slot-grid';

const TZ = 'America/Argentina/Buenos_Aires';
const DATE = '2026-10-22';
const at = (time: string) => zonedTimeToUtc(DATE, time, TZ);

function grid(overrides: Partial<SlotGridInput> = {}) {
  return buildSlotGrid({
    date: DATE,
    opening: '09:00:00',
    closing: '12:00:00',
    durationMinutes: 60,
    stepMinutes: 30,
    timeZone: TZ,
    busy: [],
    earliestStart: at('00:00'),
    latestStart: at('23:59'),
    bookable: true,
    ...overrides,
  });
}

const startsOf = (slots: ReturnType<typeof grid>, available?: boolean) =>
  slots
    .filter(
      (slot) => available === undefined || slot.is_available === available,
    )
    .map((slot) => slot.start_time.slice(11, 16));

describe('buildSlotGrid', () => {
  it('genera un bloque cada 30 min mientras el servicio termine antes del cierre', () => {
    const slots = grid();
    expect(startsOf(slots)).toEqual([
      '09:00',
      '09:30',
      '10:00',
      '10:30',
      '11:00',
    ]);
    expect(slots[0]).toEqual({
      start_time: '2026-10-22T09:00:00',
      end_time: '2026-10-22T10:00:00',
      is_available: true,
    });
  });

  it('un turno confirmado bloquea los bloques que se le superponen', () => {
    // Confirmado de 10:00 a 10:30 (servicio de 30 min) con un servicio pedido de 60 min.
    const slots = grid({ busy: [{ start: at('10:00'), end: at('10:30') }] });
    expect(startsOf(slots, false)).toEqual(['09:30', '10:00']);
    expect(startsOf(slots, true)).toEqual(['09:00', '10:30', '11:00']);
  });

  it('cada turno ocupa la duración de SU servicio (no la del pedido)', () => {
    // Confirmado de 09:00 a 11:00 (servicio de 2 h) consultando un servicio de 30 min.
    const slots = grid({
      durationMinutes: 30,
      busy: [{ start: at('09:00'), end: at('11:00') }],
    });
    expect(startsOf(slots, true)).toEqual(['11:00', '11:30']);
  });

  it('aplica la anticipación mínima y el máximo de días sin quitar bloques', () => {
    const slots = grid({
      earliestStart: at('10:00'),
      latestStart: at('10:30'),
    });
    expect(slots).toHaveLength(5);
    expect(startsOf(slots, true)).toEqual(['10:00', '10:30']);
  });

  it('un servicio inactivo devuelve la grilla sin bloques disponibles', () => {
    const slots = grid({ bookable: false });
    expect(slots).toHaveLength(5);
    expect(startsOf(slots, true)).toEqual([]);
  });

  it('si el servicio no entra en el horario no hay bloques', () => {
    expect(grid({ durationMinutes: 240 })).toEqual([]);
  });
});
