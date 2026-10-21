import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import type { User } from '../../generated/prisma/client';
import { ParseIdPipe } from '../../common/pipes/parse-id.pipe';
import { AdminOnly } from '../auth/decorators/auth.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AppointmentsService } from './appointments.service';
import {
  CancelAppointmentDto,
  CreateAppointmentDto,
  ListAppointmentsQueryDto,
  UpdateAppointmentDto,
} from './dto/appointment.dto';
import {
  toAppointmentResponse,
  toAppointmentWithDetails,
  type AppointmentResponse,
  type AppointmentWithDetails,
  type PublicBookedSlot,
} from './interfaces/appointment-response.interface';

/** Turnos (mismo contrato que /api/appointments de FastAPI). */
@Controller('appointments')
export class AppointmentsController {
  constructor(private readonly appointmentsService: AppointmentsService) {}

  /** Público: horarios ocupados para el calendario de la turnera (antes que /:id). */
  @Get('public/confirmed')
  listPublicConfirmed(): Promise<PublicBookedSlot[]> {
    return this.appointmentsService.listPublicConfirmed();
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  async create(
    @CurrentUser() user: User,
    @Body() body: CreateAppointmentDto,
  ): Promise<AppointmentResponse> {
    return toAppointmentResponse(
      await this.appointmentsService.create(user, body),
    );
  }

  /** Turnos del usuario autenticado (lo que consume "Mis Turnos"). */
  @Get()
  @UseGuards(JwtAuthGuard)
  async listMine(
    @CurrentUser() user: User,
    @Query() query: ListAppointmentsQueryDto,
  ): Promise<AppointmentWithDetails[]> {
    const appointments = await this.appointmentsService.listMine(user, query);
    return appointments.map(toAppointmentWithDetails);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  async findOne(
    @Param('id', ParseIdPipe) id: number,
    @CurrentUser() user: User,
  ): Promise<AppointmentWithDetails> {
    return toAppointmentWithDetails(
      await this.appointmentsService.findOneForUser(id, user),
    );
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard)
  async update(
    @Param('id', ParseIdPipe) id: number,
    @CurrentUser() user: User,
    @Body() body: UpdateAppointmentDto,
  ): Promise<AppointmentResponse> {
    return toAppointmentResponse(
      await this.appointmentsService.update(id, user, body),
    );
  }

  /** POST es lo que usa el frontend; PATCH es un alias. */
  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  async cancel(
    @Param('id', ParseIdPipe) id: number,
    @CurrentUser() user: User,
    @Body() body: CancelAppointmentDto,
  ): Promise<AppointmentResponse> {
    return toAppointmentResponse(
      await this.appointmentsService.cancel(id, user, body),
    );
  }

  @Patch(':id/cancel')
  @UseGuards(JwtAuthGuard)
  cancelWithPatch(
    @Param('id', ParseIdPipe) id: number,
    @CurrentUser() user: User,
    @Body() body: CancelAppointmentDto,
  ): Promise<AppointmentResponse> {
    return this.cancel(id, user, body);
  }

  @Delete(':id')
  @AdminOnly()
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseIdPipe) id: number): Promise<void> {
    return this.appointmentsService.remove(id);
  }
}
