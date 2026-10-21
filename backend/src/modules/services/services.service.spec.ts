import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { Service } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ListServicesQueryDto } from './dto/list-services-query.dto';
import { ServicesService } from './services.service';

const lifting: Service = {
  id: 1,
  name: 'Lifting de Pestañas',
  description: 'Realza y curva las pestañas.',
  durationMinutes: 60,
  price: 15000,
  category: 'pestañas',
  isActive: true,
  imageUrl: null,
  createdAt: new Date('2026-01-01T12:00:00Z'),
  updatedAt: null,
};

describe('ServicesService', () => {
  const prisma = {
    service: { findMany: jest.fn(), findUnique: jest.fn() },
  };
  let service: ServicesService;

  beforeEach(async () => {
    jest.resetAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [
        ServicesService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    service = moduleRef.get(ServicesService);
  });

  it('lista con los filtros del query y responde en snake_case', async () => {
    prisma.service.findMany.mockResolvedValue([lifting]);
    const query = Object.assign(new ListServicesQueryDto(), {
      category: 'pestañas',
      skip: 5,
      limit: 10,
    });

    await expect(service.findAll(query)).resolves.toEqual([
      {
        id: 1,
        name: 'Lifting de Pestañas',
        description: 'Realza y curva las pestañas.',
        duration_minutes: 60,
        price: 15000,
        category: 'pestañas',
        image_url: null,
      },
    ]);
    expect(prisma.service.findMany).toHaveBeenCalledWith({
      where: { isActive: true, category: 'pestañas' },
      orderBy: { id: 'asc' },
      skip: 5,
      take: 10,
    });
  });

  it('por categoría normaliza el texto y solo trae activos', async () => {
    prisma.service.findMany.mockResolvedValue([]);
    await service.findByCategory('  CEJAS ');
    expect(prisma.service.findMany).toHaveBeenCalledWith({
      where: { category: 'cejas', isActive: true },
      orderBy: { id: 'asc' },
    });
  });

  it('lanza 404 si el servicio no existe', async () => {
    prisma.service.findUnique.mockResolvedValue(null);
    await expect(service.findOne(99)).rejects.toThrow(
      new NotFoundException('Servicio no encontrado'),
    );
  });
});
