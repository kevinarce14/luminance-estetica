import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Service } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ListServicesQueryDto } from './dto/list-services-query.dto';
import { CreateServiceDto, UpdateServiceDto } from './dto/service-admin.dto';
import {
  toServicePublic,
  type ServicePublic,
} from './interfaces/service-public.interface';

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

  // =====================================================================
  // Administración del catálogo
  // =====================================================================

  /** Todos los servicios, activos e inactivos. */
  findAllAdmin(): Promise<Service[]> {
    return this.prisma.service.findMany({ orderBy: { id: 'asc' } });
  }

  async create(dto: CreateServiceDto): Promise<Service> {
    await this.assertUniqueName(dto.name);
    return this.prisma.service.create({
      data: {
        name: dto.name,
        description: dto.description ?? null,
        durationMinutes: dto.duration_minutes,
        price: dto.price,
        category: dto.category,
        imageUrl: dto.image_url ?? null,
        isActive: dto.is_active,
      },
    });
  }

  async update(id: number, dto: UpdateServiceDto): Promise<Service> {
    const service = await this.getOrFail(id);
    if (dto.name && dto.name !== service.name) {
      await this.assertUniqueName(dto.name, id);
    }
    return this.prisma.service.update({
      where: { id },
      data: {
        name: dto.name,
        description: dto.description,
        durationMinutes: dto.duration_minutes,
        price: dto.price,
        category: dto.category,
        imageUrl: dto.image_url,
        isActive: dto.is_active,
      },
    });
  }

  async toggleActive(id: number): Promise<Service> {
    const service = await this.getOrFail(id);
    return this.prisma.service.update({
      where: { id },
      data: { isActive: !service.isActive },
    });
  }

  /** Un servicio con turnos no se borra (perdería el historial): se desactiva. */
  async remove(id: number): Promise<void> {
    await this.getOrFail(id);
    const appointments = await this.prisma.appointment.count({
      where: { serviceId: id },
    });
    if (appointments > 0) {
      throw new BadRequestException(
        'No se puede eliminar un servicio con turnos asociados. Considera desactivarlo en su lugar.',
      );
    }
    await this.prisma.service.delete({ where: { id } });
  }

  private async getOrFail(id: number): Promise<Service> {
    const service = await this.prisma.service.findUnique({ where: { id } });
    if (!service) {
      throw new NotFoundException('Servicio no encontrado');
    }
    return service;
  }

  private async assertUniqueName(
    name: string,
    exceptId?: number,
  ): Promise<void> {
    const duplicate = await this.prisma.service.findFirst({
      where: { name, ...(exceptId ? { id: { not: exceptId } } : {}) },
    });
    if (duplicate) {
      throw new BadRequestException('Ya existe un servicio con ese nombre');
    }
  }
}
