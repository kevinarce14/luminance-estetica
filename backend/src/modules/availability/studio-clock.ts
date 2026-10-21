import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { EnvironmentVariables } from '../../config/env.validation';
import { zonedToday } from '../../common/time/zoned-time';

const HOUR_MS = 60 * 60 * 1000;

/**
 * Reloj y reglas de reserva del studio (zona horaria, anticipación mínima y máxima).
 * Centralizar `now()` permite fijar la hora en los tests.
 */
@Injectable()
export class StudioClock {
  readonly timeZone: string;
  readonly slotStepMinutes: number;
  readonly minAdvanceHours: number;
  readonly maxAdvanceDays: number;

  constructor(config: ConfigService<EnvironmentVariables, true>) {
    this.timeZone = config.get('TIMEZONE', { infer: true });
    this.slotStepMinutes = config.get('MIN_APPOINTMENT_DURATION', {
      infer: true,
    });
    this.minAdvanceHours = config.get('MIN_BOOKING_ADVANCE_HOURS', {
      infer: true,
    });
    this.maxAdvanceDays = config.get('MAX_BOOKING_ADVANCE_DAYS', {
      infer: true,
    });
  }

  now(): Date {
    return new Date();
  }

  today(): string {
    return zonedToday(this.timeZone, this.now());
  }

  /** Primer inicio reservable: ahora + MIN_BOOKING_ADVANCE_HOURS. */
  earliestBookableStart(): Date {
    return new Date(this.now().getTime() + this.minAdvanceHours * HOUR_MS);
  }

  /** Último inicio reservable: ahora + MAX_BOOKING_ADVANCE_DAYS. */
  latestBookableStart(): Date {
    return new Date(this.now().getTime() + this.maxAdvanceDays * 24 * HOUR_MS);
  }
}
