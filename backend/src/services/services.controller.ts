import { Controller, Get, Param, ParseIntPipe, Query } from '@nestjs/common';
import { ListServicesQueryDto } from './dto/list-services-query.dto';
import type { ServicePublic } from './interfaces/service-public.interface';
import { ServicesService } from './services.service';

/** Catálogo público de servicios (no requiere autenticación). */
@Controller('services')
export class ServicesController {
  constructor(private readonly servicesService: ServicesService) {}

  @Get()
  findAll(@Query() query: ListServicesQueryDto): Promise<ServicePublic[]> {
    return this.servicesService.findAll(query);
  }

  @Get('category/:category')
  findByCategory(
    @Param('category') category: string,
  ): Promise<ServicePublic[]> {
    return this.servicesService.findByCategory(category);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number): Promise<ServicePublic> {
    return this.servicesService.findOne(id);
  }
}
