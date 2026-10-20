import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { HealthService } from './health.service';
import type { HealthStatus } from './interfaces/health-status.interface';

@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  /** 200 si la API y la base responden; 503 si la base no está disponible. */
  @Get()
  async check(): Promise<HealthStatus> {
    const health = await this.healthService.check();
    if (health.status !== 'healthy') {
      throw new ServiceUnavailableException(health);
    }
    return health;
  }
}
