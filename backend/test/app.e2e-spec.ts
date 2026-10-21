import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';

/**
 * Tests e2e contra una base real con las migraciones y el seed aplicados:
 *   npm run db:migrate && npm run db:seed && npm run test:e2e
 */
describe('API (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /api/health: API y base conectadas', () => {
    return request(app.getHttpServer())
      .get('/api/health')
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          status: 'healthy',
          services: { database: 'connected' },
        });
      });
  });

  it('GET /api/services: catálogo activo en el formato de FastAPI', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/services')
      .expect(200);
    const services = response.body as Array<Record<string, unknown>>;
    expect(services.length).toBeGreaterThanOrEqual(9);
    expect(services[0]).toEqual({
      id: expect.any(Number) as number,
      name: 'Lifting de Pestañas',
      description: expect.any(String) as string,
      duration_minutes: 60,
      price: 15000,
      category: 'pestañas',
      image_url: null,
    });
  });

  it('GET /api/services: filtra por categoría y pagina', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/services')
      .query({ category: 'LASER', limit: 2 })
      .expect(200);
    const services = response.body as Array<{ category: string }>;
    expect(services).toHaveLength(2);
    expect(services.every((service) => service.category === 'laser')).toBe(
      true,
    );
  });

  it('GET /api/services/category/:category', async () => {
    const response = await request(app.getHttpServer())
      .get(`/api/services/category/${encodeURIComponent('cejas')}`)
      .expect(200);
    expect(response.body).toHaveLength(2);
  });

  it('ValidationPipe: rechaza con 422 query params inválidos o desconocidos', async () => {
    const invalid = await request(app.getHttpServer())
      .get('/api/services')
      .query({ limit: 0, is_active: 'quizas' })
      .expect(422);
    expect((invalid.body as { message: string[] }).message).toEqual(
      expect.arrayContaining([
        'limit debe ser al menos 1',
        'is_active debe ser true o false',
      ]),
    );

    await request(app.getHttpServer())
      .get('/api/services')
      .query({ orden: 'precio' })
      .expect(422);
  });

  it('GET /api/services/:id: 404 en español y 422 si el id no es numérico', async () => {
    const missing = await request(app.getHttpServer())
      .get('/api/services/999999')
      .expect(404);
    expect((missing.body as { message: string }).message).toBe(
      'Servicio no encontrado',
    );

    await request(app.getHttpServer()).get('/api/services/abc').expect(422);
  });
});
