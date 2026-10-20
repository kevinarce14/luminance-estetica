import { Injectable, NotFoundException } from '@nestjs/common';
import type { Service } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ListServicesQueryDto } from './dto/list-services-query.dto';
import type { ServicePublic } from './interfaces/service-public.interface';

@Injectable()
export class ServicesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: ListServicesQueryDto): Promise<ServicePublic[]> {
    const services = await this.prisma.service.findMany({
      where: { isActive: query.is_active, category: query.category },
      orderBy: { id: 'asc' },
      skip: query.skip,
      take: query.limit,
    });
    return services.map(toServicePublic);
  }

  async findByCategory(category: string): Promise<ServicePublic[]> {
    const services = await this.prisma.service.findMany({
      where: { category: category.trim().toLowerCase(), isActive: true },
      orderBy: { id: 'asc' },
    });
    return services.map(toServicePublic);
  }

  async findOne(id: number): Promise<ServicePublic> {
    const service = await this.prisma.service.findUnique({ where: { id } });
    if (!service) {
      throw new NotFoundException('Servicio no encontrado');
    }
    return toServicePublic(service);
  }
}

function toServicePublic(service: Service): ServicePublic {
  return {
    id: service.id,
    name: service.name,
    description: service.description,
    duration_minutes: service.durationMinutes,
    price: service.price,
    category: service.category,
    image_url: service.imageUrl,
  };
}
