import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { EnvironmentVariables } from '../config/env.validation';
import { PrismaService } from '../prisma/prisma.service';
import type {
  DatabaseStatus,
  HealthStatus,
} from './interfaces/health-status.interface';

@Injectable()
export class HealthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<EnvironmentVariables, true>,
  ) {}

  async check(): Promise<HealthStatus> {
    const database = await this.pingDatabase();
    return {
      status: database === 'connected' ? 'healthy' : 'unhealthy',
      environment: this.config.get('NODE_ENV', { infer: true }),
      services: { database },
    };
  }

  private async pingDatabase(): Promise<DatabaseStatus> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return 'connected';
    } catch {
      return 'disconnected';
    }
  }
}
