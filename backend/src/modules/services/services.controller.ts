import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ParseIdPipe } from '../../common/pipes/parse-id.pipe';
import { AdminOnly } from '../auth/decorators/auth.decorator';
import { ListServicesQueryDto } from './dto/list-services-query.dto';
import { CreateServiceDto, UpdateServiceDto } from './dto/service-admin.dto';
import {
  toServiceAdmin,
  type ServiceAdmin,
  type ServicePublic,
} from './interfaces/service-public.interface';
import { ServicesService } from './services.service';

/**
 * Catálogo de servicios: lectura pública y ABM para el admin, con las rutas que usa el
 * frontend (mismo contrato que /api/services de FastAPI). Las rutas fijas van antes que /:id.
 */
@Controller('services')
export class ServicesController {
  constructor(private readonly servicesService: ServicesService) {}

  @Get()
  findAll(@Query() query: ListServicesQueryDto): Promise<ServicePublic[]> {
    return this.servicesService.findAll(query);
  }

  @Get('admin/all')
  @AdminOnly()
  async findAllAdmin(): Promise<ServiceAdmin[]> {
    const services = await this.servicesService.findAllAdmin();
    return services.map(toServiceAdmin);
  }

  @Get('category/:category')
  findByCategory(
    @Param('category') category: string,
  ): Promise<ServicePublic[]> {
    return this.servicesService.findByCategory(category);
  }

  @Get(':id')
  findOne(@Param('id', ParseIdPipe) id: number): Promise<ServicePublic> {
    return this.servicesService.findOne(id);
  }

  @Post()
  @AdminOnly()
  async create(@Body() body: CreateServiceDto): Promise<ServiceAdmin> {
    return toServiceAdmin(await this.servicesService.create(body));
  }

  @Put(':id')
  @AdminOnly()
  async update(
    @Param('id', ParseIdPipe) id: number,
    @Body() body: UpdateServiceDto,
  ): Promise<ServiceAdmin> {
    return toServiceAdmin(await this.servicesService.update(id, body));
  }

  @Put(':id/toggle-active')
  @AdminOnly()
  async toggleActive(
    @Param('id', ParseIdPipe) id: number,
  ): Promise<ServiceAdmin> {
    return toServiceAdmin(await this.servicesService.toggleActive(id));
  }

  @Delete(':id')
  @AdminOnly()
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseIdPipe) id: number): Promise<void> {
    return this.servicesService.remove(id);
  }
}
