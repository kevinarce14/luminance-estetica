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
import { AvailabilityService } from './availability.service';
import {
  CreateAvailabilityDto,
  ListExceptionsQueryDto,
  UpdateAvailabilityDto,
} from './dto/availability.dto';
import { AvailableSlotsDto } from './dto/available-slots.dto';
import { CheckDateParamsDto } from './dto/check-date-params.dto';
import {
  toAvailabilityResponse,
  type AvailabilityResponse,
  type AvailableSlotsResponse,
  type DateAvailabilityCheck,
} from './interfaces/availability.interfaces';

/** Disponibilidad del studio (mismo contrato que /api/availability de FastAPI). */
@Controller('availability')
export class AvailabilityController {
  constructor(private readonly availabilityService: AvailabilityService) {}

  // ===== Público =====

  /** Grilla de horarios de un servicio en una fecha. POST es lo que usa el frontend. */
  @Post('available-slots')
  @HttpCode(HttpStatus.OK)
  getAvailableSlots(
    @Body() body: AvailableSlotsDto,
  ): Promise<AvailableSlotsResponse> {
    return this.availabilityService.getAvailableSlots(body);
  }

  /** Alias GET con query params: /available-slots?service_id=1&date=2026-10-22. */
  @Get('available-slots')
  getAvailableSlotsByQuery(
    @Query() query: AvailableSlotsDto,
  ): Promise<AvailableSlotsResponse> {
    return this.availabilityService.getAvailableSlots(query);
  }

  @Get('check/:date')
  checkDate(
    @Param() params: CheckDateParamsDto,
  ): Promise<DateAvailabilityCheck> {
    return this.availabilityService.checkDate(params.date);
  }

  // ===== Admin: horarios semanales =====

  @Get('regular')
  @AdminOnly()
  async listRegular(): Promise<AvailabilityResponse[]> {
    const schedules = await this.availabilityService.listRegular();
    return schedules.map(toAvailabilityResponse);
  }

  @Post('regular')
  @AdminOnly()
  async createRegular(
    @Body() body: CreateAvailabilityDto,
  ): Promise<AvailabilityResponse> {
    return toAvailabilityResponse(
      await this.availabilityService.create(body, 'regular'),
    );
  }

  @Put('regular/:id')
  @AdminOnly()
  async updateRegular(
    @Param('id', ParseIdPipe) id: number,
    @Body() body: UpdateAvailabilityDto,
  ): Promise<AvailabilityResponse> {
    return toAvailabilityResponse(
      await this.availabilityService.update(id, body, 'regular'),
    );
  }

  @Delete('regular/:id')
  @AdminOnly()
  @HttpCode(HttpStatus.NO_CONTENT)
  removeRegular(@Param('id', ParseIdPipe) id: number): Promise<void> {
    return this.availabilityService.remove(id, 'regular');
  }

  // ===== Admin: excepciones (feriados, horarios especiales) =====

  @Get('exceptions')
  @AdminOnly()
  async listExceptions(
    @Query() query: ListExceptionsQueryDto,
  ): Promise<AvailabilityResponse[]> {
    const exceptions = await this.availabilityService.listExceptions(
      query.future_only,
    );
    return exceptions.map(toAvailabilityResponse);
  }

  @Post('exceptions')
  @AdminOnly()
  async createException(
    @Body() body: CreateAvailabilityDto,
  ): Promise<AvailabilityResponse> {
    return toAvailabilityResponse(
      await this.availabilityService.create(body, 'exception'),
    );
  }

  @Delete('exceptions/:id')
  @AdminOnly()
  @HttpCode(HttpStatus.NO_CONTENT)
  removeException(@Param('id', ParseIdPipe) id: number): Promise<void> {
    return this.availabilityService.remove(id, 'exception');
  }

  // ===== Admin: genéricas (cualquier franja) =====

  @Get()
  @AdminOnly()
  async listAll(): Promise<AvailabilityResponse[]> {
    const availability = await this.availabilityService.listAll();
    return availability.map(toAvailabilityResponse);
  }

  @Post()
  @AdminOnly()
  async create(
    @Body() body: CreateAvailabilityDto,
  ): Promise<AvailabilityResponse> {
    return toAvailabilityResponse(
      await this.availabilityService.create(body, 'any'),
    );
  }

  @Put(':id')
  @AdminOnly()
  async update(
    @Param('id', ParseIdPipe) id: number,
    @Body() body: UpdateAvailabilityDto,
  ): Promise<AvailabilityResponse> {
    return toAvailabilityResponse(
      await this.availabilityService.update(id, body, 'any'),
    );
  }

  @Delete(':id')
  @AdminOnly()
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseIdPipe) id: number): Promise<void> {
    return this.availabilityService.remove(id, 'any');
  }
}
