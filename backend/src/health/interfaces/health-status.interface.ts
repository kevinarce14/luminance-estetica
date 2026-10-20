export type DatabaseStatus = 'connected' | 'disconnected';

/** Respuesta de GET /api/health (misma forma base que el backend FastAPI). */
export interface HealthStatus {
  status: 'healthy' | 'unhealthy';
  environment: string;
  services: {
    database: DatabaseStatus;
  };
}
