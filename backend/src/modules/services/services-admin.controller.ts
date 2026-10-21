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
  UseGuards,
} from '@nestjs/common';
import { ParseIdPipe } from '../../common/pipes/parse-id.pipe';
import { AdminGuard } from '../auth/guards/admin.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateServiceDto, UpdateServiceDto } from './dto/service-admin.dto';
import {
  toServiceAdmin,
  type ServiceAdmin,
} from './interfaces/service-public.interface';
import { ServicesService } from './services.service';

/**
 * ABM del catálogo bajo /api/admin/services (alias de las rutas admin de /api/services
 * que usa el frontend; misma lógica y mismas validaciones).
 */
@Controller('admin/services')
@UseGuards(JwtAuthGuard, AdminGuard)
export class ServicesAdminController {
  constructor(private readonly servicesService: ServicesService) {}

  @Get()
  async findAll(): Promise<ServiceAdmin[]> {
    const services = await this.servicesService.findAllAdmin();
    return services.map(toServiceAdmin);
  }

  @Post()
  async create(@Body() body: CreateServiceDto): Promise<ServiceAdmin> {
    return toServiceAdmin(await this.servicesService.create(body));
  }

  @Put(':id')
  async update(
    @Param('id', ParseIdPipe) id: number,
    @Body() body: UpdateServiceDto,
  ): Promise<ServiceAdmin> {
    return toServiceAdmin(await this.servicesService.update(id, body));
  }

  @Put(':id/toggle-active')
  async toggleActive(
    @Param('id', ParseIdPipe) id: number,
  ): Promise<ServiceAdmin> {
    return toServiceAdmin(await this.servicesService.toggleActive(id));
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseIdPipe) id: number): Promise<void> {
    return this.servicesService.remove(id);
  }
}
